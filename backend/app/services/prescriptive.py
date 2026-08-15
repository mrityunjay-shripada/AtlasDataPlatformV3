
"""Phase 6 — Prescriptive recommendations bound to claim_ids.

Every recommendation cites supporting claims. No orphan advice.
"""
from __future__ import annotations

from typing import Any
from sqlalchemy.orm import Session
from app.db.models import Claim, ResearchRun


def build_prescriptive(db: Session, run_id: str) -> dict[str, Any]:
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run:
        return {"status": "error", "message": "Run not found", "recommendations": []}

    claims = db.query(Claim).filter_by(run_id=run_id).order_by(Claim.created_at.asc()).all()
    if not claims:
        return {
            "status": "insufficient_data",
            "message": "No claims for this run. Rebuild claims after analysis completes.",
            "recommendations": [],
            "n": run.collected_count,
        }

    by_type: dict[str, list[Claim]] = {}
    for c in claims:
        by_type.setdefault(c.claim_type, []).append(c)

    recs: list[dict[str, Any]] = []

    # 1) Concentration / saturation → diversify exploration
    sat = by_type.get("saturation") or []
    genre_shares = by_type.get("genre_share") or []
    top_genre = None
    if genre_shares:
        top_genre = max(genre_shares, key=lambda c: float(c.value_num or 0))
    if top_genre and (top_genre.value_num or 0) >= 40:
        recs.append({
            "id": f"rec-diversify-{top_genre.id[:8]}",
            "title": "Probe beyond the dominant genre in this sample",
            "action": (
                f"Dominant share is {top_genre.value_label}. "
                "For the next batch, bias search queries toward underrepresented genres "
                "already flagged as signals — do not assume market saturation from this pull alone."
            ),
            "priority": "high",
            "claim_ids": [top_genre.id] + [c.id for c in sat[:2]],
            "based_on": [top_genre.statement] + [c.statement for c in sat[:1]],
        })

    # 2) Signals / potential → targeted collection
    signals = by_type.get("signal_underrepresented") or []
    potentials = by_type.get("potential") or []
    if signals or potentials:
        keys = []
        cids = []
        for c in (potentials + signals)[:5]:
            key = (c.inputs_json or {}).get("key") or c.value_label
            if key and key not in keys:
                keys.append(str(key))
            cids.append(c.id)
        recs.append({
            "id": f"rec-signal-{run_id[:8]}",
            "title": "Investigate underrepresentation signals in the next collect",
            "action": (
                "Treat these as sample signals, not opportunities: "
                + ", ".join(keys[:5])
                + ". Add explicit search queries for them on Next batch / Refresh, then re-measure shares."
            ),
            "priority": "medium",
            "claim_ids": cids[:8],
            "based_on": [c.statement for c in (potentials + signals)[:3]],
        })

    # 3) Low confidence → reclassify / review
    diag = by_type.get("diagnostic_flag") or []
    low = [c for c in diag if (c.inputs_json or {}).get("code") == "low_confidence_share"]
    if low:
        recs.append({
            "id": f"rec-conf-{low[0].id[:8]}",
            "title": "Improve label quality before strategic decisions",
            "action": (
                "A material share of classifications is low-confidence. "
                "Run reclassify-low-confidence and spot-check Evidence rows before acting on genre/trope shares."
            ),
            "priority": "high",
            "claim_ids": [c.id for c in low],
            "based_on": [c.statement for c in low],
        })

    # 4) Small sample diagnostic
    small = [c for c in diag if (c.inputs_json or {}).get("code") == "small_sample"]
    if small:
        recs.append({
            "id": f"rec-n-{small[0].id[:8]}",
            "title": "Increase sample size before generalizing",
            "action": (
                f"Current n={run.collected_count}. Use Next batch (+15) or Refresh under the same research study "
                "to grow the corpus, then compare shares via run-to-run / Pulse."
            ),
            "priority": "medium",
            "claim_ids": [c.id for c in small],
            "based_on": [c.statement for c in small],
        })

    # 5) Performance top — learn from high-view examples (descriptive)
    tops = by_type.get("performance_top") or []
    if tops:
        recs.append({
            "id": f"rec-perf-{tops[0].id[:8]}",
            "title": "Review high-view examples in Evidence",
            "action": (
                "Open Proof for top-view claims and inspect classification + YouTube source. "
                "Use as qualitative references inside this sample — not as a growth playbook."
            ),
            "priority": "low",
            "claim_ids": [c.id for c in tops[:3]],
            "based_on": [c.statement for c in tops[:2]],
        })

    # 6) Trope recurring
    tropes = by_type.get("trope_share") or []
    if tropes:
        top_t = max(tropes, key=lambda c: float(c.value_num or 0))
        if (top_t.value_num or 0) >= 10:
            recs.append({
                "id": f"rec-trope-{top_t.id[:8]}",
                "title": "Track recurring trope frequency across batches",
                "action": (
                    f"Recurring in-sample trope signal: {top_t.value_label}. "
                    "After Next batch, use Ask Atlas run-to-run to see if share persists — "
                    "persistence across pulls is stronger than a single observation."
                ),
                "priority": "low",
                "claim_ids": [top_t.id],
                "based_on": [top_t.statement],
            })

    if not recs:
        recs.append({
            "id": f"rec-baseline-{run_id[:8]}",
            "title": "Continue structured collection",
            "action": (
                "Claims exist but no high-priority prescription fired. "
                "Expand the sample and rebuild claims to unlock stronger, evidence-bound recommendations."
            ),
            "priority": "low",
            "claim_ids": [c.id for c in claims[:3]],
            "based_on": [c.statement for c in claims[:2]],
        })

    return {
        "status": "ok",
        "run_id": run_id,
        "study_id": run.study_id,
        "n": run.collected_count,
        "recommendations": recs,
        "note": "Each recommendation is bound to claim_ids. Not market advice; sample-scoped research prescriptions.",
    }
