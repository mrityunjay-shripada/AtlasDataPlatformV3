from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.db.models import RunEvent

def emit(
    db: Session,
    run_id: str,
    stage: str,
    event: str = "stage",
    message: str | None = None,
    error_code: str | None = None,
    payload: dict | None = None,
    duration_ms: int | None = None,
) -> None:
    db.add(RunEvent(
        run_id=run_id,
        stage=stage,
        event=event,
        message=message,
        error_code=error_code,
        payload=payload,
        duration_ms=duration_ms,
        created_at=datetime.utcnow(),
    ))
    db.commit()
