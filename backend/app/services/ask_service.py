"""Phase 4 — Unified Ask Atlas router.

Routes:
- metric → DB / analysis_json (never invent %)
- claim → claims table
- memory → research_memory_chunks + claim text
- methodology → methodology.spec_json
- run_to_run → compare within study/corpus
"""
from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import Claim, Methodology, ResearchRun, ResearchStudy
from app.services.memory_rag import ask_memory, METRIC_HINTS, MEMORY_HINTS
from app.services.analytics_engine import build_compare_payload

logger = logging.getLogger(__name__)

COMPARE_HINTS = re.compile(r"\b(compare|versus|vs\.?|difference|delta|across runs|run to run|between runs)\b", re.I)
CLAIM_HINTS = re.compile(r"\b(claim|proof|evidence for|why.*%|show.*rows|support)\b", re.I)
METHOD_HINTS = re.compile(r"\b(methodology|method|limitations|how (do|does) atlas|taxonomy)\b", re.I)


def _latest_runs(db: Session, study_id: str | None, limit: int = 10) -> list[ResearchRun]:
    q = db.query(ResearchRun).filter(ResearchRun.status.in_(["completed", "partial"]))
    if study_id:
        q = q.filter(ResearchRun.study_id == study_id)
    return q.order_by(ResearchRun.completed_at.desc()).limit(limit).all()


def run_to_run_summary(db: Session, study_id: str | None = None) -> dict[str, Any]:
    runs = _latest_runs(db, study_id, limit=8)
    if len(runs) < 2:
        return {
            "intent": "run_to_run",
            "answer": (
                "Not enough completed runs in this research study for run-to-run intelligence. "
                "Complete at least two runs (e.g. seed + Next batch) under the same study."
            ),
            "citations": [{"run_id": r.id, "n_sample": r.collected_count, "source_type": "run"} for r in runs],
            "numbers_from": "none",
        }
    a, b = runs[1], runs[0]  # older vs newer
    payload = build_compare_payload(
        {"run_id": a.id, "question": a.research_question, "n": a.collected_count, "study_id": a.study_id},
        {"run_id": b.id, "question": b.research_question, "n": b.collected_count, "study_id": b.study_id},
        a.analysis_json or {},
        b.analysis_json or {},
    )
    lines = [
        f"Run-to-run (study sample): older {a.id[:8]} (n={a.collected_count}) → newer {b.id[:8]} (n={b.collected_count}).",
        "Largest genre share shifts:",
    ]
    for g in (payload.get("genre_delta") or [])[:5]:
        lines.append(
            f"  - {g['genre']}: share {g['share_a']:.0%} → {g['share_b']:.0%} (Δ {g['share_delta']:+.0%})"
        )
    pd = payload.get("performance_delta") or {}
    if pd.get("mean_views_a") is not None:
        lines.append(
            f"Mean views: {round(float(pd['mean_views_a'])):,} → {round(float(pd.get('mean_views_b') or 0)):,}"
        )
    lines.append("Descriptive only — not causal. Open Compare or Evidence for proof.")
    return {
        "intent": "run_to_run",
        "answer": "\n".join(lines),
        "citations": [
            {"run_id": a.id, "n_sample": a.collected_count, "source_type": "run", "title": "older"},
            {"run_id": b.id, "n_sample": b.collected_count, "source_type": "run", "title": "newer"},
        ],
        "numbers_from": "db",
        "compare": payload,
    }


