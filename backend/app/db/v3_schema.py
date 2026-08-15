"""V3 Phase 0–1 schema helpers: create new tables + safe ALTERs for existing DBs."""
from __future__ import annotations

import logging
from sqlalchemy import text
from app.db.session import engine, Base

logger = logging.getLogger(__name__)

ALTERS = [
    "ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS study_id VARCHAR(36)",
    "ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS corpus_id VARCHAR(36)",
    "ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS methodology_id VARCHAR(36)",
    "ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS parent_run_id VARCHAR(36)",
    "ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS run_kind VARCHAR(32) DEFAULT 'seed'",
]


def ensure_v3_schema() -> None:
    # Import models so metadata is complete
    from app.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for stmt in ALTERS:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                logger.warning("schema alter skipped: %s (%s)", stmt, e)
        for stmt in (
            "CREATE INDEX IF NOT EXISTS ix_runs_study ON research_runs (study_id)",
            "CREATE INDEX IF NOT EXISTS ix_runs_corpus ON research_runs (corpus_id)",
            "CREATE INDEX IF NOT EXISTS ix_claims_run ON claims (run_id)",
            "CREATE INDEX IF NOT EXISTS ix_claims_study ON claims (study_id)",
            "CREATE INDEX IF NOT EXISTS ix_monitors_study ON monitors (study_id)",
        ):
            try:
                conn.execute(text(stmt))
            except Exception as e:
                logger.warning("index skipped: %s (%s)", stmt, e)
    logger.info("V3 schema ensure complete")
