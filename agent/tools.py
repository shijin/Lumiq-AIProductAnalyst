import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_core.tools import tool
#from langchain.tools import tool
from db.init_db import get_session
from db.schema import Insight, Cluster, RawFeedback, CleanedFeedback, FeedbackClusterMap
from backend.pipeline import run_full_pipeline, clear_all_data
from backend.state import pipeline_state
import json


@tool
def ingest_and_analyze(source: str) -> str:
    """
    Ingest feedback and run the full analysis pipeline.
    source can be a CSV file path or Google Sheet URL.
    Use this when the user wants to analyze new feedback.
    """
    try:
        clear_all_data()
        if source.startswith("http"):
            run_full_pipeline(
                source_type="sheet_url",
                sheet_url=source
            )
        else:
            run_full_pipeline(
                source_type="sheet_name",
                sheet_name=source
            )
        return "Analysis complete. You can now ask me about the insights."
    except Exception as e:
        return f"Analysis failed: {str(e)}"


@tool
def get_top_insights(n: int = 3) -> str:
    """
    Get the top N prioritized insights.
    Use this when user asks for top problems or priorities.
    """
    session = get_session()
    try:
        insights = session.query(Insight).order_by(
            Insight.priority_rank
        ).limit(n).all()

        if not insights:
            return "No insights found. Please run an analysis first."

        result = []
        for ins in insights:
            cluster = session.query(Cluster).filter_by(
                id=ins.cluster_id
            ).first()
            result.append({
                "rank": ins.priority_rank,
                "problem": cluster.cluster_label if cluster else "Unknown",
                "root_cause": ins.root_cause,
                "severity": ins.severity_score,
                "frequency": f"{round(ins.frequency_score * 100)}% of feedback",
                "confidence": f"{round(ins.confidence_score * 100)}%",
                "recommendation": ins.recommendation
            })

        return json.dumps(result, indent=2)
    finally:
        session.close()


@tool
def explain_insight(problem_name: str) -> str:
    """
    Explain why a specific problem is ranked where it is.
    Use this when user asks WHY something is prioritized or
    wants more detail on a specific cluster.
    """
    session = get_session()
    try:
        clusters = session.query(Cluster).all()
        cluster = None
        for c in clusters:
            if problem_name.lower() in c.cluster_label.lower():
                cluster = c
                break

        if not cluster:
            return f"Could not find a cluster matching '{problem_name}'"

        insight = session.query(Insight).filter_by(
            cluster_id=cluster.id
        ).first()

        if not insight:
            return f"No insight found for '{problem_name}'"

        # Get sample feedback
        maps = session.query(FeedbackClusterMap).filter_by(
            cluster_id=cluster.id
        ).limit(5).all()
        cleaned_ids = [m.cleaned_id for m in maps]
        samples = session.query(CleanedFeedback).filter(
            CleanedFeedback.id.in_(cleaned_ids)
        ).all()
        sample_texts = list(set([s.cleaned_text for s in samples]))[:3]

        return json.dumps({
            "problem": cluster.cluster_label,
            "priority_rank": insight.priority_rank,
            "root_cause": insight.root_cause,
            "evidence": insight.evidence,
            "sample_feedback": sample_texts,
            "impact_score": insight.impact_score,
            "frequency": f"{round(insight.frequency_score * 100)}% of feedback",
            "severity": insight.severity_score,
            "confidence": f"{round(insight.confidence_score * 100)}%",
            "recommendation": insight.recommendation
        }, indent=2)
    finally:
        session.close()


@tool
def get_feedback_summary() -> str:
    """
    Get a summary of all feedback analyzed.
    Use this when user asks for overview or summary statistics.
    """
    session = get_session()
    try:
        total = session.query(RawFeedback).count()
        sentiments = session.query(CleanedFeedback).all()
        clusters = session.query(Cluster).count()
        insights = session.query(Insight).count()

        pos = sum(1 for s in sentiments if s.sentiment == "positive")
        neg = sum(1 for s in sentiments if s.sentiment == "negative")
        neu = sum(1 for s in sentiments if s.sentiment == "neutral")

        intents = {}
        for s in sentiments:
            intents[s.intent] = intents.get(s.intent, 0) + 1

        return json.dumps({
            "total_feedback": total,
            "sentiment_breakdown": {
                "negative": neg,
                "neutral": neu,
                "positive": pos
            },
            "intent_breakdown": intents,
            "clusters_found": clusters,
            "insights_generated": insights
        }, indent=2)
    finally:
        session.close()


@tool
def filter_by_intent(intent: str) -> str:
    """
    Filter insights by intent type.
    intent can be: bug, complaint, feature_request,
    churn_signal, pricing_feedback, praise, question.
    Use when user asks to see only bugs or only churn signals etc.
    """
    session = get_session()
    try:
        # Find clusters that have majority of this intent
        all_cleaned = session.query(CleanedFeedback).filter_by(
            intent=intent
        ).all()

        if not all_cleaned:
            return f"No feedback found with intent: {intent}"

        cluster_counts = {}
        for cf in all_cleaned:
            maps = session.query(FeedbackClusterMap).filter_by(
                cleaned_id=cf.id
            ).all()
            for m in maps:
                cluster_counts[m.cluster_id] = \
                    cluster_counts.get(m.cluster_id, 0) + 1

        results = []
        for cluster_id, count in sorted(
            cluster_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]:
            cluster = session.query(Cluster).filter_by(
                id=cluster_id
            ).first()
            insight = session.query(Insight).filter_by(
                cluster_id=cluster_id
            ).first()
            if cluster and insight:
                results.append({
                    "problem": cluster.cluster_label,
                    "priority_rank": insight.priority_rank,
                    f"{intent}_feedback_count": count,
                    "root_cause": insight.root_cause
                })

        return json.dumps(results, indent=2)
    finally:
        session.close()