def claims_answer(db: Session, question: str, run_id: str | None) -> dict[str, Any] | None:
    q = db.query(Claim)
    if run_id:
        q = q.filter(Claim.run_id == run_id)
    claims = q.order_by(Claim.created_at.desc()).limit(40).all()
    if not claims:
        return None
    ql = question.lower()
    scored = []
    for c in claims:
        blob = f"{c.statement} {c.metric} {c.claim_type} {c.value_label}".lower()
        score = sum(1 for tok in set(re.findall(r"[a-z0-9_]{3,}", ql)) if tok in blob)
        if score:
            scored.append((score, c))
    scored.sort(key=lambda x: -x[0])
    picked = [c for _, c in scored[:8]] or claims[:5]
    lines = ["Claims matching your question (Proof backbone):", ""]
    cites = []
    for c in picked:
        lines.append(f"• [{c.claim_type}] {c.statement}")
        lines.append(f"  formula: {c.formula} · n={c.n_sample}")
        cites.append({
            "run_id": c.run_id,
            "n_sample": c.n_sample,
            "source_type": "claim",
            "title": c.value_label or c.claim_type,
            "claim_key": c.id,
            "claim_id": c.id,
        })
    return {
        "intent": "claim",
        "answer": "\n".join(lines),
        "citations": cites,
        "numbers_from": "claims",
    }


def methodology_answer(db: Session, run_id: str | None, study_id: str | None) -> dict[str, Any]:
    method = None
    if run_id:
        run = db.query(ResearchRun).filter_by(id=run_id).first()
        if run and run.methodology_id:
            method = db.query(Methodology).filter_by(id=run.methodology_id).first()
            study_id = study_id or run.study_id
    if not method and study_id:
        method = db.query(Methodology).filter_by(study_id=study_id).order_by(Methodology.created_at.asc()).first()
    if not method:
        method = db.query(Methodology).order_by(Methodology.created_at.asc()).first()
    if not method:
        return {
            "intent": "methodology",
            "answer": "No methodology recorded yet. Default study methodology is created on boot.",
            "citations": [],
            "numbers_from": "none",
        }
    spec = method.spec_json or {}
    lines = [
        f"Methodology: {method.name} ({method.version})",
        f"Scope: {spec.get('scope', 'youtube research')}",
        f"Inclusion: {spec.get('inclusion', '—')}",
        "Language rules:",
    ]
    for k, v in (spec.get("language_rules") or {}).items():
        lines.append(f"  - {k}: {v}")
    lines.append("Limitations:")
    for lim in (spec.get("limitations") or [])[:5]:
        lines.append(f"  - {lim}")
    return {
        "intent": "methodology",
        "answer": "\n".join(lines),
        "citations": [{
            "run_id": run_id or "",
            "n_sample": 0,
            "source_type": "methodology",
            "title": method.name,
            "claim_key": method.id,
        }],
        "numbers_from": "methodology",
    }


async def ask_atlas(
    db: Session,
    question: str,
    run_id: str | None = None,
    study_id: str | None = None,
    run_ids: list[str] | None = None,
) -> dict[str, Any]:
    q = (question or "").strip()
    if not q:
        return {"intent": "empty", "answer": "Ask about metrics, claims, methodology, memory, or run-to-run changes.", "citations": []}

    if not study_id and run_id:
        run = db.query(ResearchRun).filter_by(id=run_id).first()
        if run:
            study_id = run.study_id

    # Router
    if COMPARE_HINTS.search(q):
        return run_to_run_summary(db, study_id)

    if METHOD_HINTS.search(q):
        return methodology_answer(db, run_id, study_id)

    if CLAIM_HINTS.search(q) or "proof" in q.lower():
        hit = claims_answer(db, q, run_id)
        if hit:
            return hit

    # Metric vs memory via existing memory_rag helpers
    if METRIC_HINTS.search(q) and not MEMORY_HINTS.search(q):
        from app.services.memory_rag import ask_memory as _am
        return await _am(db, q, run_ids=run_ids, focus_run_id=run_id)

    # Default: try claims then memory
    hit = claims_answer(db, q, run_id)
    mem = await ask_memory(db, q, run_ids=run_ids, focus_run_id=run_id)
    if hit and mem.get("intent") == "memory":
        return {
            "intent": "hybrid",
            "answer": hit["answer"] + "\n\n---\nResearch memory:\n" + mem.get("answer", ""),
            "citations": (hit.get("citations") or []) + (mem.get("citations") or []),
            "numbers_from": "claims+memory",
        }
    if hit:
        return hit
    mem["intent"] = mem.get("intent") or "memory"
    return mem
