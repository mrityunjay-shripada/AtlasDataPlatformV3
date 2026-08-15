"""Postgres-checkpointed research pipeline for Render (no Redis/Celery)."""
import logging
import os
import socket
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.agents.schemas import ClassificationResult, ResearchPlan, ResearchReport
from app.config import get_settings
from app.db.models import Classification, ClassificationCache, ResearchRun, Video
from app.llm.base import LLMRole, Message
from app.llm import get_gemini, get_groq
from app.tools.youtube import YouTubeQuotaExceeded, YouTubeTool
from app.services.events import emit
from app.services import quota as quota_svc
from app.services.prompts import get_prompt
from app.observability.metrics import incr, timing
from app.config import get_settings as _gs

logger = logging.getLogger(__name__)

ACTIVE = {"queued", "planning", "collecting", "cleaning", "classifying", "analyzing", "generating_report"}
LEASE_STALE_SECONDS = 120
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid4().hex[:6]}"


def _set_stage(db: Session, run: ResearchRun, stage: str, **kwargs):
    run.status = stage
    run.stage_checkpoint = stage
    run.updated_at = datetime.utcnow()
    run.heartbeat_at = datetime.utcnow()
    for k, v in kwargs.items():
        if hasattr(run, k):
            setattr(run, k, v)
    db.commit()
    emit(db, run.id, stage, event="stage", message=f"entered {stage}")
    incr(f"stage.{stage}")


def _fail(db: Session, run: ResearchRun, code: str, message: str, partial: bool = False):
    run.error_code = code
    run.error_message = message[:1000]
    run.locked_at = None
    run.locked_by = None
    emit(db, run.id, run.stage_checkpoint or "unknown", event="error", message=message[:500], error_code=code)
    incr(f"error.{code}")
    if partial:
        _set_stage(db, run, "partial")
    else:
        _set_stage(db, run, "failed")


def _acquire_lease(db: Session, run: ResearchRun) -> bool:
    now = datetime.utcnow()
    if run.locked_by and run.heartbeat_at:
        if run.locked_by != WORKER_ID and (now - run.heartbeat_at).total_seconds() < LEASE_STALE_SECONDS:
            return False
    run.locked_by = WORKER_ID
    run.locked_at = now
    run.heartbeat_at = now
    db.commit()
    return True


def _heartbeat(db: Session, run: ResearchRun):
    run.heartbeat_at = datetime.utcnow()
    run.updated_at = datetime.utcnow()
    db.commit()


def _release_lease(db: Session, run: ResearchRun):
    if run.locked_by == WORKER_ID:
        run.locked_at = None
        run.locked_by = None
        db.commit()


async def plan(question: str, target: int) -> ResearchPlan:
    gemini = get_gemini()
    msgs = [
        Message(role=LLMRole.SYSTEM, content=(
            "You plan YouTube micro-drama research. Output JSON only. "
            f"target_records between 5 and {target}. Prefer 6-8 search queries."
        )),
        Message(role=LLMRole.USER, content=f"Research question:\n{question}\nTarget max: {target}"),
    ]
    plan_obj, _ = await gemini.generate_structured(msgs, ResearchPlan, temperature=0.1)
    plan_obj.target_records = min(max(plan_obj.target_records, 5), target)
    if not plan_obj.search_queries:
        plan_obj.search_queries = ["micro drama", "mini drama series", "short drama story"]
    return plan_obj


async def classify_one(title: str, description: str, channel: str) -> ClassificationResult:
    groq = get_groq()
    msgs = [
        Message(role=LLMRole.SYSTEM, content=(
            "Classify YouTube micro-drama. JSON: genre, subgenre, hook, trope, emotion, "
            "conflict, story_structure, ending_type, confidence. "
            "genre in: romance,thriller,family,revenge,comedy,tragedy,mystery,slice_of_life,supernatural,other."
        )),
        Message(role=LLMRole.USER, content=f"Title: {title}\nChannel: {channel}\nDesc: {description[:600]}"),
    ]
    obj, _ = await groq.generate_structured(msgs, ClassificationResult, temperature=0.1, max_tokens=512)
    return obj


