"""Research Study / Corpus / Methodology — Phase 0."""
from __future__ import annotations

from uuid import uuid4
from sqlalchemy.orm import Session
from app.db.models import ResearchStudy, Methodology, Corpus, ResearchRun

DEFAULT_METHODOLOGY_SPEC = {
    "name": "YouTube micro-drama sample methodology",
    "scope": "youtube_micro_drama",
    "inclusion": "Videos returned by planned YouTube search queries for the research question",
    "taxonomy": ["genre", "trope", "emotion", "hook"],
    "metrics": {
        "genre_share": "count(genre=g) / n_labeled",
        "trope_share": "count(trope=t) / n_labeled",
    },
    "language_rules": {
        "signal": "Underrepresented in the observed sample",
        "potential": "Signal plus supporting performance/trend evidence under methodology",
        "opportunity": "Not default UI language unless methodology permits",
        "emerging_in_sample": "Recurring trope frequency within a single pull — not a time trend",
    },
    "limitations": [
        "Figures describe this sample only, not the full YouTube market",
        "Search ranking and quota shape the observed set",
    ],
}


def ensure_default_study(db: Session, owner: str = "admin") -> tuple[ResearchStudy, Methodology, Corpus]:
    study = db.query(ResearchStudy).filter_by(owner=owner).order_by(ResearchStudy.created_at.asc()).first()
    if not study:
        study = ResearchStudy(
            id=str(uuid4()),
            title="Default Research Study",
            description="Auto-created for Atlas Data Platform V3. Holds micro-drama research runs.",
            owner=owner,
        )
        db.add(study)
        db.flush()
    method = db.query(Methodology).filter_by(study_id=study.id).order_by(Methodology.created_at.asc()).first()
    if not method:
        method = Methodology(
            id=str(uuid4()),
            study_id=study.id,
            version="v1",
            name=DEFAULT_METHODOLOGY_SPEC["name"],
            spec_json=DEFAULT_METHODOLOGY_SPEC,
        )
        db.add(method)
        db.flush()
    corpus = db.query(Corpus).filter_by(study_id=study.id).order_by(Corpus.created_at.asc()).first()
    if not corpus:
        corpus = Corpus(id=str(uuid4()), study_id=study.id, name="Primary corpus")
        db.add(corpus)
        db.flush()
    db.commit()
    return study, method, corpus


def attach_run_to_study(
    db: Session,
    run: ResearchRun,
    owner: str = "admin",
    parent_run_id: str | None = None,
    run_kind: str = "seed",
) -> ResearchRun:
    study, method, corpus = ensure_default_study(db, owner=owner)
    if not getattr(run, "study_id", None):
        run.study_id = study.id
    if not getattr(run, "corpus_id", None):
        run.corpus_id = corpus.id
    if not getattr(run, "methodology_id", None):
        run.methodology_id = method.id
    if parent_run_id:
        run.parent_run_id = parent_run_id
    run.run_kind = run_kind or "seed"
    db.add(run)
    db.commit()
    return run


def backfill_orphan_runs(db: Session, owner: str = "admin") -> int:
    study, method, corpus = ensure_default_study(db, owner=owner)
    n = 0
    for run in db.query(ResearchRun).filter(
        (ResearchRun.study_id.is_(None)) | (ResearchRun.study_id == "")
    ).all():
        run.study_id = study.id
        run.corpus_id = corpus.id
        run.methodology_id = method.id
        if not run.run_kind:
            run.run_kind = "seed"
        n += 1
    db.commit()
    return n
