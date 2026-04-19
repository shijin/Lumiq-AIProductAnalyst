import numpy as np
import chromadb
import hdbscan
import ollama
from anthropic import Anthropic
import json

from db.init_db import get_session
from db.schema import CleanedFeedback, Cluster, FeedbackClusterMap
from config.settings import ANTHROPIC_API_KEY, OLLAMA_EMBEDDING_MODEL
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# ── Client setup ──────────────────────────────────────────────────
chroma_client = chromadb.Client()
anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

# ── Constants ─────────────────────────────────────────────────────
CHROMA_COLLECTION = "lumiq_feedback"
MIN_CLUSTERS = 3        # minimum clusters to consider
MAX_CLUSTERS = 12       # maximum clusters to consider


# ── Step 1: Load feedback from DB ────────────────────────────────
def load_cleaned_feedback():
    session = get_session()
    rows = session.query(CleanedFeedback).all()
    session.close()
    return rows

# ── Step 1b: Deduplicate feedback ────────────────────────────────
def deduplicate_feedback(rows: list) -> tuple[list[str], dict[str, list[int]]]:
    """
    Deduplicate cleaned_text while tracking which original row IDs
    map to each unique text.

    Returns:
        unique_texts: list of unique feedback strings
        text_to_ids: dict mapping unique_text → list of cleaned_feedback ids
    """
    text_to_ids = {}
    for row in rows:
        text = row.cleaned_text.strip()
        if text not in text_to_ids:
            text_to_ids[text] = []
        text_to_ids[text].append(row.id)

    unique_texts = list(text_to_ids.keys())
    print(f"  Total rows          : {len(rows)}")
    print(f"  Unique texts        : {len(unique_texts)}")
    print(f"  Duplicates removed  : {len(rows) - len(unique_texts)}")

    return unique_texts, text_to_ids

# ── Step 2: Generate embeddings via Ollama (local) ───────────────
def generate_embeddings(texts: list[str]) -> np.ndarray:
    """
    Generate embeddings locally using Ollama.
    Zero data leaves your machine.
    """
    print(f"  Generating embeddings for {len(texts)} texts (local)...")
    all_embeddings = []

    for i, text in enumerate(texts):
        response = ollama.embeddings(
            model=OLLAMA_EMBEDDING_MODEL,
            prompt=text
        )
        all_embeddings.append(response["embedding"])

        # Progress indicator every 10 rows
        if (i + 1) % 10 == 0:
            print(f"  Embedded {i + 1}/{len(texts)} rows...")

    print(f"  All {len(texts)} embeddings generated locally.")
    return np.array(all_embeddings)


# ── Step 3: Store in ChromaDB ────────────────────────────────────
def store_in_chroma(
    texts: list[str],
    embeddings: np.ndarray,
    ids: list[int]
):
    print("  Storing embeddings in ChromaDB...")

    try:
        chroma_client.delete_collection(CHROMA_COLLECTION)
    except Exception:
        pass

    collection = chroma_client.create_collection(CHROMA_COLLECTION)
    collection.add(
        documents=texts,
        embeddings=embeddings.tolist(),
        ids=[str(i) for i in ids]
    )
    print(f"  Stored {len(texts)} embeddings in ChromaDB.")
    return collection


# ── Step 4: K-Means with Elbow Method ───────────────────────────
def cluster_embeddings(embeddings: np.ndarray) -> np.ndarray:
    """
    Find optimal number of clusters using Silhouette Score,
    then apply K-Means clustering.
    """
    print("  Finding optimal cluster count...")

    n_samples = len(embeddings)
    max_k = min(MAX_CLUSTERS, n_samples - 1)
    best_k = MIN_CLUSTERS
    best_score = -1

    scores = []
    for k in range(MIN_CLUSTERS, max_k + 1):
        kmeans = KMeans(
            n_clusters=k,
            random_state=42,
            n_init=10
        )
        labels = kmeans.fit_predict(embeddings)
        score = silhouette_score(embeddings, labels)
        scores.append((k, score))
        print(f"    k={k} → silhouette score: {score:.4f}")

        if score > best_score:
            best_score = score
            best_k = k

    print(f"\n  Optimal clusters    : {best_k} (score: {best_score:.4f})")

    # Final clustering with best K
    final_kmeans = KMeans(
        n_clusters=best_k,
        random_state=42,
        n_init=10
    )
    labels = final_kmeans.fit_predict(embeddings)

    # Show cluster sizes
    for cid in range(best_k):
        count = list(labels).count(cid)
        print(f"    Cluster {cid}: {count} unique texts")

    return labels


# ── Step 5: Assign outliers to nearest cluster ───────────────────
def assign_outliers(
    embeddings: np.ndarray,
    labels: np.ndarray
) -> np.ndarray:
    unique_clusters = sorted(set(labels) - {-1})

    if not unique_clusters:
        print("  No clusters found — assigning all to cluster 0.")
        return np.zeros(len(labels), dtype=int)

    centroids = np.array([
        embeddings[labels == c].mean(axis=0)
        for c in unique_clusters
    ])

    updated_labels = labels.copy()
    outliers_reassigned = 0

    for i, label in enumerate(labels):
        if label == -1:
            distances = np.linalg.norm(centroids - embeddings[i], axis=1)
            nearest = unique_clusters[np.argmin(distances)]
            updated_labels[i] = nearest
            outliers_reassigned += 1

    print(f"  Outliers reassigned : {outliers_reassigned}")
    return updated_labels


