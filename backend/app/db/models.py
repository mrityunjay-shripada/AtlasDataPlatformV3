"""Postgres models — production system of record for Atlas Data Platform V3."""
from datetime import datetime
from sqlalchemy import (
    String, Text, Integer, Float, DateTime, Boolean, ForeignKey, Index, JSON, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

class ResearchRun(Base):
    __tablename__ = "research_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    research_question: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    target_records: Mapped[int] = mapped_column(Integer, default=30)
    collected_count: Mapped[int] = mapped_column(Integer, default=0)
    classified_count: Mapped[int] = mapped_column(Integer, default=0)
    stage_checkpoint: Mapped[str] = mapped_column(String(32), default="queued")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    plan_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    analysis_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    report_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evidence_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    stats_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cost_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    prompt_version: Mapped[str] = mapped_column(String(32), default="vr_v1")
    analysis_version: Mapped[str] = mapped_column(String(32), default="stats_v1")
    public_share: Mapped[bool] = mapped_column(Boolean, default=False)
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    created_by: Mapped[str] = mapped_column(String(64), default="admin")
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    locked_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # V3 Phase 0 — Research Study / Corpus linkage (nullable for legacy runs)
    study_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    corpus_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    methodology_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    parent_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    run_kind: Mapped[str] = mapped_column(String(32), default="seed")  # seed | batch | refresh

    videos: Mapped[list["Video"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    events: Mapped[list["RunEvent"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Video(Base):
    __tablename__ = "videos"
    __table_args__ = (UniqueConstraint("run_id", "youtube_id", name="uq_videos_run_yt"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    youtube_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    channel: Mapped[str] = mapped_column(String(255), default="")
    source_url: Mapped[str] = mapped_column(String(512), default="")
    publish_date: Mapped[str | None] = mapped_column(String(64), nullable=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    raw_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    classify_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped["ResearchRun"] = relationship(back_populates="videos")
    classification: Mapped["Classification | None"] = relationship(
        back_populates="video", uselist=False, cascade="all, delete-orphan"
    )


class Classification(Base):
    __tablename__ = "classifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), unique=True)
    youtube_id: Mapped[str] = mapped_column(String(32), index=True)
    genre: Mapped[str] = mapped_column(String(64), default="other")
    subgenre: Mapped[str] = mapped_column(String(128), default="")
    hook: Mapped[str] = mapped_column(String(128), default="")
    trope: Mapped[str] = mapped_column(String(128), default="")
    emotion: Mapped[str] = mapped_column(String(128), default="")
    conflict: Mapped[str] = mapped_column(String(128), default="")
    story_structure: Mapped[str] = mapped_column(String(128), default="")
    ending_type: Mapped[str] = mapped_column(String(64), default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    model: Mapped[str] = mapped_column(String(64), default="")
    prompt_version: Mapped[str] = mapped_column(String(32), default="vr_v1")
    review_status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|accepted|rejected
    reviewed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    video: Mapped["Video"] = relationship(back_populates="classification")


class YoutubeCache(Base):
    __tablename__ = "youtube_cache"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    units_estimated: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClassificationCache(Base):
    __tablename__ = "classification_cache"
    youtube_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    model: Mapped[str] = mapped_column(String(64), default="")
    prompt_version: Mapped[str] = mapped_column(String(32), default="vr_v1")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RunEvent(Base):
    """Append-only stage log for audit and debugging."""
    __tablename__ = "run_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(32), index=True)
    event: Mapped[str] = mapped_column(String(32), default="stage")  # stage|error|info
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    run: Mapped["ResearchRun"] = relationship(back_populates="events")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    resource: Mapped[str | None] = mapped_column(String(128), nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class PromptRegistry(Base):
    __tablename__ = "prompt_registry"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), index=True)  # plan|classify|report
    version: Mapped[str] = mapped_column(String(32))
    body: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("name", "version", name="uq_prompt_name_ver"),)


class QuotaLedger(Base):
    """Estimated YouTube API units used per day."""
    __tablename__ = "quota_ledger"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    day: Mapped[str] = mapped_column(String(10), unique=True, index=True)  # YYYY-MM-DD
    youtube_units: Mapped[int] = mapped_column(Integer, default=0)
    gemini_calls: Mapped[int] = mapped_column(Integer, default=0)
    groq_calls: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserAccount(Base):
    __tablename__ = "user_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="admin")  # admin|viewer
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RateLimitBucket(Base):
    __tablename__ = "rate_limit_buckets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bucket_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    window_start: Mapped[datetime] = mapped_column(DateTime)
    count: Mapped[int] = mapped_column(Integer, default=0)


class ResearchMemoryChunk(Base):
    """Research-memory RAG: report sections + structured claims (not live YouTube scrape)."""
    __tablename__ = "research_memory_chunks"
    __table_args__ = (
        Index("ix_memory_run_type", "run_id", "source_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(32), default="claim")  # claim | report
    claim_key: Mapped[str] = mapped_column(String(128), default="")  # e.g. genre:romance
    title: Mapped[str] = mapped_column(String(255), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    n_sample: Mapped[int] = mapped_column(Integer, default=0)
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)
    meta_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)



# --- Atlas Data Platform V3: Study / Methodology / Corpus / Artifacts / Claims ---

class ResearchStudy(Base):
    """User-facing research study (Command Center root object)."""
    __tablename__ = "research_studies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(512), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    owner: Mapped[str] = mapped_column(String(64), default="admin", index=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Methodology(Base):
    """Versioned research methodology bound to a study."""
    __tablename__ = "methodologies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    study_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_studies.id", ondelete="CASCADE"), index=True)
    version: Mapped[str] = mapped_column(String(32), default="v1")
    name: Mapped[str] = mapped_column(String(255), default="Default micro-drama methodology")
    spec_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Corpus(Base):
    """Technical corpus under a study (multi-run dataset container)."""
    __tablename__ = "corpora"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    study_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_studies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), default="Primary corpus")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AnalysisArtifact(Base):
    """Result of an analytical operation (distributions, outliers, etc.)."""
    __tablename__ = "analysis_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    study_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(64), index=True)  # genre_distribution | trope_distribution | whitespace | saturation
    version: Mapped[str] = mapped_column(String(32), default="v1")
    n_sample: Mapped[int] = mapped_column(Integer, default=0)
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Claim(Base):
    """Specific assertion derived from an artifact — Proof backbone."""
    __tablename__ = "claims"
    __table_args__ = (Index("ix_claims_run_type", "run_id", "claim_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    study_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    corpus_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_runs.id", ondelete="CASCADE"), index=True)
    artifact_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("analysis_artifacts.id", ondelete="SET NULL"), nullable=True)
    methodology_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    claim_type: Mapped[str] = mapped_column(String(64), index=True)  # genre_share | trope_share | signal_underrepresented | saturation
    statement: Mapped[str] = mapped_column(Text, default="")
    metric: Mapped[str] = mapped_column(String(128), default="")
    formula: Mapped[str] = mapped_column(String(255), default="")
    inputs_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    n_sample: Mapped[int] = mapped_column(Integer, default=0)
    value_num: Mapped[float | None] = mapped_column(Float, nullable=True)
    value_label: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClaimEvidence(Base):
    """Links a claim to underlying video rows."""
    __tablename__ = "claim_evidence"
    __table_args__ = (UniqueConstraint("claim_id", "video_id", name="uq_claim_video"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    claim_id: Mapped[str] = mapped_column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), index=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    youtube_id: Mapped[str] = mapped_column(String(32), default="")
    rank: Mapped[int] = mapped_column(Integer, default=0)



class Monitor(Base):
    """Watch a research study for refresh / pulse (Phase 5)."""
    __tablename__ = "monitors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    study_id: Mapped[str] = mapped_column(String(36), ForeignKey("research_studies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255), default="Study monitor")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    cadence_hours: Mapped[int] = mapped_column(Integer, default=24)
    last_refresh_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    config_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MonitorEvent(Base):
    __tablename__ = "monitor_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    monitor_id: Mapped[str] = mapped_column(String(36), ForeignKey("monitors.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(64), default="info")  # refresh_queued | pulse | insufficient_data
    message: Mapped[str] = mapped_column(Text, default="")
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
