import numpy as np
import chromadb
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from anthropic import Anthropic
import json
import os
import time

from db.init_db import get_session
from db.schema import CleanedFeedback, Cluster, FeedbackClusterMap
from config.settings import ANTHROPIC_API_KEY

# ── Client setup ──────────────────────────────────────────────────
chroma_client = chromadb.Client()
anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

# ── Constants ─────────────────────────────────────────────────────
CHROMA_COLLECTION = "lumiq_feedback"
MIN_CLUSTERS = 3
MAX_CLUSTERS = 12


# ── Step 1: Load feedback ─────────────────────────────────────────
def load_cleaned_feedback():
    session = get_session()
    rows = session.query(CleanedFeedback).all()
    session.close()
    return rows


# ── Step 1b: Deduplicate ──────────────────────────────────────────
def deduplicate_feedback(rows: list) -> tuple[list[str], dict[str, list[int]]]:
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


# ── Step 2: Generate embeddings via Claude API ────────────────────
def generate_embeddings_via_tfidf(texts: list[str]) -> np.ndarray:
    """
    Generate embeddings using TF-IDF + SVD.
    Zero RAM spike — no model download needed.
    Works entirely with sklearn which is already installed.
    """
    print(f"  Generating embeddings for {len(texts)} texts...")

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.decomposition import TruncatedSVD
    from sklearn.preprocessing import normalize

    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(
        max_features=500,
        ngram_range=(1, 2),
        stop_words='english',
        min_df=1
    )

    tfidf_matrix = vectorizer.fit_transform(texts)

    # Reduce dimensions with SVD (like LSA)
    n_components = min(50, len(texts) - 1, tfidf_matrix.shape[1] - 1)
    n_components = max(n_components, 2)

    svd = TruncatedSVD(n_components=n_components, random_state=42)
    embeddings = svd.fit_transform(tfidf_matrix)

    # Normalize
    embeddings = normalize(embeddings)

    print(f"  Embeddings shape: {embeddings.shape}")
    print(f"  All {len(texts)} embeddings generated.")
    return np.array(embeddings)


# ── Step 3: Store in ChromaDB ─────────────────────────────────────
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


# ── Step 4: K-Means clustering ────────────────────────────────────
def cluster_embeddings(embeddings: np.ndarray) -> np.ndarray:
    print("  Finding optimal cluster count...")

    n_samples = len(embeddings)
    max_k = min(MAX_CLUSTERS, n_samples - 1)
    best_k = MIN_CLUSTERS
    best_score = -1

    for k in range(MIN_CLUSTERS, max_k + 1):
        kmeans = KMeans(
            n_clusters=k,
            random_state=42,
            n_init=10
        )
        labels = kmeans.fit_predict(embeddings)

        if len(set(labels)) < 2:
            continue

        score = silhouette_score(embeddings, labels)
        print(f"    k={k} → silhouette score: {score:.4f}")

        if score > best_score:
            best_score = score
            best_k = k

    print(f"\n  Optimal clusters    : {best_k} (score: {best_score:.4f})")

    final_kmeans = KMeans(
        n_clusters=best_k,
        random_state=42,
        n_init=10
    )
    labels = final_kmeans.fit_predict(embeddings)

    for cid in range(best_k):
        count = list(labels).count(cid)
        print(f"    Cluster {cid}: {count} unique texts")

    return labels


# ── Step 5: Label clusters with Claude ───────────────────────────
def label_clusters_with_claude(
    cluster_texts: dict[int, list[str]]
) -> dict[int, str]:
    print("  Labelling clusters with Claude Haiku...")

    cluster_input = ""
    for cluster_id, texts in cluster_texts.items():
        samples = texts[:5]
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


# ── Step 6: Save to DB ────────────────────────────────────────────
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

        total_count = sum(
            len(text_to_ids[unique_texts[i]])
            for i in cluster_indices
        )

        cluster_obj = Cluster(
            cluster_label=label,
            representative_text=representative,
            feedback_count=total_count
        )
        session.add(cluster_obj)
        session.flush()
        cluster_db_map[cluster_id] = cluster_obj.id

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
    print(f"Embedding : TF-IDF + SVD (zero RAM spike)")
    print(f"Clustering: K-Means + Silhouette (auto-detect)\n")

    rows = load_cleaned_feedback()
    if not rows:
        print("No feedback found.")
        return

    unique_texts, text_to_ids = deduplicate_feedback(rows)
    embeddings = generate_embeddings_via_tfidf(unique_texts)

    unique_ids = list(range(len(unique_texts)))
    store_in_chroma(unique_texts, embeddings, unique_ids)

    labels = cluster_embeddings(embeddings)

    unique_clusters = sorted(set(labels))
    cluster_texts = {
        cid: [unique_texts[i] for i, l in enumerate(labels) if l == cid]
        for cid in unique_clusters
    }

    cluster_label_map = label_clusters_with_claude(cluster_texts)

    print("\n  Cluster labels:")
    for cid, label in cluster_label_map.items():
        count = sum(
            len(text_to_ids[unique_texts[i]])
            for i, l in enumerate(labels) if l == cid
        )
        print(f"    Cluster {cid} ({count} rows): {label}")

    save_clusters_to_db(labels, cluster_label_map, unique_texts, text_to_ids)

    print("\nClustering complete.")
    print(f"  Total feedback rows : {len(rows)}")
    print(f"  Unique texts        : {len(unique_texts)}")
    print(f"  Total clusters      : {len(unique_clusters)}")


if __name__ == "__main__":
    cluster_all()