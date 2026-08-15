from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.models import RateLimitBucket

def check_rate_limit(db: Session, key: str) -> tuple[bool, int]:
    """Return (allowed, remaining). Window = 60 seconds."""
    s = get_settings()
    limit = s.rate_limit_per_minute
    now = datetime.utcnow()
    window = now.replace(second=0, microsecond=0)
    row = db.query(RateLimitBucket).filter_by(bucket_key=key).first()
    if not row or row.window_start < window:
        if row:
            row.window_start = window
            row.count = 1
        else:
            db.add(RateLimitBucket(bucket_key=key, window_start=window, count=1))
        db.commit()
        return True, limit - 1
    if row.count >= limit:
        return False, 0
    row.count += 1
    db.commit()
    return True, limit - row.count