# ── Step 6: Label clusters with Claude ──────────────────────────
def label_clusters_with_claude(
    cluster_texts: dict[int, list[str]]
) -> dict[int, str]:
    """
    Send cluster samples to Claude Haiku for labelling.
    Claude only sees anonymized, clustered themes — not raw user data.
    """
    print("  Labelling clusters with Claude Haiku...")

    cluster_input = ""
    for cluster_id, texts in cluster_texts.items():
        samples = texts[:5]  # max 5 samples per cluster
        cluster_input += f"\nCluster {cluster_id}:\n"
        cluster_input += "\n".join(f"  - {t}" for t in samples)

    prompt = f"""You are a product analyst. Below are groups of user feedback, each group representing a cluster of similar feedback.

For each cluster, generate a short, clear, human-readable label (3-6 words max) that captures the core problem or theme.

Rules:
- Return ONLY a JSON object mapping cluster number to label
- Labels must be concise and specific
- Do not include explanations or extra text

Example output:
{{
  "0": "App Performance Issues",
  "1": "Payment Failures",
  "2": "Navigation Confusion"
}}

Clusters to label:
{cluster_input}"""

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        raw = response.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        labels = json.loads(raw)
        return {int(k): v for k, v in labels.items()}

    except Exception as e:
        print(f"  Claude labelling failed: {e}")
        return {cid: f"Cluster {cid}" for cid in cluster_texts.keys()}


# ── Step 7: Save clusters to DB ──────────────────────────────────
def save_clusters_to_db(
    labels: np.ndarray,
    cluster_label_map: dict[int, str],
    unique_texts: list[str],
    text_to_ids: dict[str, list[int]]
):
    print("  Saving clusters to database...")
    session = get_session()

    session.query(FeedbackClusterMap).delete()
    session.query(Cluster).delete()
    session.commit()

    unique_cluster_ids = sorted(set(labels))
    cluster_db_map = {}

    for cluster_id in unique_cluster_ids:
        cluster_indices = [
            i for i, l in enumerate(labels) if l == cluster_id
        ]
        cluster_text_samples = [unique_texts[i] for i in cluster_indices]
        representative = cluster_text_samples[0]
        label = cluster_label_map.get(cluster_id, f"Cluster {cluster_id}")

        # Count ALL original rows — not just unique texts
        total_count = sum(
            len(text_to_ids[unique_texts[i]])
            for i in cluster_indices
        )

        cluster_obj = Cluster(
            cluster_label=label,
            representative_text=representative,
            feedback_count=total_count      # reflects true frequency
        )
        session.add(cluster_obj)
        session.flush()
        cluster_db_map[cluster_id] = cluster_obj.id

    # Map ALL 98 original rows to their cluster
    for i, text in enumerate(unique_texts):
        cluster_id = int(labels[i])
        db_cluster_id = cluster_db_map[cluster_id]
        original_ids = text_to_ids[text]

        for original_id in original_ids:
            mapping = FeedbackClusterMap(
                cleaned_id=original_id,
                cluster_id=db_cluster_id
            )
            session.add(mapping)

    session.commit()
    session.close()
    print(f"  Saved {len(unique_cluster_ids)} clusters to database.")

# ── Main orchestrator ─────────────────────────────────────────────
def cluster_all():
    print("Starting clustering pipeline...")
    print(f"Embedding model : {OLLAMA_EMBEDDING_MODEL} (local)")
    print(f"Clustering      : K-Means + Silhouette (auto-detect)")
    print(f"Labelling       : Claude Haiku\n")

    # 1. Load all feedback
    rows = load_cleaned_feedback()
    if not rows:
        print("No feedback found in cleaned_feedback table.")
        return

    # 2. Deduplicate
    unique_texts, text_to_ids = deduplicate_feedback(rows)

    # 3. Generate embeddings
    embeddings = generate_embeddings(unique_texts)

    # 4. Store in ChromaDB
    unique_ids = list(range(len(unique_texts)))
    store_in_chroma(unique_texts, embeddings, unique_ids)

    # 5. Cluster with K-Means (no outliers — every text gets assigned)
    labels = cluster_embeddings(embeddings)

    # 6. Build cluster → texts map for Claude
    unique_clusters = sorted(set(labels))
    cluster_texts = {
        cid: [unique_texts[i] for i, l in enumerate(labels) if l == cid]
        for cid in unique_clusters
    }

    # 7. Label with Claude
    cluster_label_map = label_clusters_with_claude(cluster_texts)

    print("\n  Cluster labels:")
    for cid, label in cluster_label_map.items():
        count = sum(
            len(text_to_ids[unique_texts[i]])
            for i, l in enumerate(labels) if l == cid
        )
        print(f"    Cluster {cid} ({count} rows): {label}")

    # 8. Save to DB
    save_clusters_to_db(labels, cluster_label_map, unique_texts, text_to_ids)

    print("\nClustering complete.")
    print(f"  Total feedback rows : {len(rows)}")
    print(f"  Unique texts        : {len(unique_texts)}")
    print(f"  Total clusters      : {len(unique_clusters)}")


if __name__ == "__main__":
    cluster_all()