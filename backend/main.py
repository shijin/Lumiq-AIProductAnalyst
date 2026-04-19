import sys
import os
import csv
import io
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.state import pipeline_state
from backend.pipeline import run_full_pipeline
from db.init_db import get_session
from db.schema import Insight, Cluster


# ── App setup ────────────────────────────────────────────────────
app = FastAPI(
    title="Lumiq API",
    description="AI Product Analyst — Pipeline API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ───────────────────────────────────────────────
class AnalyseRequest(BaseModel):
    sheet_name: str             # exact Google Sheet name


# ── Routes ───────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "name": "Lumiq API",
        "version": "1.0.0",
        "status": "running"
    }


@app.post("/api/analyse")
def start_analysis(request: AnalyseRequest):
    """
    Trigger the full pipeline for a given Google Sheet name.
    Runs asynchronously — poll /api/status for progress.
    """
    if pipeline_state.running:
        raise HTTPException(
            status_code=409,
            detail="Pipeline is already running. Wait for it to complete."
        )

    if not request.sheet_name.strip():
        raise HTTPException(
            status_code=400,
            detail="sheet_name cannot be empty."
        )

    # Run pipeline in background thread
    thread = threading.Thread(
        target=run_full_pipeline,
        args=(request.sheet_name.strip(),),
        daemon=True
    )
    thread.start()

    return {
        "message": "Pipeline started",
        "sheet_name": request.sheet_name.strip()
    }


@app.get("/api/status")
def get_status():
    """Poll this endpoint for pipeline progress."""
    return pipeline_state.to_dict()


@app.get("/api/insights")
def get_insights():
    """Return all insights with cluster info for frontend refresh."""
    session = get_session()
    try:
        insights = session.query(Insight).order_by(
            Insight.priority_rank
        ).all()

        result = []
        for ins in insights:
            cluster = session.query(Cluster).filter_by(
                id=ins.cluster_id
            ).first()

            result.append({
                "id": ins.id,
                "cluster_id": ins.cluster_id,
                "cluster_label": cluster.cluster_label if cluster else "",
                "feedback_count": cluster.feedback_count if cluster else 0,
                "root_cause": ins.root_cause,
                "recommendation": ins.recommendation,
                "impact_score": ins.impact_score,
                "frequency_score": ins.frequency_score,
                "severity_score": ins.severity_score,
                "confidence_score": ins.confidence_score,
                "priority_rank": ins.priority_rank,
                "evidence": ins.evidence,
            })

        return {"insights": result, "total": len(result)}

    finally:
        session.close()


@app.get("/api/export")
def export_insights():
    """Download all insights as a CSV file."""
    session = get_session()
    try:
        insights = session.query(Insight).order_by(
            Insight.priority_rank
        ).all()

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "Priority Rank",
            "Cluster",
            "Feedback Count",
            "Root Cause",
            "Recommendation",
            "Impact Score",
            "Frequency Score",
            "Severity Score",
            "Confidence Score",
            "Evidence"
        ])

        # Rows
        for ins in insights:
            cluster = session.query(Cluster).filter_by(
                id=ins.cluster_id
            ).first()
            writer.writerow([
                ins.priority_rank,
                cluster.cluster_label if cluster else "",
                cluster.feedback_count if cluster else 0,
                ins.root_cause,
                ins.recommendation,
                round(ins.impact_score or 0, 3),
                round(ins.frequency_score or 0, 3),
                round(ins.severity_score or 0, 3),
                round(ins.confidence_score or 0, 3),
                ins.evidence,
            ])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=lumiq_insights.csv"
            }
        )

    finally:
        session.close()


@app.delete("/api/reset")
def reset_data():
    """Clear all pipeline data. Called before new analysis."""
    if pipeline_state.running:
        raise HTTPException(
            status_code=409,
            detail="Cannot reset while pipeline is running."
        )
    from backend.pipeline import clear_all_data
    clear_all_data()
    return {"message": "All data cleared successfully."}


# ── Run ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )