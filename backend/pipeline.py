import sys
import os

# Add project root to path so we can import existing modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.state import pipeline_state
from db.init_db import get_session
from db.schema import (
    RawFeedback, CleanedFeedback,
    Cluster, FeedbackClusterMap, Insight
)


def clear_all_data():
    """Clear all tables before fresh analysis."""
    session = get_session()
    try:
        session.query(Insight).delete()
        session.query(FeedbackClusterMap).delete()
        session.query(Cluster).delete()
        session.query(CleanedFeedback).delete()
        session.query(RawFeedback).delete()
        session.commit()
        print("All tables cleared.")
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def run_full_pipeline(sheet_name: str):
    """
    Run all 9 pipeline modules in sequence.
    Updates pipeline_state at each step for frontend polling.
    """
    try:
        pipeline_state.start(sheet_name)

        # ── Step 1: Clear existing data ──────────────────────────
        pipeline_state.update("Clearing existing data...", 5)
        clear_all_data()

        # ── Step 2: Ingest from Google Sheets ────────────────────
        pipeline_state.update("Ingesting feedback from Google Sheets...", 15)
        os.environ["GOOGLE_SHEET_NAME"] = sheet_name
        from ingestion.ingest import ingest_from_google_sheets
        ingest_from_google_sheets()

        # ── Step 3: Preprocessing (translate + intent) ───────────
        pipeline_state.update("Detecting languages and translating...", 30)
        from preprocessing.preprocessor import preprocess_all
        preprocess_all()

        # ── Step 4: Cleaning + sentiment ─────────────────────────
        pipeline_state.update("Cleaning feedback and detecting sentiment...", 45)
        from cleaning.cleaner import clean_all
        clean_all()

        # ── Step 5: Clustering ────────────────────────────────────
        pipeline_state.update("Clustering similar feedback...", 60)
        from clustering.clusterer import cluster_all
        cluster_all()

        # ── Step 6: Root cause analysis ───────────────────────────
        pipeline_state.update("Analyzing root causes with AI...", 75)
        from reasoning.analyzer import analyze_all_clusters
        analyze_all_clusters()

        # ── Step 7: Scoring + prioritization ─────────────────────
        pipeline_state.update("Scoring and prioritizing insights...", 88)
        from scoring.prioritizer import prioritize_all
        prioritize_all()

        # ── Step 8: Insight generation ────────────────────────────
        pipeline_state.update("Generating actionable recommendations...", 95)
        from output.reporter import generate_all_insights
        generate_all_insights()

        # ── Done ──────────────────────────────────────────────────
        pipeline_state.complete()
        print("Pipeline completed successfully.")

    except Exception as e:
        pipeline_state.fail(str(e))
        print(f"Pipeline failed: {e}")
        raise e