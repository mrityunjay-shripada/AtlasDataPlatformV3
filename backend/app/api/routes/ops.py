from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import ResearchRun, RunEvent, AuditLog, PromptRegistry, Classification, Video
from app.security.auth import get_current_user, require_admin, CurrentUser
from app.services import quota as quota_svc
from app.observability.metrics import snapshot
from app.config import get_settings
import secrets
import json

router = APIRouter(prefix="/api/ops", tags=["ops"])

@router.get("/metrics")
async def metrics(user: CurrentUser = Depends(require_admin)):
    return snapshot()

@router.get("/quota")
async def quota(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return quota_svc.snapshot(db)

@router.get("/events/{run_id}")
async def events(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    rows = db.query(RunEvent).filter_by(run_id=run_id).order_by(RunEvent.id.asc()).all()
    return [
        {
            "stage": r.stage, "event": r.event, "message": r.message,
            "error_code": r.error_code, "duration_ms": r.duration_ms,
            "created_at": r.created_at, "payload": r.payload,
        }
        for r in rows
    ]

@router.get("/audit")
async def audit_tail(limit: int = 50, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return [
        {"actor": r.actor, "action": r.action, "resource": r.resource, "detail": r.detail, "at": r.created_at}
        for r in rows
    ]

@router.get("/prompts")
async def prompts(db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    rows = db.query(PromptRegistry).order_by(PromptRegistry.name, PromptRegistry.version).all()
    return [{"name": r.name, "version": r.version, "active": r.active, "body": r.body[:200]} for r in rows]

@router.get("/slo")
async def slo(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    s = get_settings()
    completed = db.query(ResearchRun).filter_by(status="completed").all()
    quick = [r for r in completed if r.target_records <= 15 and r.started_at and r.completed_at]
    within = 0
    for r in quick:
        secs = (r.completed_at - r.started_at).total_seconds()
        if secs <= s.slo_quick_run_seconds:
            within += 1
    rate = (within / len(quick)) if quick else None
    return {
        "slo_quick_run_seconds": s.slo_quick_run_seconds,
        "quick_runs": len(quick),
        "within_slo": within,
        "slo_rate": rate,
        "target": 0.95,
    }

@router.get("/package/{run_id}")
async def reproducibility_package(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Not found")
    videos = db.query(Video).filter_by(run_id=run_id).all()
    return {
        "schema_version": "atlasdataplatform-v3-package-1",
        "run_id": run_id,
        "research_question": run.research_question,
        "prompt_version": run.prompt_version,
        "analysis_version": run.analysis_version,
        "plan": run.plan_json,
        "video_ids": [v.youtube_id for v in videos],
        "classifications": [
            {
                "youtube_id": v.youtube_id,
                "genre": v.classification.genre if v.classification else None,
                "trope": v.classification.trope if v.classification else None,
                "confidence": v.classification.confidence if v.classification else None,
                "prompt_version": v.classification.prompt_version if v.classification else None,
            }
            for v in videos
        ],
        "analysis": run.analysis_json,
        "report": run.report_json,
        "stats": run.stats_json,
        "cost": run.cost_json,
        "evidence": run.evidence_json,
    }
