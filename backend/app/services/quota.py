from datetime import datetime
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.models import QuotaLedger

def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")

def get_ledger(db: Session) -> QuotaLedger:
    day = _today()
    row = db.query(QuotaLedger).filter_by(day=day).first()
    if not row:
        row = QuotaLedger(day=day, youtube_units=0, gemini_calls=0, groq_calls=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row

def remaining_youtube(db: Session) -> int:
    s = get_settings()
    row = get_ledger(db)
    return max(0, s.youtube_daily_unit_budget - row.youtube_units)

def can_spend_youtube(db: Session, units: int) -> bool:
    return remaining_youtube(db) >= units

def record_youtube(db: Session, units: int) -> None:
    row = get_ledger(db)
    row.youtube_units += units
    row.updated_at = datetime.utcnow()
    db.commit()

def record_llm(db: Session, provider: str) -> None:
    row = get_ledger(db)
    if provider == "gemini":
        row.gemini_calls += 1
    elif provider == "groq":
        row.groq_calls += 1
    row.updated_at = datetime.utcnow()
    db.commit()

def snapshot(db: Session) -> dict:
    s = get_settings()
    row = get_ledger(db)
    return {
        "day": row.day,
        "youtube_units": row.youtube_units,
        "youtube_budget": s.youtube_daily_unit_budget,
        "youtube_remaining": max(0, s.youtube_daily_unit_budget - row.youtube_units),
        "gemini_calls": row.gemini_calls,
        "groq_calls": row.groq_calls,
    }
