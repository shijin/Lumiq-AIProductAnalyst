from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class PipelineState:
    running: bool = False
    current_step: str = ""
    progress: int = 0          # 0-100
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


# Global singleton — one analysis at a time
pipeline_state = PipelineState()