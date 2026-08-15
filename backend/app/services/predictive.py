"""Phase 7 — Predictive layer (architecture present, honest when thin).

Observations come from:
  - distinct completed runs on a study, and/or
  - Next-batch snapshots stored on a run (same run expanded over time)

Does NOT invent market forecasts from a single snapshot.
"""
from __future__ import annotations

from typing import Any
from sqlalchemy.orm import Session
from app.db.models import ResearchRun
from app.services.continuous import list_study_runs, build_pulse, collect_study_observations


MIN_OBSERVATIONS = 3


def build_predictive(db: Session, study_id: str | None = None, run_id: str | None = None) -> dict[str, Any]:
    if not study_id and run_id:
        run = db.query(ResearchRun).filter_by(id=run_id).first()
        study_id = run.study_id if run else None
    if not study_id:
        return {
            "status": "insufficient_data",
            "message": "No research study linked. Open a run that belongs to a study.",
            "forecasts": [],
            "observation_count": 0,
            "min_required": MIN_OBSERVATIONS,
        }

    runs = list_study_runs(db, study_id)
    observations = collect_study_observations(db, study_id)
    n_obs = len(observations)
    pulse = build_pulse(db, study_id)

    base = {
        "study_id": study_id,
        "observation_count": n_obs,
        "run_count": len(runs),
        "min_required": MIN_OBSERVATIONS,
        "pulse_status": pulse.get("status"),
        "method": (
            "Share delta between first and last observation (runs or Next-batch snapshots) — "
            "illustrative trajectory inside this study, not a market forecast."
        ),
    }

    if n_obs < MIN_OBSERVATIONS:
        # Honest guidance: Next batch helps only after snapshotting is on
        batch_hint = (
            "Each completed Next batch now stores a snapshot. "
            f"Need {MIN_OBSERVATIONS - n_obs} more completed observation(s) "
            "(Next batch after this deploy, or additional runs on the same study)."
        )
        if n_obs == 1 and any((r.plan_json or {}).get("batch_index", 1) >= 2 for r in runs):
            batch_hint = (
                "This study already grew via Next batch, but earlier batches were not snapshotted. "
                f"Complete {MIN_OBSERVATIONS - 1} more Next batch(es) or study runs after this update "
                "so Atlas can store intermediate observations."
            )
        return {
            **base,
            "status": "insufficient_data",
            "message": (
                f"Predictive needs at least {MIN_OBSERVATIONS} sample observations "
                f"(currently {n_obs} observation(s) across {len(runs)} run(s)). {batch_hint}"
            ),
            "forecasts": [],
            "series": observations,
        }

    series = observations
    if len(series) < 2:
        return {
            **base,
            "status": "insufficient_data",
            "message": "Not enough series points to form a trajectory.",
            "forecasts": [],
            "series": series,
        }

    first, last = series[0], series[-1]
    genre = last.get("top_genre") or first.get("top_genre")
    s0 = float(first.get("top_genre_share") or 0)
    s1 = float(last.get("top_genre_share") or 0)
    delta = s1 - s0
    direction = "rising" if delta > 0.02 else ("falling" if delta < -0.02 else "stable")

    forecasts = []
    if genre and genre != "—":
        forecasts.append({
            "target": f"share:{genre}",
            "label": f"{genre} share in this study",
            "from_share": s0,
            "to_share": s1,
            "delta": round(delta, 4),
            "direction": direction,
            "confidence": "limited",
            "note": (
                "Based only on successive samples in this research study "
                "(including Next-batch snapshots). Not a market forecast."
            ),
        })

    return {
        **base,
        "status": "ok",
        "message": f"Illustrative trajectory from {n_obs} observations in this study.",
        "forecasts": forecasts,
        "series": series,
        "note": "Descriptive trajectory inside this study — not external market prediction.",
    }
