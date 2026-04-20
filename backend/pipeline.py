import sys
import os
import threading
import atexit

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.state import pipeline_state
from db.init_db import get_session
from db.schema import (
    RawFeedback, CleanedFeedback,
    Cluster, FeedbackClusterMap, Insight
)


def clear_all_data():
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


def run_full_pipeline(
    source_type: str,           # 'sheet_name' | 'csv' | 'sheet_url'
    sheet_name: str = None,
    csv_content: bytes = None,
    csv_filename: str = None,
    sheet_url: str = None,
):
    """
    Run all pipeline modules in sequence.
    Supports three input types:
    - sheet_name: existing Google Sheets integration
    - csv: uploaded CSV file bytes
    - sheet_url: public Google Sheet URL
    """
    try:
        if source_type == "sheet_name":
            display_name = sheet_name
        elif source_type == "csv":
            display_name = csv_filename.replace('.csv', '') if csv_filename else "CSV Upload"
        elif source_type == "sheet_url":
            # Extract a friendly name from the URL
            display_name = "Google Sheet"
        else:
            display_name = "Unknown Source"
        pipeline_state.start(display_name)

        # Register cleanup — if server restarts mid-pipeline,
        # user sees a clear error instead of silent reset to 0%
        def on_unexpected_exit():
            if pipeline_state.running:
                pipeline_state.fail(
                    "Server restarted during analysis. "
                    "Please run the analysis again — "
                    "it will be faster now."
                )

        atexit.register(on_unexpected_exit)

        # ── Step 1: Clear existing data ──────────────────────────
        pipeline_state.update("Clearing existing data...", 5)
        clear_all_data()

        # ── Step 2: Ingest ────────────────────────────────────────
        pipeline_state.update("Ingesting feedback...", 15)

        if source_type == "sheet_name":
            os.environ["GOOGLE_SHEET_NAME"] = sheet_name
            from ingestion.ingest import ingest_from_google_sheets
            ingest_from_google_sheets()

        elif source_type == "csv":
            from ingestion.ingest import ingest_from_csv_file
            ingest_from_csv_file(csv_content, csv_filename)

        elif source_type == "sheet_url":
            from ingestion.ingest import ingest_from_public_sheet_url
            ingest_from_public_sheet_url(sheet_url)

        else:
            raise ValueError(f"Unknown source_type: {source_type}")

        # ── Step 3: Preprocessing ─────────────────────────────────
        pipeline_state.update("Detecting languages and translating...", 30)
        from preprocessing.preprocessor import preprocess_all
        preprocess_all()

        # ── Step 4: Cleaning ──────────────────────────────────────
        pipeline_state.update("Cleaning feedback and detecting sentiment...", 45)
        from cleaning.cleaner import clean_all
        clean_all()

        # ── Step 5: Clustering ────────────────────────────────────
        pipeline_state.update("Clustering similar feedback...", 60)
        from clustering.clusterer import cluster_all
        cluster_all()

        # ── Step 6: Root cause ────────────────────────────────────
        pipeline_state.update("Analyzing root causes with AI...", 75)
        from reasoning.analyzer import analyze_all_clusters
        analyze_all_clusters()

        # ── Step 7: Scoring ───────────────────────────────────────
        pipeline_state.update("Scoring and prioritizing insights...", 88)
        from scoring.prioritizer import prioritize_all
        prioritize_all()

        # ── Step 8: Insights ──────────────────────────────────────
        pipeline_state.update("Generating actionable recommendations...", 95)
        from output.reporter import generate_all_insights
        generate_all_insights()

        pipeline_state.complete()
        print("Pipeline completed successfully.")

    except Exception as e:
        pipeline_state.fail(str(e))
        print(f"Pipeline failed: {e}")
        raise e