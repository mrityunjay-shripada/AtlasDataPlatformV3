"""Emit analysis artifacts + claims + evidence links — Phase 1 Proof backbone."""
from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisArtifact,
    Claim,
    ClaimEvidence,
    Classification,
    ResearchRun,
    Video,
)

logger = logging.getLogger(__name__)


def _clear_run_claims(db: Session, run_id: str) -> None:
    claim_ids = [c.id for c in db.query(Claim).filter_by(run_id=run_id).all()]
    if claim_ids:
        db.query(ClaimEvidence).filter(ClaimEvidence.claim_id.in_(claim_ids)).delete(synchronize_session=False)
        db.query(Claim).filter_by(run_id=run_id).delete(synchronize_session=False)
    db.query(AnalysisArtifact).filter_by(run_id=run_id).delete(synchronize_session=False)
    db.commit()


def emit_claims_for_run(db: Session, run_id: str) -> dict[str, Any]:
    run = db.query(ResearchRun).filter_by(id=run_id).first()
    if not run or not run.analysis_json:
        return {"claims": 0, "artifacts": 0, "error": "no analysis"}

    _clear_run_claims(db, run_id)
    analysis = run.analysis_json or {}
    genres = analysis.get("genre_distribution") or {}
    tropes = analysis.get("trope_distribution") or {}
    whitespace = analysis.get("whitespace_opportunities") or []
    saturation = analysis.get("saturation_notes") or []
    n = int(run.collected_count or 0)
    total = sum(int(v) for v in genres.values()) or n or 1

    videos = db.query(Video).filter_by(run_id=run_id).all()
    vid_by_yt = {v.youtube_id: v for v in videos}

    def evidence_for_genre(genre_key: str) -> list[Video]:
        out = []
        for v in videos:
            if v.classification and str(v.classification.genre).lower().replace(" ", "_") == str(genre_key).lower().replace(" ", "_"):
                out.append(v)
        return out

    def evidence_for_trope(trope_key: str) -> list[Video]:
        out = []
        for v in videos:
            if v.classification and str(v.classification.trope).lower().replace(" ", "_") == str(trope_key).lower().replace(" ", "_"):
                out.append(v)
        return out

    artifacts = 0
    claims = 0

    def add_artifact(kind: str, payload: dict, n_sample: int) -> AnalysisArtifact:
        nonlocal artifacts
        art = AnalysisArtifact(
            id=str(uuid4()),
            study_id=run.study_id,
            run_id=run_id,
            kind=kind,
            version="v1",
            n_sample=n_sample,
            payload_json=payload,
        )
        db.add(art)
        db.flush()
        artifacts += 1
        return art

    def add_claim(
        *,
        artifact: AnalysisArtifact | None,
        claim_type: str,
        statement: str,
        metric: str,
        formula: str,
        inputs: dict,
        value_num: float | None,
        value_label: str,
        evidence_videos: list[Video],
    ) -> Claim:
        nonlocal claims
        c = Claim(
            id=str(uuid4()),
            study_id=run.study_id,
            corpus_id=run.corpus_id,
            run_id=run_id,
            artifact_id=artifact.id if artifact else None,
            methodology_id=run.methodology_id,
            claim_type=claim_type,
            statement=statement,
            metric=metric,
            formula=formula,
            inputs_json=inputs,
            n_sample=n,
            value_num=value_num,
            value_label=value_label,
        )
        db.add(c)
        db.flush()
        for i, v in enumerate(evidence_videos):
            db.add(
                ClaimEvidence(
                    claim_id=c.id,
                    video_id=v.id,
                    youtube_id=v.youtube_id,
                    rank=i,
                )
            )
        claims += 1
        return c

    genre_art = add_artifact("genre_distribution", {"distribution": genres, "n": total}, n)
    for g, cnt in sorted(genres.items(), key=lambda x: -int(x[1])):
        cnt_i = int(cnt)
        pct = round(100.0 * cnt_i / total, 2)
        add_claim(
            artifact=genre_art,
            claim_type="genre_share",
            statement=f"{g} represents {pct}% of the labeled sample ({cnt_i} of {total}).",
            metric="genre_share",
            formula=f"count(genre={g}) / n_labeled = {cnt_i} / {total}",
            inputs={"kind": "genre", "key": g, "count": cnt_i, "total": total},
            value_num=pct,
            value_label=f"{g} {pct}%",
            evidence_videos=evidence_for_genre(g),
        )

    trope_art = add_artifact("trope_distribution", {"distribution": tropes, "n": total}, n)
    for t, cnt in sorted(tropes.items(), key=lambda x: -int(x[1])):
        if str(t).lower() in ("unknown", "other"):
            continue
        cnt_i = int(cnt)
        pct = round(100.0 * cnt_i / total, 2)
        add_claim(
            artifact=trope_art,
            claim_type="trope_share",
            statement=f"Trope '{t}' appears in {cnt_i} of {total} labeled videos ({pct}%).",
            metric="trope_share",
            formula=f"count(trope={t}) / n_labeled = {cnt_i} / {total}",
            inputs={"kind": "trope", "key": t, "count": cnt_i, "total": total},
            value_num=pct,
            value_label=f"{t} {pct}%",
            evidence_videos=evidence_for_trope(t),
        )

    if whitespace:
        ws_art = add_artifact("whitespace_signals", {"notes": whitespace}, n)
        for note in whitespace:
            # Signal — underrepresented in sample (not Opportunity)
            key = "unknown"
            import re
            m = re.search(r"genre ['\"]?([a-z_ ]+)['\"]?", str(note), re.I)
            if m:
                key = m.group(1).strip().replace(" ", "_")
            add_claim(
                artifact=ws_art,
                claim_type="signal_underrepresented",
                statement=f"Signal: underrepresented in the observed sample — {note}",
                metric="whitespace_signal",
                formula="count(genre)=0 in sample (signal, not market opportunity)",
                inputs={"kind": "genre", "key": key, "count": 0, "total": total, "note": note},
                value_num=0.0,
                value_label=f"{key} 0",
                evidence_videos=[],  # empty set is the evidence
            )

    if saturation:
        sat_art = add_artifact("saturation_notes", {"notes": saturation}, n)
        for note in saturation:
            add_claim(
                artifact=sat_art,
                claim_type="saturation",
                statement=str(note),
                metric="saturation_note",
                formula="top genre share in sample (descriptive)",
                inputs={"note": note},
                value_num=None,
                value_label="saturation",
                evidence_videos=[],
            )

    # Phase 2 artifacts/claims
    perf = analysis.get("performance") or {}
    if perf.get("summary"):
        perf_art = add_artifact("performance", perf, n)
        s = perf["summary"]
        add_claim(
            artifact=perf_art,
            claim_type="performance_summary",
            statement=(
                f"Sample mean views={round(float(s.get('mean_views') or 0)):,}; "
                f"median={round(float(s.get('median_views') or 0)):,}; "
                f"mean engagement proxy={s.get('mean_engagement_proxy')}."
            ),
            metric="performance_summary",
            formula="mean/median views; engagement_proxy=(likes+comments)/views",
            inputs={"summary": s},
            value_num=float(s.get("mean_views") or 0),
            value_label="mean_views",
            evidence_videos=[],
        )
        for row in (perf.get("top_by_views") or [])[:3]:
            ev = [vid_by_yt[row["youtube_id"]]] if row.get("youtube_id") in vid_by_yt else []
            add_claim(
                artifact=perf_art,
                claim_type="performance_top",
                statement=f"High-view video in sample: {row.get('title')} ({row.get('views')} views).",
                metric="top_views",
                formula="rank by views within sample",
                inputs={"youtube_id": row.get("youtube_id"), "views": row.get("views")},
                value_num=float(row.get("views") or 0),
                value_label=str(row.get("views")),
                evidence_videos=ev,
            )

    outliers = analysis.get("outliers") or {}
    if outliers.get("outliers"):
        out_art = add_artifact("outliers", outliers, n)
        for o in outliers["outliers"][:5]:
            ev = [vid_by_yt[o["youtube_id"]]] if o.get("youtube_id") in vid_by_yt else []
            add_claim(
                artifact=out_art,
                claim_type="outlier_views",
                statement=(
                    f"View outlier ({o.get('direction')}): {o.get('title')} "
                    f"modified_z={o.get('modified_z')} views={o.get('views')}."
                ),
                metric="outlier_views",
                formula="modified z-score on log1p(views), threshold=3",
                inputs=o,
                value_num=float(o.get("modified_z") or 0),
                value_label=str(o.get("modified_z")),
                evidence_videos=ev,
            )

    diag = analysis.get("diagnostic") or {}
    if diag.get("flags"):
        d_art = add_artifact("diagnostic", diag, n)
        for f in diag["flags"]:
            add_claim(
                artifact=d_art,
                claim_type="diagnostic_flag",
                statement=f"Diagnostic [{f.get('code')}]: {f.get('message')}",
                metric="diagnostic",
                formula="rule-based sample diagnostics",
                inputs=f,
                value_num=None,
                value_label=f.get("code") or "",
                evidence_videos=[],
            )

    profile = analysis.get("profile") or {}
    if profile.get("channels"):
        p_art = add_artifact("profile", profile, n)
        top = profile["channels"][0]
        add_claim(
            artifact=p_art,
            claim_type="profile_channel",
            statement=(
                f"Top contributing channel in sample: {top.get('channel')} "
                f"({top.get('videos')} videos, {top.get('views')} views)."
            ),
            metric="channel_contribution",
            formula="rank channels by video count then views within sample",
            inputs=top,
            value_num=float(top.get("videos") or 0),
            value_label=top.get("channel") or "",
            evidence_videos=[],
        )

    pot = analysis.get("potential") or {}
    if pot.get("signals") or pot.get("potentials"):
        pot_art = add_artifact("potential", pot, n)
        for s in (pot.get("signals") or [])[:8]:
            add_claim(
                artifact=pot_art,
                claim_type="signal_underrepresented",
                statement=s.get("statement") or f"Signal: {s.get('key')}",
                metric="whitespace_signal",
                formula="count in sample taxonomy (signal, not opportunity)",
                inputs=s,
                value_num=float(s.get("count") or 0),
                value_label=str(s.get("key") or ""),
                evidence_videos=[],
            )
        for s in (pot.get("potentials") or [])[:6]:
            add_claim(
                artifact=pot_art,
                claim_type="potential",
                statement=s.get("statement") or f"Potential: {s.get('key')}",
                metric="potential",
                formula="signal + in-sample performance support (not market opportunity)",
                inputs=s,
                value_num=0.0,
                value_label=str(s.get("key") or ""),
                evidence_videos=[],
            )

    prox = analysis.get("proximity") or {}
    if prox.get("top_pairs"):
        px_art = add_artifact("proximity", {"top_pairs": prox.get("top_pairs"), "method": prox.get("method")}, n)
        for pair in prox["top_pairs"][:5]:
            ev = []
            for yid in (pair.get("a"), pair.get("b")):
                if yid in vid_by_yt:
                    ev.append(vid_by_yt[yid])
            add_claim(
                artifact=px_art,
                claim_type="proximity_pair",
                statement=f"Similar in sample (score={pair.get('score')}): {pair.get('title_a')} ↔ {pair.get('title_b')}",
                metric="proximity",
                formula=prox.get("method") or "taxonomy + token Jaccard",
                inputs=pair,
                value_num=float(pair.get("score") or 0),
                value_label=str(pair.get("score")),
                evidence_videos=ev,
            )

    db.commit()
    logger.info("emit_claims run=%s artifacts=%s claims=%s", run_id, artifacts, claims)
    return {"claims": claims, "artifacts": artifacts, "run_id": run_id}


def get_claim(db: Session, claim_id: str) -> Claim | None:
    return db.query(Claim).filter_by(id=claim_id).first()


def list_claims_for_run(db: Session, run_id: str) -> list[Claim]:
    return db.query(Claim).filter_by(run_id=run_id).order_by(Claim.created_at.asc()).all()


def claim_evidence_rows(db: Session, claim_id: str) -> list[dict[str, Any]]:
    rows = (
        db.query(ClaimEvidence, Video, Classification)
        .join(Video, Video.id == ClaimEvidence.video_id)
        .outerjoin(Classification, Classification.video_id == Video.id)
        .filter(ClaimEvidence.claim_id == claim_id)
        .order_by(ClaimEvidence.rank.asc())
        .all()
    )
    out = []
    for ce, v, c in rows:
        out.append({
            "video_id": v.id,
            "youtube_id": v.youtube_id,
            "title": v.title,
            "channel": v.channel,
            "views": v.views,
            "source_url": v.source_url or f"https://www.youtube.com/watch?v={v.youtube_id}",
            "genre": c.genre if c else None,
            "trope": c.trope if c else None,
            "emotion": c.emotion if c else None,
            "hook": c.hook if c else None,
            "confidence": c.confidence if c else None,
        })
    return out
