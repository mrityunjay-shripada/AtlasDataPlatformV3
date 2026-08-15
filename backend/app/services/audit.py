from datetime import datetime
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.db.models import AuditLog

def audit(
    db: Session,
    actor: str,
    action: str,
    resource: str | None = None,
    detail: dict | None = None,
    ip: str | None = None,
) -> None:
    db.add(AuditLog(
        actor=actor,
        action=action,
        resource=resource,
        detail=detail,
        ip=ip,
        created_at=datetime.utcnow(),
    ))
    db.commit()
