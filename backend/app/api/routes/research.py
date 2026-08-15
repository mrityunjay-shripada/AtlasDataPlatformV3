from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4
import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.models import Classification, ClassificationCache, ResearchRun, Video
from app.db.session import get_db
from app.security.auth import get_current_user, require_admin, CurrentUser
from app.services.audit import audit
from app.services.rate_limit import check_rate_limit
from app.services import quota as quota_svc
from app.observability.metrics import incr
from app.services.pipeline import ACTIVE, classify_one

router = APIRouter(prefix="/api/research", tags=["research"])

class StartReq(BaseModel):
    research_question: str = Field(
        default="Analyze YouTube micro-dramas for storytelling patterns, genre saturation, and whitespace."
    )
    target_records: int = Field(default=30, ge=5, le=50)
    preset: Optional[str] = Field(default=None, description="quick|standard|deep")

PRESETS = {"quick": 15, "standard": 30, "deep": 50}

def _budget(db: Session) -> dict:
    s = get_settings()
    hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent = db.query(ResearchRun).filter(ResearchRun.started_at >= hour_ago).count()
    active = db.query(ResearchRun).filter(ResearchRun.status.in_(list(ACTIVE))).count()
    return {
        "runs_this_hour": recent,
        "max_runs_per_hour": s.max_runs_per_hour,
        "active_runs": active,
        "max_concurrent_runs": s.max_concurrent_runs,
        "max_videos_per_run": s.max_videos_per_run,
        "runs_remaining_hour": max(0, s.max_runs_per_hour - recent),
        "est_youtube_search_units_per_30": "~100-150 (rough)",
    }

