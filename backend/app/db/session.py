from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings

settings = get_settings()
url = settings.database_url.replace("postgres://", "postgresql://", 1)
# Neon pooler-friendly: pre_ping + small pool for free tiers
engine = create_engine(
    url,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=2,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.db import models  # noqa: F401
    from app.db.v3_schema import ensure_v3_schema
    ensure_v3_schema()
    db = SessionLocal()
    try:
        from app.security.auth import ensure_bootstrap_admin
        from app.services.prompts import seed_prompts
        from app.services.study_service import ensure_default_study, backfill_orphan_runs
        ensure_bootstrap_admin(db)
        seed_prompts(db)
        ensure_default_study(db)
        n = backfill_orphan_runs(db)
        if n:
            import logging
            logging.getLogger("atlas-v3").info("backfilled %s runs into default study", n)
    finally:
        db.close()
