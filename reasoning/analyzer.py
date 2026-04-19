import json
from anthropic import Anthropic
from sqlalchemy.orm import Session

from db.init_db import get_session
from db.schema import Cluster, CleanedFeedback, FeedbackClusterMap, Insight
from config.settings import ANTHROPIC_API_KEY
import concurrent.futures

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

# Clusters with these keywords are positive — skip root cause
POSITIVE_CLUSTER_KEYWORDS = [
    "positive", "praise", "good", "great", "loved",
    "excellent", "happy", "satisfied", "update"
]

ROOT_CAUSE_PROMPT = """You are a senior product manager analyzing user feedback clusters.

Below is a cluster of similar user feedback for a mobile app.

Cluster Theme: {cluster_label}

Feedback samples:
{feedback_samples}

Analyze this feedback deeply and respond ONLY with a JSON object in this exact format:
{{
  "root_cause": "The core underlying reason this problem exists (2-3 sentences, specific and technical where possible)",
  "contributing_factors": ["factor 1", "factor 2", "factor 3"],
  "affected_segment": "Which type of users are most affected",
  "severity": "critical|high|medium|low",
  "confidence": 0.0
}}

Rules:
- root_cause must explain WHY the problem exists, not just WHAT the problem is
- contributing_factors must be a list of 2-4 specific factors
- severity: critical=data loss/payment failure, high=core feature broken, medium=ux friction, low=minor annoyance
- confidence: 0.0-1.0 based on how clearly the feedback points to the root cause
- Return ONLY the JSON object, no explanation or markdown"""


def is_positive_cluster(cluster_label: str) -> bool:
    """Skip root cause analysis for positive feedback clusters."""
    label_lower = cluster_label.lower()
    return any(keyword in label_lower for keyword in POSITIVE_CLUSTER_KEYWORDS)


def get_cluster_feedback_samples(
    session: Session,
    cluster_id: int,
    max_samples: int = 10
) -> list[str]:
    """Fetch feedback samples for a cluster."""
    mappings = session.query(FeedbackClusterMap).filter_by(
        cluster_id=cluster_id
    ).all()

    cleaned_ids = [m.cleaned_id for m in mappings]

    rows = session.query(CleanedFeedback).filter(
        CleanedFeedback.id.in_(cleaned_ids)
    ).all()

    # Deduplicate samples for the prompt
    seen = set()
    samples = []
    for row in rows:
        text = row.cleaned_text.strip()
        if text not in seen:
            seen.add(text)
            samples.append(text)
        if len(samples) >= max_samples:
            break

    return samples


def analyze_all_clusters():
    session = get_session()
    clusters = session.query(Cluster).all()

    if not clusters:
        print("No clusters found.")
        session.close()
        return

    print(f"Found {len(clusters)} clusters.")
    session.query(Insight).delete()
    session.commit()

    # Filter out positive clusters
    problem_clusters = [
        c for c in clusters
        if not is_positive_cluster(c.cluster_label)
    ]
    positive_count = len(clusters) - len(problem_clusters)

    # Fetch all samples upfront
    cluster_data = []
    for cluster in problem_clusters:
        samples = get_cluster_feedback_samples(session, cluster.id)
        cluster_data.append((cluster, samples))

    session.close()

    print(f"Analysing {len(problem_clusters)} clusters in parallel...")

    # Run Claude calls concurrently
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(analyze_cluster, cluster, samples): (cluster, samples)
            for cluster, samples in cluster_data
        }
        for future in concurrent.futures.as_completed(futures):
            cluster, samples = futures[future]
            try:
                analysis = future.result()
                results.append((cluster, analysis))
                print(f"  ✓ {cluster.cluster_label}")
            except Exception as e:
                print(f"  ✗ {cluster.cluster_label}: {e}")
                results.append((cluster, {
                    "root_cause": "Unable to determine root cause.",
                    "contributing_factors": [],
                    "affected_segment": "Unknown",
                    "severity": "medium",
                    "confidence": 0.0
                }))

    # Write all results to DB
    session = get_session()
    severity_map = {"critical": 1.0, "high": 0.75, "medium": 0.5, "low": 0.25}
    total_rows = session.query(FeedbackClusterMap).count()

    for cluster, analysis in results:
        severity_score = severity_map.get(analysis["severity"], 0.5)
        frequency_score = round(cluster.feedback_count / total_rows, 4)
        evidence = " | ".join(analysis["contributing_factors"])

        insight = Insight(
            cluster_id=cluster.id,
            root_cause=analysis["root_cause"],
            recommendation=None,
            impact_score=None,
            frequency_score=frequency_score,
            severity_score=severity_score,
            confidence_score=float(analysis["confidence"]),
            priority_rank=None,
            evidence=evidence
        )
        session.add(insight)

    session.commit()
    session.close()

    print(f"\nRoot cause analysis complete.")
    print(f"  Clusters analyzed : {len(results)}")
    print(f"  Clusters skipped  : {positive_count} (positive)")


if __name__ == "__main__":
    analyze_all_clusters()