def analyze(class_rows: List[Dict[str, Any]], videos: List[Dict[str, Any]]) -> Dict[str, Any]:
    genres = Counter(c.get("genre") or "unknown" for c in class_rows)
    tropes = Counter(c.get("trope") or "unknown" for c in class_rows)
    total = max(len(class_rows), 1)
    saturation = []
    for g, n in genres.most_common():
        share = n / total
        if share >= 0.25 and n >= 2:
            saturation.append(f"Genre '{g}' is {n}/{total} ({share:.0%}) in this sample — relatively saturated.")
    whitespace = []
    for g in ["mystery", "supernatural", "slice_of_life", "comedy"]:
        if genres.get(g, 0) == 0:
            whitespace.append(f"Underrepresented in sample: genre '{g}' (0 videos).")
    views = [v.get("views") or 0 for v in videos]
    low_conf = [c for c in class_rows if float(c.get("confidence") or 0) < 0.5]
    # Evidence pins: top titles per genre
    by_genre: Dict[str, List[dict]] = defaultdict(list)
    for c in class_rows:
        by_genre[c.get("genre") or "other"].append({
            "youtube_id": c.get("youtube_id"),
            "title": c.get("title"),
            "views": c.get("views") or 0,
        })
    evidence = {}
    for g, items in by_genre.items():
        items_sorted = sorted(items, key=lambda x: x["views"], reverse=True)[:3]
        evidence[g] = items_sorted
    base = {
        "genre_distribution": dict(genres),
        "trope_distribution": dict(tropes.most_common(15)),
        "engagement_stats": {
            "count": len(views),
            "mean_views": sum(views) / max(len(views), 1),
            "max_views": max(views) if views else 0,
        },
        "saturation_notes": saturation,
        "whitespace_opportunities": whitespace[:10],
        "low_confidence_count": len(low_conf),
        "evidence_by_genre": evidence,
    }
    try:
        from app.services.analytics_engine import enrich_analysis
        return enrich_analysis(class_rows, videos, base)
    except Exception:
        return base


async def generate_report(question: str, analysis: dict, sample: list, n: int) -> ResearchReport:
    gemini = get_gemini()
    evidence = analysis.get("evidence_by_genre") or {}
    msgs = [
        Message(role=LLMRole.SYSTEM, content=(
            "Write a grounded research report as JSON matching the schema. "
            "Never invent numbers or video IDs. When citing examples, only use titles/IDs from evidence_by_genre. "
            "Use careful language (underrepresented, appears frequently)."
        )),
        Message(role=LLMRole.USER, content=(
            f"Objective: {question}\nDataset size: {n}\nAnalysis:\n{analysis}\n"
            f"Evidence pins by genre:\n{evidence}\nSample:\n{sample[:12]}"
        )),
    ]
    report, _ = await gemini.generate_structured(msgs, ResearchReport, temperature=0.2, max_tokens=4096)
    return report


