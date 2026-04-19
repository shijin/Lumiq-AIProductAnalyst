from db.init_db import get_session
from db.schema import (
    Insight, Cluster, CleanedFeedback,
    FeedbackClusterMap
)

# ── Scoring weights ───────────────────────────────────────────────
WEIGHTS = {
    "frequency": 0.30,
    "severity":  0.35,
    "confidence": 0.20,
    "impact":    0.15
}

# ── Intent → impact score mapping ────────────────────────────────
INTENT_IMPACT_MAP = {
    "bug":              0.9,
    "complaint":        0.7,
    "churn_signal":     1.0,
    "pricing_feedback": 0.8,
    "feature_request":  0.5,
    "question":         0.3,
    "praise":           0.1
}


def get_cluster_intents(session, cluster_id: int) -> list[str]:
    """Fetch all intents for feedback rows in a cluster."""
    mappings = session.query(FeedbackClusterMap).filter_by(
        cluster_id=cluster_id
    ).all()

    cleaned_ids = [m.cleaned_id for m in mappings]

    rows = session.query(CleanedFeedback).filter(
        CleanedFeedback.id.in_(cleaned_ids)
    ).all()

    return [row.intent for row in rows if row.intent]


def calculate_impact_score(intents: list[str]) -> float:
    """
    Calculate impact score based on intent distribution.
    Churn signals get highest weight — they represent
    users about to leave.
    """
    if not intents:
        return 0.5

    # Get highest impact intent in cluster
    impact_scores = [
        INTENT_IMPACT_MAP.get(intent, 0.5)
        for intent in intents
    ]

    # Weighted: max intent score + average (balances extremes)
    max_score = max(impact_scores)
    avg_score = sum(impact_scores) / len(impact_scores)

    return round((max_score * 0.6) + (avg_score * 0.4), 4)


def calculate_priority_score(
    frequency: float,
    severity: float,
    confidence: float,
    impact: float
) -> float:
    """Calculate weighted priority score — higher = more urgent."""
    score = (
        frequency  * WEIGHTS["frequency"] +
        severity   * WEIGHTS["severity"] +
        confidence * WEIGHTS["confidence"] +
        impact     * WEIGHTS["impact"]
    )
    return round(score, 4)


def prioritize_all():
    """
    Calculate impact scores and priority ranks for all insights.
    Updates insights table with:
    - impact_score
    - priority_rank (1 = highest priority)
    """
    session = get_session()

    insights = session.query(Insight).all()

    if not insights:
        print("No insights found. Run reasoning/analyzer.py first.")
        session.close()
        return

    print(f"Scoring {len(insights)} insights...\n")

    scored = []

    for insight in insights:
        cluster = session.query(Cluster).filter_by(
            id=insight.cluster_id
        ).first()

        # Get intents for this cluster
        intents = get_cluster_intents(session, cluster.id)

        # Calculate impact score from intents
        impact_score = calculate_impact_score(intents)

        # Calculate final priority score
        priority_score = calculate_priority_score(
            frequency=insight.frequency_score or 0.0,
            severity=insight.severity_score or 0.5,
            confidence=insight.confidence_score or 0.5,
            impact=impact_score
        )

        # Update insight
        insight.impact_score = impact_score

        scored.append({
            "insight": insight,
            "cluster_label": cluster.cluster_label,
            "priority_score": priority_score,
            "frequency": insight.frequency_score,
            "severity": insight.severity_score,
            "confidence": insight.confidence_score,
            "impact": impact_score,
            "intents": list(set(intents))
        })

    # Sort by priority score descending
    scored.sort(key=lambda x: x["priority_score"], reverse=True)

    # Assign priority ranks
    print(f"{'Rank':<6} {'Score':<8} {'Cluster':<40} {'Freq':<7} {'Sev':<7} {'Conf':<7} {'Impact'}")
    print("-" * 90)

    for rank, item in enumerate(scored, start=1):
        item["insight"].priority_rank = rank

        print(
            f"{rank:<6} "
            f"{item['priority_score']:<8} "
            f"{item['cluster_label'][:38]:<40} "
            f"{item['frequency']:<7} "
            f"{item['severity']:<7} "
            f"{item['confidence']:<7} "
            f"{item['impact']}"
        )

    # Extract values BEFORE closing session
    top_3 = []
    for item in scored[:3]:
        top_3.append({
            "rank": item["insight"].priority_rank,
            "label": item["cluster_label"],
            "root_cause": item["insight"].root_cause
        })

    session.commit()
    session.close()

    print(f"\nPrioritization complete.")
    print(f"  Insights ranked : {len(scored)}")
    print(f"\nTop 3 priorities for your product team:")
    for item in top_3:
        print(f"  #{item['rank']} {item['label']}")
        print(f"     Root cause: {item['root_cause'][:80]}...")
        print()


if __name__ == "__main__":
    prioritize_all()