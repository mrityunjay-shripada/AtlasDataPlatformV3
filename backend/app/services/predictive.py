
"""Phase 7 — Predictive layer (architecture present, honest when thin).

Requires multiple observations in a research study (Pulse series).
Does NOT invent market forecasts from a single pull.
"""
from __future__ import annotations

from typing import Any
from sqlalchemy.orm import Session
from app.db.models import ResearchRun
from app.services.continuous import list_study_runs, build_pulse


MIN_OBSERVATIONS = 3  # stricter than pulse (2) for any "forecast-like" language


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
    n_obs = len(runs)
    pulse = build_pulse(db, study_id)

    base = {
        "study_id": study_id,
        "observation_count": n_obs,
        "min_required": MIN_OBSERVATIONS,
        "pulse_status": pulse.get("status"),
        "method": (
            "Linear share delta between first and last observation only — "
            "illustrative trajectory inside this study, not a market forecast."
        ),
    }

    if n_obs < MIN_OBSERVATIONS:
        return {
            **base,
            "status": "insufficient_data",
            "message": (
                f"Predictive needs at least {MIN_OBSERVATIONS} completed runs in this research study "
                f"(currently {n_obs}). Use Next batch and/or Refresh, then return here."
            ),
            "forecasts": [],
            "series": pulse.get("series") or [],
        }

    series = pulse.get("series") or []
    if len(series) < 2:
        return {
            **base,
            "status": "insufficient_data",
            "message": "Not enough pulse series points to form a trajectory.",
            "forecasts": [],
            "series": series,
        }

    first, last = series[0], series[-1]
    # Genre share trajectory for top genre of latest
    genre = last.get("top_genre") or first.get("top_genre")
    s0 = float(first.get("top_genre_share") or 0)
    s1 = float(last.get("top_genre_share") or 0)
    delta = s1 - s0
    # naive one-step projection (same delta) — clearly labeled illustrative
    projected = max(0.0, min(1.0, s1 + delta))

    mv0 = first.get("mean_views")
    mv1 = last.get("mean_views")
    views_forecast = None
    if mv0 is not None and mv1 is not None:
        dmv = float(mv1) - float(mv0)
        views_forecast = {
            "metric": "mean_views",
            "first": mv0,
            "last": mv1,
            "delta": dmv,
            "illustrative_next": max(0.0, float(mv1) + dmv),
            "claim": (
                f"Mean views moved {float(mv0):,.0f} → {float(mv1):,.0f} across observations. "
                f"Illustrative next step if the same delta repeated: {max(0.0, float(mv1) + dmv):,.0f}. "
                "Not a forecast of YouTube demand."
            ),
        }

    forecasts = [
        {
            "metric": "top_genre_share",
            "genre": genre,
            "first_share": s0,
            "last_share": s1,
            "delta": delta,
            "illustrative_next_share": projected,
            "claim": (
                f"Share of '{genre}' moved {s0:.0%} → {s1:.0%} from first to last observation in this study. "
                f"Illustrative next share if the same delta repeated: {projected:.0%}. "
                "This is not a prediction of the overall market."
            ),
            "confidence": "low",
            "basis": "first_vs_last_linear_delta",
        }
    ]
    if views_forecast:
        forecasts.append({**views_forecast, "confidence": "low", "basis": "first_vs_last_linear_delta"})

    return {
        **base,
        "status": "ok",
        "message": (
            f"Illustrative trajectories from {n_obs} study observations. "
            "Low confidence. Use Evidence and Pulse before any decision."
        ),
        "forecasts": forecasts,
        "series": series,
        "disclaimer": (
            "Predictive outputs are study-internal illustrations only. "
            "They do not estimate total addressable demand, ranking algorithms, or future virality."
        ),
    }
