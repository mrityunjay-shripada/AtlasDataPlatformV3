
"""Phase 5 — Pulse, Refresh, Monitoring.

Honest empty states when history is insufficient.
Refresh creates a new run_kind=refresh under the same study/corpus.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Monitor, MonitorEvent, ResearchRun, ResearchStudy
from app.services.analytics_engine import build_compare_payload
from app.services.study_service import attach_run_to_study, ensure_default_study

logger = logging.getLogger(__name__)



def collect_study_observations(db: Session, study_id: str) -> list[dict]:
    """Observations = completed runs, plus per-batch snapshots on each run (Next batch)."""
    runs = list_study_runs(db, study_id)
    series: list[dict] = []
    for r in runs:
        plan = r.plan_json or {}
        snaps = list(plan.get("observations") or [])
        if snaps:
            for o in snaps:
                series.append({
                    "run_id": r.id,
                    "run_kind": o.get("run_kind") or getattr(r, "run_kind", None) or "seed",
                    "batch_index": o.get("batch_index"),
                    "n": o.get("n") or r.collected_count,
                    "completed_at": o.get("completed_at"),
                    "top_genre": o.get("top_genre"),
                    "top_genre_share": o.get("top_genre_share"),
                    "mean_views": o.get("mean_views"),
                    "source": "batch_snapshot",
                })
        else:
            a = r.analysis_json or {}
            genres = a.get("genre_distribution") or {}
            total = sum(int(v) for v in genres.values()) or 1
            top = max(genres.items(), key=lambda x: int(x[1])) if genres else ("—", 0)
            eng = (a.get("performance") or {}).get("summary") or a.get("engagement_stats") or {}
            series.append({
                "run_id": r.id,
                "run_kind": getattr(r, "run_kind", None) or "seed",
                "batch_index": (plan.get("batch_index") or 1),
                "n": r.collected_count,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "top_genre": top[0],
                "top_genre_share": round(int(top[1]) / total, 4),
                "mean_views": eng.get("mean_views"),
                "mean_engagement_proxy": eng.get("mean_engagement_proxy"),
                "source": "run",
            })
    # stable order
    series.sort(key=lambda x: (str(x.get("completed_at") or ""), int(x.get("batch_index") or 0)))
    return series


def list_study_runs(db: Session, study_id: str) -> list[ResearchRun]:
    return (
        db.query(ResearchRun)
        .filter(ResearchRun.study_id == study_id, ResearchRun.status.in_(["completed", "partial"]))
        .order_by(ResearchRun.completed_at.asc())
        .all()
    )


def build_pulse(db: Session, study_id: str) -> dict[str, Any]:
    runs = list_study_runs(db, study_id)
    observations = collect_study_observations(db, study_id)
    if len(observations) < 2 and len(runs) < 2:
        return {
            "status": "insufficient_data",
            "message": (
                "We need at least two complete batches on this study before a pulse comparison is useful. "
                "Run Next batch again, or start another run in the same study."
            ),
            "observation_count": len(runs),
            "runs": [{"run_id": r.id, "n": r.collected_count, "completed_at": r.completed_at, "run_kind": getattr(r, "run_kind", None)} for r in runs],
            "series": [],
        }

    if observations and len(observations) >= 2:
        return {
            "status": "ok",
            "message": f"Comparing {len(observations)} batches in this study.",
            "observation_count": len(observations),
            "runs": observations,
            "series": observations,
            "note": "Based on successive batches in this study — descriptive only, not a market forecast.",
        }

    series = []
    for r in runs:
        a = r.analysis_json or {}
        genres = a.get("genre_distribution") or {}
        total = sum(int(v) for v in genres.values()) or 1
        top = max(genres.items(), key=lambda x: int(x[1])) if genres else ("—", 0)
        eng = (a.get("performance") or {}).get("summary") or a.get("engagement_stats") or {}
        series.append({
            "run_id": r.id,
            "run_kind": getattr(r, "run_kind", None) or "seed",
            "n": r.collected_count,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "top_genre": top[0],
            "top_genre_share": round(int(top[1]) / total, 4),
            "mean_views": eng.get("mean_views"),
            "mean_engagement_proxy": eng.get("mean_engagement_proxy"),
        })

    first, last = runs[0], runs[-1]
    compare = build_compare_payload(
        {"run_id": first.id, "n": first.collected_count, "question": first.research_question},
        {"run_id": last.id, "n": last.collected_count, "question": last.research_question},
        first.analysis_json or {},
        last.analysis_json or {},
    )
    return {
        "status": "ok",
        "message": f"Pulse across {len(runs)} observations in this study (descriptive, not causal).",
        "observation_count": len(runs),
        "runs": series,
        "series": series,
        "first_vs_last": compare,
        "note": "Figures describe successive samples under this study — not a market forecast.",
    }


def queue_refresh_run(db: Session, study_id: str, user: str = "admin") -> dict[str, Any]:
    """Create a refresh run from the latest seed/batch question + methodology."""
    settings = get_settings()
    study = db.query(ResearchStudy).filter_by(id=study_id).first()
    if not study:
        return {"error": "study_not_found"}

    latest = (
        db.query(ResearchRun)
        .filter(ResearchRun.study_id == study_id)
        .order_by(ResearchRun.started_at.desc())
        .first()
    )
    if not latest:
        return {"error": "no_runs", "message": "Study has no runs to refresh."}

    # Reuse question and target from latest
    run = ResearchRun(
        id=str(uuid4()),
        research_question=latest.research_question,
        status="queued",
        stage_checkpoint="queued",
        target_records=min(latest.target_records or 15, settings.max_videos_per_run),
        stats_json={},
        run_kind="refresh",
        parent_run_id=latest.id,
        created_by=user,
        prompt_version=settings.prompt_version,
        analysis_version=settings.analysis_version,
    )
    db.add(run)
    db.commit()
    attach_run_to_study(db, run, owner=user, parent_run_id=latest.id, run_kind="refresh")
    # ensure study/corpus from parent
    run.study_id = study_id
    run.corpus_id = latest.corpus_id
    run.methodology_id = latest.methodology_id
    db.add(run)
    db.commit()
    return {
        "status": "queued",
        "run_id": run.id,
        "run_kind": "refresh",
        "parent_run_id": latest.id,
        "study_id": study_id,
        "message": "Refresh run queued — same question under this research study.",
    }


def ensure_monitor(db: Session, study_id: str, name: str = "Study monitor") -> Monitor:
    m = db.query(Monitor).filter_by(study_id=study_id).first()
    if not m:
        m = Monitor(id=str(uuid4()), study_id=study_id, name=name, enabled=True, cadence_hours=24)
        db.add(m)
        db.commit()
        db.refresh(m)
    return m


def monitor_status(db: Session, study_id: str) -> dict[str, Any]:
    runs = list_study_runs(db, study_id)
    m = db.query(Monitor).filter_by(study_id=study_id).first()
    events = []
    if m:
        events = (
            db.query(MonitorEvent)
            .filter_by(monitor_id=m.id)
            .order_by(MonitorEvent.created_at.desc())
            .limit(20)
            .all()
        )
    capable = len(runs) >= 1
    pulse_ready = len(runs) >= 2
    return {
        "study_id": study_id,
        "monitor": None if not m else {
            "id": m.id,
            "name": m.name,
            "enabled": m.enabled,
            "cadence_hours": m.cadence_hours,
            "last_refresh_at": m.last_refresh_at,
        },
        "capability": {
            "refresh": capable,
            "pulse": pulse_ready,
            "continuous": False,  # scheduled worker not claimed operational
        },
        "message": (
            "Monitoring interface is available. "
            + ("Pulse ready." if pulse_ready else "Pulse needs ≥2 completed runs.")
            + " Automatic scheduled refresh is not enabled on free-tier worker yet — use Refresh manually."
        ),
        "observation_count": len(runs),
        "events": [
            {"type": e.event_type, "message": e.message, "created_at": e.created_at, "payload": e.payload_json}
            for e in events
        ],
    }


def log_monitor_event(db: Session, monitor_id: str, event_type: str, message: str, payload: dict | None = None) -> None:
    db.add(MonitorEvent(
        monitor_id=monitor_id,
        event_type=event_type,
        message=message,
        payload_json=payload,
    ))
    db.commit()
