import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize
from anthropic import Anthropic
import json

from db.init_db import get_session
from db.schema import CleanedFeedback, Cluster, FeedbackClusterMap
from config.settings import ANTHROPIC_API_KEY

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

MIN_CLUSTERS = 3
MAX_CLUSTERS = 12


def load_cleaned_feedback():
    session = get_session()
    rows = session.query(CleanedFeedback).all()
    session.close()
    return rows


def deduplicate_feedback(rows):
    text_to_ids = {}
    for row in rows:
        text = row.cleaned_text.strip()
        if text not in text_to_ids:
            text_to_ids[text] = []
        text_to_ids[text].append(row.id)
    unique_texts = list(text_to_ids.keys())
    print(f"  Total rows     : {len(rows)}")
    print(f"  Unique texts   : {len(unique_texts)}")
    return unique_texts, text_to_ids


def generate_embeddings(texts):
    """TF-IDF + SVD — zero external dependencies, minimal RAM."""
    print(f"  Generating embeddings for {len(texts)} texts...")

    vectorizer = TfidfVectorizer(
        max_features=300,       # reduced from 500
        ngram_range=(1, 2),
        stop_words='english',
        min_df=1
    )
    tfidf_matrix = vectorizer.fit_transform(texts)

    n_components = min(30, len(texts) - 1, tfidf_matrix.shape[1] - 1)
    n_components = max(n_components, 2)

    svd = TruncatedSVD(n_components=n_components, random_state=42)
    embeddings = svd.fit_transform(tfidf_matrix)
    embeddings = normalize(embeddings)

    print(f"  Embeddings shape: {embeddings.shape}")
    return np.array(embeddings, dtype=np.float32)  # float32 uses half the RAM


def find_optimal_clusters(embeddings):
    print("  Finding optimal cluster count...")
    n_samples = len(embeddings)
    max_k = min(MAX_CLUSTERS, n_samples - 1)
    best_k = MIN_CLUSTERS
    best_score = -1

    for k in range(MIN_CLUSTERS, max_k + 1):
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=5)  # reduced n_init
        labels = kmeans.fit_predict(embeddings)
        if len(set(labels)) < 2:
            continue
        score = silhouette_score(embeddings, labels)
        print(f"    k={k} → {score:.4f}")
        if score > best_score:
            best_score = score
            best_k = k

    print(f"  Optimal k: {best_k} (score: {best_score:.4f})")
    final = KMeans(n_clusters=best_k, random_state=42, n_init=5)
    return final.fit_predict(embeddings)


def label_clusters_with_claude(cluster_texts):
    print("  Labelling clusters with Claude Haiku...")
    cluster_input = ""
    for cid, texts in cluster_texts.items():
        cluster_input += f"\nCluster {cid}:\n"
        cluster_input += "\n".join(f"  - {t}" for t in texts[:5])

    prompt = f"""You are a product analyst. Label each feedback cluster with a short 3-6 word theme.

Return ONLY a JSON object like:
{{
  "0": "App Performance Issues",
  "1": "Payment Failures"
}}

Clusters:
{cluster_input}"""

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return {int(k): v for k, v in json.loads(raw.strip()).items()}
    except Exception as e:
        print(f"  Labelling failed: {e}")
        return {cid: f"Cluster {cid}" for cid in cluster_texts.keys()}


def save_clusters_to_db(labels, cluster_label_map, unique_texts, text_to_ids):
    print("  Saving to database...")
    session = get_session()
    session.query(FeedbackClusterMap).delete()
    session.query(Cluster).delete()
    session.commit()

    unique_cluster_ids = sorted(set(labels))
    cluster_db_map = {}

    for cluster_id in unique_cluster_ids:
        indices = [i for i, l in enumerate(labels) if l == cluster_id]
        samples = [unique_texts[i] for i in indices]
        total_count = sum(len(text_to_ids[unique_texts[i]]) for i in indices)
        label = cluster_label_map.get(cluster_id, f"Cluster {cluster_id}")

        obj = Cluster(
            cluster_label=label,
            representative_text=samples[0],
            feedback_count=total_count
        )
        session.add(obj)
        session.flush()
        cluster_db_map[cluster_id] = obj.id

    for i, text in enumerate(unique_texts):
        cluster_id = int(labels[i])
        db_cluster_id = cluster_db_map[cluster_id]
        for original_id in text_to_ids[text]:
            session.add(FeedbackClusterMap(
                cleaned_id=original_id,
                cluster_id=db_cluster_id
            ))

    session.commit()
    session.close()
    print(f"  Saved {len(unique_cluster_ids)} clusters.")


def cluster_all():
    print("Starting clustering...")
    rows = load_cleaned_feedback()
    if not rows:
        print("No feedback found.")
        return

    unique_texts, text_to_ids = deduplicate_feedback(rows)
    embeddings = generate_embeddings(unique_texts)
    labels = find_optimal_clusters(embeddings)

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
        print(f"    {label}: {count} rows")

    save_clusters_to_db(labels, cluster_label_map, unique_texts, text_to_ids)
    print(f"\nClustering complete. {len(unique_clusters)} clusters found.")


if __name__ == "__main__":
    cluster_all()