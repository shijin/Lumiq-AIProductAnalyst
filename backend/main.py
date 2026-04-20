import sys
import os
import csv
import io
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.state import pipeline_state
from backend.pipeline import run_full_pipeline, clear_all_data
from db.init_db import get_session
from db.schema import Insight, Cluster
from agent.lumiq_agent import create_lumiq_agent, chat as agent_chat

from contextlib import asynccontextmanager
from sentence_transformers import SentenceTransformer

# Global preloaded model
_embedder = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload models at startup — not during analysis."""
    global _embedder
    print("Preloading sentence-transformers model...")
    try:
        _embedder = SentenceTransformer('paraphrase-MiniLM-L3-v2')
        print("Model preloaded successfully.")
    except Exception as e:
        print(f"Model preload warning: {e}")
    yield

app = FastAPI(
    title="Lumiq API",
    description="AI Product Analyst Pipeline API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyseRequest(BaseModel):
    sheet_name: str


class SheetURLRequest(BaseModel):
    sheet_url: str


@app.get("/")
def root():
    return {"name": "Lumiq API", "version": "1.0.0", "status": "running"}


# ── Sheet name (existing) ────────────────────────────────────────
@app.post("/api/analyse")
def start_analysis(request: AnalyseRequest):
    if pipeline_state.running:
        raise HTTPException(status_code=409,
            detail="Pipeline already running.")
    if not request.sheet_name.strip():
        raise HTTPException(status_code=400,
            detail="sheet_name cannot be empty.")

    thread = threading.Thread(
        target=run_full_pipeline,
        kwargs={
            "source_type": "sheet_name",
            "sheet_name": request.sheet_name.strip()
        },
        daemon=True
    )
    thread.start()
    return {"message": "Pipeline started", "source": "sheet_name",
            "sheet_name": request.sheet_name.strip()}


# ── CSV upload ───────────────────────────────────────────────────
@app.post("/api/analyse/csv")
async def start_analysis_csv(file: UploadFile = File(...)):
    if pipeline_state.running:
        raise HTTPException(status_code=409,
            detail="Pipeline already running.")

    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400,
            detail="Only CSV files are supported.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400,
            detail="Uploaded file is empty.")

    thread = threading.Thread(
        target=run_full_pipeline,
        kwargs={
            "source_type": "csv",
            "csv_content": content,
            "csv_filename": file.filename
        },
        daemon=True
    )
    thread.start()
    return {"message": "Pipeline started", "source": "csv",
            "filename": file.filename}


# ── Public Google Sheet URL ──────────────────────────────────────
@app.post("/api/analyse/sheet-url")
def start_analysis_sheet_url(request: SheetURLRequest):
    if pipeline_state.running:
        raise HTTPException(status_code=409,
            detail="Pipeline already running.")

    if "docs.google.com/spreadsheets" not in request.sheet_url:
        raise HTTPException(status_code=400,
            detail="Please provide a valid Google Sheets URL.")

    thread = threading.Thread(
        target=run_full_pipeline,
        kwargs={
            "source_type": "sheet_url",
            "sheet_url": request.sheet_url.strip()
        },
        daemon=True
    )
    thread.start()
    return {"message": "Pipeline started", "source": "sheet_url"}


# ── Status ───────────────────────────────────────────────────────
@app.get("/api/status")
def get_status():
    return pipeline_state.to_dict()


# ── Insights ─────────────────────────────────────────────────────
@app.get("/api/insights")
def get_insights():
    session = get_session()
    try:
        insights = session.query(Insight).order_by(
            Insight.priority_rank).all()
        result = []
        for ins in insights:
            cluster = session.query(Cluster).filter_by(
                id=ins.cluster_id).first()
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


# ── Export CSV ───────────────────────────────────────────────────
@app.get("/api/export")
def export_insights():
    session = get_session()
    try:
        insights = session.query(Insight).order_by(
            Insight.priority_rank).all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Priority Rank", "Cluster", "Feedback Count",
            "Root Cause", "Recommendation", "Impact Score",
            "Frequency Score", "Severity Score",
            "Confidence Score", "Evidence"
        ])
        for ins in insights:
            cluster = session.query(Cluster).filter_by(
                id=ins.cluster_id).first()
            writer.writerow([
                ins.priority_rank,
                cluster.cluster_label if cluster else "",
                cluster.feedback_count if cluster else 0,
                ins.root_cause, ins.recommendation,
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
            headers={"Content-Disposition":
                     "attachment; filename=lumiq_insights.csv"}
        )
    finally:
        session.close()


# ── Reset ────────────────────────────────────────────────────────
@app.delete("/api/reset")
def reset_data():
    if pipeline_state.running:
        raise HTTPException(status_code=409,
            detail="Cannot reset while pipeline is running.")
    clear_all_data()
    return {"message": "All data cleared successfully."}


# Create agent once at startup
lumiq_agent = create_lumiq_agent()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

@app.post("/api/chat")
def chat_with_agent(request: ChatRequest):
    """
    Conversational interface with the Lumiq agent.
    The agent decides which tools to call based on the message.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    try:
        response = agent_chat(lumiq_agent, request.message)
        return ChatResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0",
                port=8000, reload=True)