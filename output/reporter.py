import json
from anthropic import Anthropic

from db.init_db import get_session
from db.schema import (
    Insight, Cluster, CleanedFeedback,
    FeedbackClusterMap
)
from config.settings import ANTHROPIC_API_KEY
import concurrent.futures

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)

RECOMMENDATION_PROMPT = """You are a senior product manager writing actionable recommendations for an engineering and product team.

Below is a prioritized product insight derived from real user feedback analysis.

Cluster Theme     : {cluster_label}
Priority Rank     : #{priority_rank} out of {total_insights}
Root Cause        : {root_cause}
Severity          : {severity}
Frequency Score   : {frequency} (proportion of total feedback)
Confidence Score  : {confidence}
Contributing Factors: {evidence}

Sample Feedback:
{feedback_samples}

Write a clear, actionable recommendation in this EXACT JSON format:
{{
  "what_to_fix": "One sentence describing the specific problem to solve",
  "recommended_actions": [
    "Specific action 1 with owner (e.g. Engineering, Design, Support)",
    "Specific action 2 with owner",
    "Specific action 3 with owner"
  ],
  "success_metric": "How to measure if this fix worked (specific and measurable)",
  "estimated_effort": "low|medium|high",
  "quick_win": true or false
}}

Rules:
- recommended_actions must be specific and immediately actionable
- success_metric must be measurable (e.g. reduce crash rate by 50 percent)
- quick_win is true if this can be fixed in under 1 sprint
- Return ONLY the JSON object, no explanation or markdown"""


def get_feedback_samples(session, cluster_id: int) -> list[str]:
    """Fetch unique feedback samples for a cluster."""
    mappings = session.query(FeedbackClusterMap).filter_by(
        cluster_id=cluster_id
    ).all()

    cleaned_ids = [m.cleaned_id for m in mappings]
    rows = session.query(CleanedFeedback).filter(
        CleanedFeedback.id.in_(cleaned_ids)
    ).all()

    seen = set()
    samples = []
    for row in rows:
        text = row.cleaned_text.strip()
        if text not in seen:
            seen.add(text)
            samples.append(text)
        if len(samples) >= 8:
            break

    return samples


def generate_recommendation(
    insight: Insight,
    cluster: Cluster,
    samples: list[str],
    total_insights: int
) -> dict:
    """Call Claude Sonnet to generate recommendation for one insight."""

    severity_map = {1.0: "critical", 0.75: "high", 0.5: "medium", 0.25: "low"}
    severity_label = severity_map.get(insight.severity_score, "medium")

    formatted_samples = "\n".join(f"- {s}" for s in samples)

    prompt = RECOMMENDATION_PROMPT.format(
        cluster_label=cluster.cluster_label,
        priority_rank=insight.priority_rank,
        total_insights=total_insights,
        root_cause=insight.root_cause,
        severity=severity_label,
        frequency=round(insight.frequency_score, 3),
        confidence=round(insight.confidence_score, 3),
        evidence=insight.evidence or "N/A",
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

        required = [
            "what_to_fix", "recommended_actions",
            "success_metric", "estimated_effort", "quick_win"
        ]
        for field in required:
            if field not in result:
                raise ValueError(f"Missing field: {field}")

        return result

    except Exception as e:
        print(f"  Recommendation generation failed: {e}")
        return {
            "what_to_fix": "Manual review required.",
            "recommended_actions": ["Review feedback manually"],
            "success_metric": "To be defined",
            "estimated_effort": "medium",
            "quick_win": False
        }


def format_final_report(insights_data: list[dict]) -> str:
    """Format a human-readable report for terminal output."""
    lines = []
    lines.append("\n" + "=" * 70)
    lines.append("LUMIQ — PRODUCT INSIGHTS REPORT")
    lines.append("=" * 70)
    lines.append(f"Total insights generated : {len(insights_data)}")
    lines.append(f"Quick wins available     : "
                 f"{sum(1 for i in insights_data if i['quick_win'])}")
    lines.append("=" * 70)

    for item in insights_data:
        lines.append(f"\n{'─' * 70}")
        lines.append(
            f"PRIORITY #{item['priority_rank']}  |  "
            f"{item['cluster_label'].upper()}"
        )
        lines.append(f"{'─' * 70}")
        lines.append(f"What to fix    : {item['what_to_fix']}")
        lines.append(f"Root cause     : {item['root_cause'][:100]}...")
        lines.append(f"Effort         : {item['estimated_effort'].upper()}")
        lines.append(
            f"Quick win      : {'✅ Yes' if item['quick_win'] else '❌ No'}"
        )
        lines.append(f"Success metric : {item['success_metric']}")
        lines.append(f"\nRecommended actions:")
        for i, action in enumerate(item['recommended_actions'], 1):
            lines.append(f"  {i}. {action}")

    lines.append(f"\n{'=' * 70}")
    lines.append("END OF REPORT")
    lines.append("=" * 70)

    return "\n".join(lines)

def generate_all_insights():
    session = get_session()
    insights = session.query(Insight).order_by(Insight.priority_rank).all()

    if not insights:
        print("No insights found.")
        session.close()
        return

    total = len(insights)
    print(f"Generating {total} recommendations in parallel...")

    # Fetch all data upfront
    insight_data = []
    for insight in insights:
        cluster = session.query(Cluster).filter_by(id=insight.cluster_id).first()
        samples = get_feedback_samples(session, cluster.id)
        insight_data.append((insight.id, insight, cluster, samples))

    session.close()

    # Run Claude calls concurrently
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(
                generate_recommendation, insight, cluster, samples, total
            ): insight_id
            for insight_id, insight, cluster, samples in insight_data
        }
        for future in concurrent.futures.as_completed(futures):
            insight_id = futures[future]
            try:
                rec = future.result()
                results[insight_id] = rec
                print(f"  ✓ Insight #{insight_id}")
            except Exception as e:
                print(f"  ✗ Insight #{insight_id}: {e}")
                results[insight_id] = {
                    "what_to_fix": "Manual review required.",
                    "recommended_actions": ["Review feedback manually"],
                    "success_metric": "To be defined",
                    "estimated_effort": "medium",
                    "quick_win": False
                }

    # Write results to DB
    session = get_session()
    insights_data = []

    for insight_id, insight, cluster, _ in insight_data:
        rec = results.get(insight_id, {})
        actions_text = " | ".join(rec.get("recommended_actions", []))
        full_recommendation = (
            f"WHAT TO FIX: {rec.get('what_to_fix', '')} | "
            f"ACTIONS: {actions_text} | "
            f"SUCCESS METRIC: {rec.get('success_metric', '')} | "
            f"EFFORT: {rec.get('estimated_effort', 'medium').upper()} | "
            f"QUICK WIN: {'Yes' if rec.get('quick_win') else 'No'}"
        )

        db_insight = session.query(Insight).filter_by(id=insight_id).first()
        if db_insight:
            db_insight.recommendation = full_recommendation

        insights_data.append({
            "priority_rank": insight.priority_rank,
            "cluster_label": cluster.cluster_label,
            "root_cause": insight.root_cause,
            "what_to_fix": rec.get("what_to_fix", ""),
            "recommended_actions": rec.get("recommended_actions", []),
            "success_metric": rec.get("success_metric", ""),
            "estimated_effort": rec.get("estimated_effort", "medium"),
            "quick_win": rec.get("quick_win", False)
        })

    session.commit()
    session.close()

    report = format_final_report(insights_data)
    print(report)
    print(f"\n✅ All recommendations written to Supabase.")


if __name__ == "__main__":
    generate_all_insights()