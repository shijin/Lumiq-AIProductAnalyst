from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _get_db_state():
    """Try to load state from Supabase."""
    try:
        from db.init_db import get_session
        from sqlalchemy import text
        session = get_session()
        try:
            result = session.execute(text(
                "SELECT state_data FROM pipeline_state WHERE id = 1"
            ))
            row = result.fetchone()
            if row:
                return json.loads(row[0])
        finally:
            session.close()  # ← always close
    except Exception:
        pass
    return None


def _save_db_state(state_dict: dict):
    """Save state to Supabase."""
    try:
        from db.init_db import get_session
        from sqlalchemy import text
        session = get_session()
        try:
            session.execute(text("""
                INSERT INTO pipeline_state (id, state_data, updated_at)
                VALUES (1, :data, NOW())
                ON CONFLICT (id) DO UPDATE
                SET state_data = :data, updated_at = NOW()
            """), {"data": json.dumps(state_dict)})
            session.commit()
        finally:
            session.close()  # ← always close
    except Exception as e:
        print(f"State save warning: {e}")


@dataclass
class PipelineState:
    running: bool = False
    current_step: str = ""
    progress: int = 0
    total_steps: int = 9
    completed_steps: list = field(default_factory=list)
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    sheet_name: Optional[str] = None

    def start(self, sheet_name: str):
        self.running = True
        self.current_step = "Starting pipeline..."
        self.progress = 0
        self.completed_steps = []
        self.error = None
        self.started_at = datetime.now().isoformat()
        self.completed_at = None
        self.sheet_name = sheet_name

    def update(self, step: str, progress: int):
        self.current_step = step
        self.progress = progress
        self.completed_steps.append(step)

    def complete(self):
        self.running = False
        self.current_step = "Analysis complete"
        self.progress = 100
        self.completed_at = datetime.now().isoformat()

    def fail(self, error: str):
        self.running = False
        self.error = error
        self.current_step = "Pipeline failed"

    def to_dict(self):
        return {
            "running": self.running,
            "current_step": self.current_step,
            "progress": self.progress,
            "completed_steps": self.completed_steps,
            "error": self.error,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "sheet_name": self.sheet_name
        }


# Global singleton
pipeline_state = PipelineState()