@router.get("/preflight")
async def preflight(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Fail-fast checks before starting a run."""
    s = get_settings()
    issues = []
    if not s.gemini_api_key:
        issues.append({"code": "auth", "message": "GEMINI_API_KEY missing"})
    if not s.groq_api_key:
        issues.append({"code": "auth", "message": "GROQ_API_KEY missing"})
    if not s.youtube_api_key:
        issues.append({"code": "auth", "message": "YOUTUBE_API_KEY missing"})
    try:
        db.query(ResearchRun).limit(1).all()
        db_ok = True
    except Exception as e:
        db_ok = False
        issues.append({"code": "db", "message": f"Database unreachable: {e}"})
    budget = _budget(db)
    if budget["runs_remaining_hour"] <= 0:
        issues.append({"code": "timeout", "message": "Hourly run limit reached"})
    if budget["active_runs"] >= s.max_concurrent_runs:
        issues.append({"code": "timeout", "message": "Concurrent run slot full"})
    return {
        "ok": len(issues) == 0,
        "database": "ok" if db_ok else "error",
        "issues": issues,
        "budget": budget,
        "warnings": (
            ["Deep preset (50) may hit time budget on free Render — prefer Standard."]
            if True else []
        ),
    }

@router.get("/budget")
async def budget(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _budget(db)


@router.get("/quota")
async def research_quota(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Pink-error fix: UI calls /api/research/quota; mirror ops quota snapshot."""
    return quota_svc.snapshot(db)


@router.post("/start")
async def start(req: StartReq, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    s = get_settings()
    allowed, remaining = check_rate_limit(db, f"start:{user.username}")
    if not allowed:
        raise HTTPException(429, detail={"code": "timeout", "message": "Rate limit exceeded"})
    # inline preflight
    if not s.gemini_api_key or not s.groq_api_key or not s.youtube_api_key:
        raise HTTPException(400, detail={"code": "auth", "message": "Missing API keys on server"})
    target = PRESETS.get(req.preset or "", req.target_records)
    target = min(max(target, 5), s.max_videos_per_run)
    budget = _budget(db)
    if budget["active_runs"] >= s.max_concurrent_runs:
        raise HTTPException(429, detail={"code": "timeout", "message": f"Max concurrent runs ({s.max_concurrent_runs}) reached"})
    if budget["runs_remaining_hour"] <= 0:
        raise HTTPException(429, detail={"code": "timeout", "message": f"Hourly limit ({s.max_runs_per_hour}) reached"})

    run = ResearchRun(
        id=str(uuid4()),
        research_question=req.research_question,
        status="queued",
        stage_checkpoint="queued",
        target_records=target,
        stats_json={},
        run_kind="seed",
    )
    run.created_by = user.username
    run.prompt_version = s.prompt_version
    run.analysis_version = s.analysis_version
    db.add(run)
    db.commit()
    try:
        from app.services.study_service import attach_run_to_study
        attach_run_to_study(db, run, owner=user.username, run_kind="seed")
    except Exception:
        pass
    audit(db, user.username, "start_run", resource=run.id, detail={"target": target})
    incr("runs.started")
    return {
        "run_id": run.id,
        "status": "queued",
        "target_records": target,
        "preset": req.preset,
        "budget": budget,
        "warning": (
            "Deep preset may hit time budget or sleep on free Render."
            if req.preset == "deep" or target >= 50 else None
        ),
        "message": "Queued. Postgres worker will pick this up shortly.",
    }

@router.get("/status/{run_id}")
async def status(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    stats = run.stats_json or {}
    plan = run.plan_json or {}
    cursors = plan.get("search_cursors") or {}
    more_pages = any(v not in (None, "") for v in cursors.values()) if cursors else bool(stats.get("more_pages_available"))
    # If no cursors yet (first page only ran with old code), still allow next batch attempt
    can_next = run.status in ("completed", "partial", "failed") and bool(plan.get("search_queries") or plan)
    return {
        "run_id": run.id,
        "status": run.status,
        "stage_checkpoint": run.stage_checkpoint,
        "research_question": run.research_question,
        "target_records": run.target_records,
        "collected_count": run.collected_count,
        "classified_count": run.classified_count,
        "error_message": run.error_message,
        "error_code": run.error_code,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "resumable": run.status in ("failed", "partial") or run.status in ACTIVE,
        "stats": stats,
        "cache": {
            "classification_hits": stats.get("classification_cache_hits", 0),
            "classifications_new": stats.get("classifications_new", 0),
            "videos_added": stats.get("videos_added", 0),
        },
        "pagination": {
            "batch_index": int(plan.get("batch_index") or 1),
            "more_pages_available": more_pages,
            "can_next_batch": can_next,
            "pages_fetched": stats.get("pages_fetched", 0),
            "skipped_dupes": stats.get("skipped_dupes", 0),
        },
        "study_id": getattr(run, "study_id", None),
        "corpus_id": getattr(run, "corpus_id", None),
        "methodology_id": getattr(run, "methodology_id", None),
        "run_kind": getattr(run, "run_kind", None) or "seed",
        "parent_run_id": getattr(run, "parent_run_id", None),
    }

@router.get("/runs")
async def runs(limit: int = Query(20, le=50), db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    rows = db.query(ResearchRun).order_by(ResearchRun.started_at.desc()).limit(limit).all()
    return [
        {
            "run_id": r.id,
            "status": r.status,
            "error_code": r.error_code,
            "research_question": r.research_question[:120],
            "collected_count": r.collected_count,
            "classified_count": r.classified_count,
            "started_at": r.started_at,
            "completed_at": r.completed_at,
        }
        for r in rows
    ]

@router.get("/dataset/{run_id}")
async def dataset(
    run_id: str,
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Not found")
    videos = db.query(Video).filter_by(run_id=run_id).all()
    records, low = [], 0
    for v in videos:
        conf = v.classification.confidence if v.classification else None
        if conf is not None and conf < min_confidence:
            low += 1
            continue
        d = {
            "id": v.youtube_id,
            "title": v.title,
            "channel": v.channel,
            "views": v.views,
            "likes": v.likes,
            "comments": v.comments,
            "duration_seconds": v.duration_seconds,
            "source_url": v.source_url,
        }
        if v.classification:
            d.update({
                "genre": v.classification.genre,
                "trope": v.classification.trope,
                "emotion": v.classification.emotion,
                "hook": v.classification.hook,
                "confidence": v.classification.confidence,
            })
        records.append(d)
    return {
        "run_id": run_id,
        "record_count": len(records),
        "filtered_low_confidence": low,
        "min_confidence": min_confidence,
        "source": "youtube",
        "validation_status": "validated",
        "records": records[:300],
    }

@router.get("/export/{run_id}.csv")
async def export_csv(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    data = await dataset(run_id, 0.0, db, user)
    import csv, io
    buf = io.StringIO()
    fields = ["id", "title", "channel", "views", "likes", "comments", "duration_seconds", "genre", "trope", "emotion", "hook", "confidence", "source_url"]
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for r in data["records"]:
        w.writerow(r)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=atlas_v3_{run_id}.csv"},
    )

@router.get("/export/{run_id}.json")
async def export_json(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    import json
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Not found")
    data = await dataset(run_id, 0.0, db, user)
    payload = {
        "run_id": run_id,
        "research_question": run.research_question,
        "status": run.status,
        "analysis": run.analysis_json,
        "report": run.report_json,
        "evidence": run.evidence_json,
        "stats": run.stats_json,
        "records": data["records"],
    }
    return Response(
        content=json.dumps(payload, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=atlas_v3_{run_id}.json"},
    )

@router.get("/analysis/{run_id}")
async def analysis(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run or not run.analysis_json:
        raise HTTPException(404, "Analysis not found")
    return {
        "analysis": run.analysis_json,
        "evidence": run.evidence_json,
    }

@router.get("/report/{run_id}")
async def report(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run or not run.report_json:
        raise HTTPException(404, "Report not found")
    return {
        **run.report_json,
        "evidence": run.evidence_json,
        "error_code": run.error_code,
    }

@router.get("/compare")
async def compare(
    a: str = Query(..., description="run_id A"),
    b: str = Query(..., description="run_id B"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    from app.services.analytics_engine import build_compare_payload
    ra = db.query(ResearchRun).filter_by(id=a).first()
    rb = db.query(ResearchRun).filter_by(id=b).first()
    if not ra or not rb:
        raise HTTPException(404, "One or both runs not found")
    if not ra.analysis_json or not rb.analysis_json:
        raise HTTPException(400, "Both runs need analysis")
    return build_compare_payload(
        {"run_id": a, "question": ra.research_question, "n": ra.collected_count, "study_id": getattr(ra, "study_id", None)},
        {"run_id": b, "question": rb.research_question, "n": rb.collected_count, "study_id": getattr(rb, "study_id", None)},
        ra.analysis_json,
        rb.analysis_json,
    )


@router.get("/runs/{run_id}/analyze")
def run_analyze_layers(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Phase 2 Analyze layers from analysis_json artifacts."""
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run or not run.analysis_json:
        raise HTTPException(404, "Analysis not found")
    a = run.analysis_json
    return {
        "run_id": run_id,
        "study_id": getattr(run, "study_id", None),
        "n": run.collected_count,
        "profile": a.get("profile"),
        "patterns": a.get("patterns") or {
            "genre_distribution": a.get("genre_distribution"),
            "trope_distribution": a.get("trope_distribution"),
        },
        "performance": a.get("performance"),
        "diagnostic": a.get("diagnostic"),
        "outliers": a.get("outliers"),
        "exploratory": a.get("exploratory"),
        "proximity": a.get("proximity"),
        "potential": a.get("potential"),
        "saturation_notes": a.get("saturation_notes"),
        "whitespace_signals": a.get("whitespace_opportunities"),
    }

@router.post("/reclassify-low-confidence/{run_id}")
async def reclassify_low(
    run_id: str,
    threshold: float = Query(0.5, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Not found")
    videos = db.query(Video).filter_by(run_id=run_id).all()
    updated = 0
    for v in videos:
        if not v.classification or v.classification.confidence >= threshold:
            continue
        # force fresh classify — invalidate cache
        old = db.query(ClassificationCache).filter_by(youtube_id=v.youtube_id).first()
        if old:
            db.delete(old)
        try:
            result = await classify_one(v.title, v.description, v.channel)
            payload = result.model_dump()
            v.classification.genre = payload.get("genre", "other")
            v.classification.trope = payload.get("trope", "")
            v.classification.emotion = payload.get("emotion", "")
            v.classification.hook = payload.get("hook", "")
            v.classification.confidence = float(payload.get("confidence") or 0.7)
            v.classification.model = "groq-reclassify"
            db.merge(ClassificationCache(
                youtube_id=v.youtube_id, payload=payload, model="groq-reclassify",
                updated_at=datetime.utcnow(),
            ))
            updated += 1
            db.commit()
        except Exception:
            db.rollback()
    return {"run_id": run_id, "reclassified": updated, "threshold": threshold}


@router.post("/next-batch/{run_id}")
async def next_batch(
    run_id: str,
    batch_size: int = Query(15, ge=5, le=50),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    """Fetch the next page(s) of YouTube results for the same plan (15-30, 31-45, ...).

    Keeps existing videos/classifications. Raises target_records, walks pageToken
    cursors, re-classifies only new rows, regenerates analysis/report.
    """
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Not found")
    if run.status in ACTIVE - {"queued"} and run.locked_by:
        raise HTTPException(409, "Run is still active; wait for it to finish")
    if run.status not in ("completed", "partial", "failed", "queued"):
        raise HTTPException(400, f"Cannot next-batch from status={run.status}")

    plan = dict(run.plan_json or {})
    if not plan.get("search_queries"):
        # Minimal fallback so pagination can still work
        plan["search_queries"] = [
            "micro drama", "mini drama series", "short drama story",
            "youtube micro drama romance", "short form drama series",
        ]
        plan["objective"] = run.research_question

    settings = get_settings()
    batch_size = min(batch_size, settings.max_videos_per_run)
    current = run.collected_count or 0
    new_target = min(current + batch_size, settings.max_videos_per_run * 10)
    # Soft ceiling: allow growth past single-run max by accumulating on same run
    run.target_records = max(run.target_records, new_target)

    plan["force_collect"] = True
    plan["batch_size"] = batch_size
    plan["batch_index"] = int(plan.get("batch_index") or 1) + 1
    # Ensure cursors dict exists (empty = start/continue from page 1 tokens)
    plan.setdefault("search_cursors", {})
    run.plan_json = plan
    run.status = "queued"
    run.stage_checkpoint = "collecting"
    run.run_kind = "batch"
    if not getattr(run, "parent_run_id", None):
        run.parent_run_id = run.id  # same run expands corpus via batches
    run.error_message = None
    run.error_code = None
    run.locked_by = None
    run.locked_at = None
    run.completed_at = None
    # Force report refresh after new data
    run.report_json = None
    run.analysis_json = None
    db.commit()
    audit(
        db, user.username, "next_batch", resource=run.id,
        detail={"batch_size": batch_size, "batch_index": plan["batch_index"], "new_target": run.target_records},
    )
    return {
        "message": f"Next batch queued (+~{batch_size} videos via YouTube page tokens)",
        "run_id": run_id,
        "batch_index": plan["batch_index"],
        "batch_size": batch_size,
        "target_records": run.target_records,
        "collected_before": current,
    }


@router.post("/resume/{run_id}")
async def resume(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Not found")
    if run.status == "completed":
        return {"message": "Already completed", "run_id": run_id}
    run.status = "queued"
    run.error_message = None
    run.error_code = None
    run.locked_by = None
    run.locked_at = None
    db.commit()
    return {"message": "Re-queued for resume (keeps existing videos/classifications)", "run_id": run_id}

@router.post("/share/{run_id}")
async def share(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Not found")
    run.public_share = True
    if not run.share_token:
        run.share_token = secrets.token_urlsafe(24)
    db.commit()
    audit(db, user.username, "share", resource=run_id)
    return {
        "run_id": run_id,
        "public": True,
        "share_token": run.share_token,
        "api_path": f"/api/public/report/{run.share_token}",
        "app_path": f"/share/{run.share_token}",
    }

@router.get("/review-queue")
async def review_queue(
    threshold: float = Query(0.5),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    rows = (
        db.query(Classification, Video)
        .join(Video, Classification.video_id == Video.id)
        .filter(Classification.confidence < threshold, Classification.review_status == "pending")
        .limit(100)
        .all()
    )
    return [
        {
            "classification_id": c.id,
            "youtube_id": c.youtube_id,
            "title": v.title,
            "genre": c.genre,
            "trope": c.trope,
            "confidence": c.confidence,
            "run_id": v.run_id,
        }
        for c, v in rows
    ]

@router.post("/review/{classification_id}")
async def review_one(
    classification_id: int,
    status: str = Query(..., pattern="^(accepted|rejected)$"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_admin),
):
    from datetime import datetime
    c = db.query(Classification).filter_by(id=classification_id).first()
    if not c:
        raise HTTPException(404, "Not found")
    c.review_status = status
    c.reviewed_by = user.username
    c.reviewed_at = datetime.utcnow()
    db.commit()
    audit(db, user.username, f"review_{status}", resource=str(classification_id))
    return {"id": classification_id, "review_status": status}



@router.post("/memory/ask")
async def memory_ask(body: dict, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Ask Atlas (Phase 4): metrics | claims | methodology | memory | run-to-run."""
    from app.services.ask_service import ask_atlas
    question = (body.get("question") or "").strip()
    run_ids = body.get("run_ids")
    focus = body.get("run_id")
    study_id = body.get("study_id")
    if run_ids is not None and not isinstance(run_ids, list):
        run_ids = None
    return await ask_atlas(db, question, run_id=focus, study_id=study_id, run_ids=run_ids)


@router.post("/ask")
async def ask_atlas_route(body: dict, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Alias for unified Ask Atlas."""
    from app.services.ask_service import ask_atlas
    return await ask_atlas(
        db,
        (body.get("question") or "").strip(),
        run_id=body.get("run_id"),
        study_id=body.get("study_id"),
        run_ids=body.get("run_ids") if isinstance(body.get("run_ids"), list) else None,
    )


@router.get("/studies/{study_id}/run-to-run")
def study_run_to_run(study_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.ask_service import run_to_run_summary
    return run_to_run_summary(db, study_id)


@router.post("/memory/index/{run_id}")
async def memory_index(run_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.memory_rag import index_run
    return await index_run(db, run_id)


@router.get("/memory/stats")
def memory_stats(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.db.models import ResearchMemoryChunk
    total = db.query(ResearchMemoryChunk).count()
    with_emb = db.query(ResearchMemoryChunk).filter(ResearchMemoryChunk.embedding.isnot(None)).count()
    return {"chunks": total, "embedded": with_emb}


# --- V3 Phase 0–1: Studies + Claims / Evidence ---

@router.get("/studies")
def list_studies(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.db.models import ResearchStudy, Corpus, Methodology, ResearchRun
    from app.services.study_service import ensure_default_study
    ensure_default_study(db, owner=user.username)
    studies = db.query(ResearchStudy).order_by(ResearchStudy.created_at.desc()).limit(50).all()
    out = []
    for s in studies:
        runs = db.query(ResearchRun).filter_by(study_id=s.id).count()
        out.append({
            "id": s.id,
            "title": s.title,
            "description": s.description,
            "status": s.status,
            "run_count": runs,
            "created_at": s.created_at,
        })
    return out


@router.get("/studies/{study_id}")
def get_study(study_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.db.models import ResearchStudy, Corpus, Methodology, ResearchRun
    s = db.query(ResearchStudy).filter_by(id=study_id).first()
    if not s:
        raise HTTPException(404, "Study not found")
    methods = db.query(Methodology).filter_by(study_id=study_id).all()
    corpora = db.query(Corpus).filter_by(study_id=study_id).all()
    runs = db.query(ResearchRun).filter_by(study_id=study_id).order_by(ResearchRun.started_at.desc()).limit(50).all()
    return {
        "id": s.id,
        "title": s.title,
        "description": s.description,
        "status": s.status,
        "methodologies": [{"id": m.id, "version": m.version, "name": m.name, "spec": m.spec_json} for m in methods],
        "corpora": [{"id": c.id, "name": c.name} for c in corpora],
        "runs": [{
            "run_id": r.id,
            "status": r.status,
            "run_kind": getattr(r, "run_kind", "seed"),
            "collected_count": r.collected_count,
            "parent_run_id": getattr(r, "parent_run_id", None),
            "started_at": r.started_at,
        } for r in runs],
    }


@router.get("/runs/{run_id}/claims")
def list_run_claims(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.claims_service import list_claims_for_run, emit_claims_for_run
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    claims = list_claims_for_run(db, run_id)
    if not claims and run.analysis_json:
        emit_claims_for_run(db, run_id)
        claims = list_claims_for_run(db, run_id)
    return {
        "run_id": run_id,
        "study_id": getattr(run, "study_id", None),
        "claims": [
            {
                "id": c.id,
                "claim_type": c.claim_type,
                "statement": c.statement,
                "metric": c.metric,
                "formula": c.formula,
                "inputs": c.inputs_json,
                "n_sample": c.n_sample,
                "value_num": c.value_num,
                "value_label": c.value_label,
                "artifact_id": c.artifact_id,
            }
            for c in claims
        ],
    }


@router.get("/claims/{claim_id}")
def get_claim_detail(claim_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.claims_service import get_claim, claim_evidence_rows
    c = get_claim(db, claim_id)
    if not c:
        raise HTTPException(404, "Claim not found")
    return {
        "id": c.id,
        "study_id": c.study_id,
        "run_id": c.run_id,
        "claim_type": c.claim_type,
        "statement": c.statement,
        "metric": c.metric,
        "formula": c.formula,
        "inputs": c.inputs_json,
        "n_sample": c.n_sample,
        "value_num": c.value_num,
        "value_label": c.value_label,
        "methodology_id": c.methodology_id,
        "evidence": claim_evidence_rows(db, claim_id),
        "evidence_count": len(claim_evidence_rows(db, claim_id)),
    }


@router.post("/runs/{run_id}/rebuild-claims")
def rebuild_claims(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.claims_service import emit_claims_for_run
    from app.services.study_service import attach_run_to_study
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    attach_run_to_study(db, run, owner=run.created_by or user.username)
    return emit_claims_for_run(db, run_id)


# --- V3 Phase 5: Pulse / Refresh / Monitor ---

@router.get("/studies/{study_id}/pulse")
def study_pulse(study_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.continuous import build_pulse
    return build_pulse(db, study_id)


@router.post("/studies/{study_id}/refresh")
def study_refresh(study_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    from app.services.continuous import queue_refresh_run, ensure_monitor, log_monitor_event
    from datetime import datetime
    result = queue_refresh_run(db, study_id, user=user.username)
    if result.get("error"):
        raise HTTPException(400, result)
    try:
        m = ensure_monitor(db, study_id)
        m.last_refresh_at = datetime.utcnow()
        db.add(m)
        db.commit()
        log_monitor_event(db, m.id, "refresh_queued", f"Refresh run {result.get('run_id')}", result)
    except Exception:
        pass
    return result


@router.get("/studies/{study_id}/monitor")
def study_monitor(study_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.continuous import monitor_status, ensure_monitor
    ensure_monitor(db, study_id)
    return monitor_status(db, study_id)


@router.post("/studies/{study_id}/monitor")
def enable_monitor(study_id: str, body: dict | None = None, db: Session = Depends(get_db), user: CurrentUser = Depends(require_admin)):
    from app.services.continuous import ensure_monitor, log_monitor_event
    m = ensure_monitor(db, study_id)
    body = body or {}
    if "enabled" in body:
        m.enabled = bool(body["enabled"])
    if "cadence_hours" in body:
        m.cadence_hours = int(body["cadence_hours"])
    db.add(m)
    db.commit()
    log_monitor_event(db, m.id, "config", f"enabled={m.enabled} cadence_hours={m.cadence_hours}")
    return {"id": m.id, "enabled": m.enabled, "cadence_hours": m.cadence_hours, "message": "Monitor saved. Scheduled auto-refresh not active on free-tier yet."}


# --- V3 Phase 6: Prescriptive ---

@router.get("/runs/{run_id}/prescriptive")
def run_prescriptive(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.prescriptive import build_prescriptive
    return build_prescriptive(db, run_id)


# --- V3 Phase 7: Predictive ---

@router.get("/studies/{study_id}/predictive")
def study_predictive(study_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.predictive import build_predictive
    return build_predictive(db, study_id=study_id)


@router.get("/runs/{run_id}/predictive")
def run_predictive(run_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    from app.services.predictive import build_predictive
    return build_predictive(db, run_id=run_id)