async def execute_run(db: Session, run_id: str) -> None:
    settings = get_settings()
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run or run.status == "completed":
        return
    if not _acquire_lease(db, run):
        logger.info("Lease held by another worker for %s", run_id)
        return

    t0 = time.time()
    budget = settings.run_time_budget_seconds
    stats = dict(run.stats_json or {})
    stats.setdefault("youtube_cache_hits", 0)
    stats.setdefault("classification_cache_hits", 0)
    stats.setdefault("classifications_new", 0)

    def over_budget() -> bool:
        return (time.time() - t0) > budget

    try:
        # PLANNING
        if run.stage_checkpoint in ("queued", "planning", "failed") and not run.plan_json:
            _set_stage(db, run, "planning", error_code=None, error_message=None)
            try:
                p = await plan(run.research_question, min(run.target_records, settings.max_videos_per_run))
            except Exception as e:
                logger.warning("Planning LLM failed, using fallback plan: %s", e)
                from app.agents.schemas import ResearchPlan
                target = min(run.target_records, settings.max_videos_per_run)
                p = ResearchPlan(
                    objective=run.research_question,
                    target_records=target,
                    search_queries=[
                        "micro drama",
                        "mini drama series",
                        "short drama story",
                        "youtube micro drama romance",
                        "short form drama series",
                        "vertical drama short",
                    ],
                )
            run.plan_json = p.model_dump()
            run.target_records = p.target_records
            db.commit()
            _heartbeat(db, run)

        plan_data = run.plan_json or {}
        # Aspiration can grow via next-batch; each API pass still limited by max_videos_per_run
        target = run.target_records
        force_collect = bool((plan_data or {}).get("force_collect"))
        batch_size = int((plan_data or {}).get("batch_size") or 15)
        per_pass_cap = settings.max_videos_per_run

        # COLLECTING — skip if enough videos already (strong resume), unless next-batch
        existing = db.query(Video).filter_by(run_id=run_id).count()
        baseline_goal = min(target, per_pass_cap)
        need_more = (
            existing < target
            if force_collect
            else existing < max(5, baseline_goal // 3) or existing < baseline_goal
        )
        if need_more and run.stage_checkpoint in (
            "queued", "planning", "collecting", "cleaning", "failed", "partial", "completed"
        ):
            _set_stage(db, run, "collecting")
            yt = YouTubeTool(db)
            try:
                existing_ids = {
                    v.youtube_id for v in db.query(Video).filter_by(run_id=run_id).all()
                }
                if force_collect:
                    to_fetch = min(batch_size, max(0, target - existing), per_pass_cap)
                else:
                    to_fetch = min(max(0, baseline_goal - existing), per_pass_cap)
                to_fetch = max(1, to_fetch)
                cursors = dict(plan_data.get("search_cursors") or {})
                records, updated_cursors, collect_meta = await yt.collect(
                    plan_data.get("search_queries") or [],
                    to_fetch,
                    page_tokens=cursors,
                    exclude_ids=existing_ids,
                )
                stats["videos_fetched"] = len(records)
                stats["pages_fetched"] = collect_meta.get("pages_fetched", 0)
                stats["skipped_dupes"] = collect_meta.get("skipped_dupes", 0)
                stats["queries_exhausted"] = collect_meta.get("queries_exhausted", 0)
                added = 0
                for rec in records:
                    if rec["youtube_id"] in existing_ids:
                        continue
                    db.add(Video(run_id=run_id, **rec))
                    existing_ids.add(rec["youtube_id"])
                    added += 1
                # Persist pagination cursors + clear one-shot flags
                plan_data = dict(plan_data)
                plan_data["search_cursors"] = updated_cursors
                plan_data["force_collect"] = False
                plan_data["batch_index"] = int(plan_data.get("batch_index") or 1)
                if added:
                    plan_data["batch_index"] = int(plan_data.get("batch_index") or 1)
                run.plan_json = plan_data
                db.commit()
                stats["videos_added"] = added
                more_available = any(v not in (None, "") for v in updated_cursors.values())
                stats["more_pages_available"] = more_available
            except YouTubeQuotaExceeded as e:
                run.stats_json = stats
                _fail(db, run, "quota_youtube", str(e), partial=existing > 0)
                return
            except Exception as e:
                run.stats_json = stats
                _fail(db, run, "unknown", f"Collect failed: {e}", partial=existing > 0)
                return
            run.collected_count = db.query(Video).filter_by(run_id=run_id).count()
            run.stats_json = stats
            _set_stage(db, run, "cleaning", collected_count=run.collected_count)

        videos = db.query(Video).filter_by(run_id=run_id).all()
        if not videos:
            _fail(db, run, "unknown", "No videos collected")
            return

        # CLASSIFYING — only missing rows; use classification cache
        _set_stage(db, run, "classifying")
        for v in videos:
            if over_budget():
                run.stats_json = stats
                _fail(
                    db, run, "timeout",
                    "Time budget reached during classification; partial results saved.",
                    partial=True,
                )
                break
            if v.classification:
                continue
            _heartbeat(db, run)
            cached = db.query(ClassificationCache).filter_by(youtube_id=v.youtube_id).first()
            if cached:
                payload = cached.payload
                stats["classification_cache_hits"] = stats.get("classification_cache_hits", 0) + 1
            else:
                try:
                    result = await classify_one(v.title, v.description, v.channel)
                    payload = result.model_dump()
                    payload["model"] = "groq"
                    db.merge(ClassificationCache(
                        youtube_id=v.youtube_id,
                        payload=payload,
                        model="groq",
                        updated_at=datetime.utcnow(),
                    ))
                    stats["classifications_new"] = stats.get("classifications_new", 0) + 1
                except Exception as e:
                    logger.warning("classify %s: %s", v.youtube_id, e)
                    continue
            db.add(Classification(
                video_id=v.id,
                youtube_id=v.youtube_id,
                genre=payload.get("genre", "other"),
                subgenre=payload.get("subgenre", ""),
                hook=payload.get("hook", ""),
                trope=payload.get("trope", ""),
                emotion=payload.get("emotion", ""),
                conflict=payload.get("conflict", ""),
                story_structure=payload.get("story_structure", ""),
                ending_type=payload.get("ending_type", ""),
                confidence=float(payload.get("confidence") or 0.7),
                model=payload.get("model", "groq"),
            ))
            db.commit()

        run.classified_count = (
            db.query(Classification).join(Video).filter(Video.run_id == run_id).count()
        )
        run.stats_json = stats
        db.commit()

        # ANALYZING
        if run.status not in ("failed",):
            _set_stage(db, run, "analyzing")
        class_rows, vid_rows = [], []
        for v in db.query(Video).filter_by(run_id=run_id).all():
            vid_rows.append({"views": v.views, "title": v.title})
            if v.classification:
                class_rows.append({
                    "genre": v.classification.genre,
                    "trope": v.classification.trope,
                    "title": v.title,
                    "youtube_id": v.youtube_id,
                    "views": v.views,
                    "confidence": v.classification.confidence,
                })
        analysis = analyze(class_rows, vid_rows)
        run.analysis_json = analysis
        run.evidence_json = analysis.get("evidence_by_genre")
        db.commit()
        try:
            from app.services.claims_service import emit_claims_for_run
            from app.services.study_service import attach_run_to_study
            attach_run_to_study(db, run, owner=run.created_by or "admin", run_kind=getattr(run, "run_kind", None) or "seed")
            emit_claims_for_run(db, run_id)
        except Exception as e:
            logger.warning("claims emit skipped: %s", e)

        # REPORT
        if run.status != "failed" and (not over_budget() or not run.report_json):
            _set_stage(db, run, "generating_report")
            try:
                report = await generate_report(
                    run.research_question, analysis, class_rows, len(vid_rows)
                )
                run.report_json = report.model_dump()
            except Exception as e:
                logger.error("report failed: %s", e)
                if not run.report_json:
                    run.stats_json = stats
                    _fail(db, run, "llm_parse", f"Report generation failed: {e}", partial=True)
                    _release_lease(db, run)
                    return

        if run.status == "partial":
            run.completed_at = datetime.utcnow()
            run.stats_json = stats
            _release_lease(db, run)
            db.commit()
            try:
                from app.services.memory_rag import index_run
                await index_run(db, run_id)
            except Exception:
                pass
            return

        run.status = "completed"
        run.stage_checkpoint = "completed"
        run.completed_at = datetime.utcnow()
        run.error_message = None
        run.error_code = None
        run.stats_json = stats
        try:
            run.cost_json = quota_svc.snapshot(db)
        except Exception:
            pass
        duration = int((time.time() - t0) * 1000)
        timing("run.total_ms", duration)
        incr("runs.completed")
        emit(db, run.id, "completed", event="stage", message="completed", duration_ms=duration, payload=stats)
        _release_lease(db, run)
        db.commit()
        logger.info("Run completed %s stats=%s", run_id, stats)

        # Research-memory index (claims + report sections; constrained RAG)
        try:
            from app.services.memory_rag import index_run
            import asyncio
            idx = await index_run(db, run_id)
            logger.info("memory index %s", idx)
        except Exception as e:
            logger.warning("memory index skipped: %s", e)


    except Exception as e:
        logger.exception("run %s failed", run_id)
        run = db.query(ResearchRun).filter_by(id=run_id).first()
        if run:
            code = "db" if "operational" in str(e).lower() or "postgres" in str(e).lower() else "unknown"
            _fail(db, run, code, str(e))
            _release_lease(db, run)


_worker_started = False


async def queue_worker_loop():
    global _worker_started
    if _worker_started:
        return
    _worker_started = True
    from app.db.session import SessionLocal
    import asyncio
    logger.info("Atlas worker %s started", WORKER_ID)
    while True:
        db = SessionLocal()
        try:
            settings = get_settings()
            now = datetime.utcnow()
            # Clear stale leases
            stale = db.query(ResearchRun).filter(
                ResearchRun.locked_by.isnot(None),
                ResearchRun.heartbeat_at < now - timedelta(seconds=LEASE_STALE_SECONDS),
            ).all()
            for r in stale:
                r.locked_by = None
                r.locked_at = None
            if stale:
                db.commit()

            active = db.query(ResearchRun).filter(
                ResearchRun.status.in_(list(ACTIVE - {"queued"})),
                ResearchRun.locked_by.isnot(None),
                ResearchRun.heartbeat_at >= now - timedelta(seconds=LEASE_STALE_SECONDS),
            ).count()

            if active < settings.max_concurrent_runs:
                job = (
                    db.query(ResearchRun)
                    .filter(ResearchRun.status.in_(["queued", "partial"]))
                    .order_by(ResearchRun.started_at.asc())
                    .first()
                )
                if not job:
                    job = (
                        db.query(ResearchRun)
                        .filter(ResearchRun.status.in_([
                            "planning", "collecting", "cleaning", "classifying",
                            "analyzing", "generating_report",
                        ]))
                        .filter(
                            (ResearchRun.locked_by.is_(None)) |
                            (ResearchRun.heartbeat_at < now - timedelta(seconds=LEASE_STALE_SECONDS))
                        )
                        .order_by(ResearchRun.updated_at.asc())
                        .first()
                    )
                if job:
                    rid = job.id
                    db.close()
                    db = SessionLocal()
                    await execute_run(db, rid)
        except Exception:
            logger.exception("worker loop error")
        finally:
            db.close()
        await asyncio.sleep(3)
