import json
from anthropic import Anthropic
from sqlalchemy.orm import Session

from db.init_db import get_session
from db.schema import Cluster, CleanedFeedback, FeedbackClusterMap, Insight
from config.settings import ANTHROPIC_API_KEY

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


def analyze_cluster(cluster: Cluster, samples: list[str]) -> dict:
    """Call Claude Sonnet to analyze root cause for one cluster."""

    formatted_samples = "\n".join(f"- {s}" for s in samples)

    prompt = ROOT_CAUSE_PROMPT.format(
        cluster_label=cluster.cluster_label,
        feedback_samples=formatted_samples
    )

    try:
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        raw = response.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)

        # Validate required fields
        required = [
            "root_cause", "contributing_factors",
            "affected_segment", "severity", "confidence"
        ]
        for field in required:
            if field not in result:
                raise ValueError(f"Missing field: {field}")

        return result

    except Exception as e:
        print(f"  Root cause analysis failed for '{cluster.cluster_label}': {e}")
        return {
            "root_cause": "Unable to determine root cause automatically.",
            "contributing_factors": [],
            "affected_segment": "Unknown",
            "severity": "medium",
            "confidence": 0.0
        }


def analyze_all_clusters():
    """
    Run root cause analysis for all non-positive clusters.
    Creates one Insight record per cluster.
    """
    session = get_session()

    clusters = session.query(Cluster).all()

    if not clusters:
        print("No clusters found.")
        session.close()
        return

    print(f"Found {len(clusters)} clusters.")

    # Clear existing insights for clean re-runs
    session.query(Insight).delete()
    session.commit()

    analyzed = 0
    skipped = 0

    for cluster in clusters:
        print(f"\nProcessing: '{cluster.cluster_label}'")

        # Skip positive clusters
        if is_positive_cluster(cluster.cluster_label):
            print(f"  → Skipping (positive feedback cluster)")
            skipped += 1
            continue

        # Get feedback samples
        samples = get_cluster_feedback_samples(session, cluster.id)
        print(f"  → {len(samples)} unique samples found")

        # Analyze with Claude Sonnet
        print(f"  → Calling Claude Sonnet for root cause...")
        analysis = analyze_cluster(cluster, samples)

        # Map severity to numeric score
        severity_map = {
            "critical": 1.0,
            "high": 0.75,
            "medium": 0.5,
            "low": 0.25
        }
        severity_score = severity_map.get(
            analysis["severity"], 0.5
        )

        # Calculate frequency score (feedback_count / total rows)
        total_rows = session.query(FeedbackClusterMap).count()
        frequency_score = round(cluster.feedback_count / total_rows, 4)

        # Format contributing factors as evidence
        evidence = " | ".join(analysis["contributing_factors"])

        # Create insight record
        insight = Insight(
            cluster_id=cluster.id,
            root_cause=analysis["root_cause"],
            recommendation=None,        # filled in Step 8
            impact_score=None,          # filled in Step 8
            frequency_score=frequency_score,
            severity_score=severity_score,
            confidence_score=float(analysis["confidence"]),
            priority_rank=None,         # filled in Step 8
            evidence=evidence
        )
        session.add(insight)
        session.commit()

        print(f"  → Root cause: {analysis['root_cause'][:80]}...")
        print(f"  → Severity  : {analysis['severity']}")
        print(f"  → Confidence: {analysis['confidence']}")
        analyzed += 1

    session.close()

    print(f"\nRoot cause analysis complete.")
    print(f"  Clusters analyzed : {analyzed}")
    print(f"  Clusters skipped  : {skipped} (positive feedback)")


if __name__ == "__main__":
    analyze_all_clusters()