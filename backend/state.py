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
        result = session.execute(text(
            "SELECT state_data FROM pipeline_state WHERE id = 1"
        ))
        row = result.fetchone()
        session.close()
        if row:
            return json.loads(row[0])
    except Exception:
        pass
    return None


def _save_db_state(state_dict: dict):
    """Save state to Supabase."""
    try:
        from db.init_db import get_session
        from sqlalchemy import text
        session = get_session()
        session.execute(text("""
            INSERT INTO pipeline_state (id, state_data, updated_at)
            VALUES (1, :data, NOW())
            ON CONFLICT (id) DO UPDATE
            SET state_data = :data, updated_at = NOW()
        """), {"data": json.dumps(state_dict)})
        session.commit()
        session.close()
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
        self._persist()

    def update(self, step: str, progress: int):
        self.current_step = step
        self.progress = progress
        self.completed_steps.append(step)
        self._persist()

    def complete(self):
        self.running = False
        self.current_step = "Analysis complete"
        self.progress = 100
        self.completed_at = datetime.now().isoformat()
        self._persist()

    def fail(self, error: str):
        self.running = False
        self.error = error
        self.current_step = "Pipeline failed"
        self._persist()

    def _persist(self):
        """Save current state to Supabase."""
        _save_db_state(self.to_dict())

    def load_from_db(self):
        """Load state from Supabase on startup."""
        data = _get_db_state()
        if data:
            self.running = False  # Never resume as running after restart
            self.current_step = data.get("current_step", "")
            self.progress = data.get("progress", 0)
            self.completed_steps = data.get("completed_steps", [])
            self.error = "Server restarted during analysis. Please run again."
            self.started_at = data.get("started_at")
            self.completed_at = data.get("completed_at")
            self.sheet_name = data.get("sheet_name")

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
pipeline_state.load_from_db()  # Load persisted state on startup