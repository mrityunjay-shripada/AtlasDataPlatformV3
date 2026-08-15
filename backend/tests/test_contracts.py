"""Contract tests — schema shapes and pure analysis logic (no live APIs)."""
import pytest
from app.agents.schemas import ResearchPlan, ClassificationResult, ResearchReport
from app.services.pipeline import analyze

def test_plan_schema():
    p = ResearchPlan(objective="x", target_records=15, search_queries=["a"])
    assert 5 <= p.target_records <= 50

def test_classification_schema():
    c = ClassificationResult(genre="romance", confidence=0.8)
    assert c.genre == "romance"

def test_analyze_shapes():
    class_rows = [
        {"genre": "romance", "trope": "enemies-to-lovers", "title": "A", "youtube_id": "1", "views": 100, "confidence": 0.9},
        {"genre": "romance", "trope": "betrayal", "title": "B", "youtube_id": "2", "views": 50, "confidence": 0.4},
        {"genre": "thriller", "trope": "twist", "title": "C", "youtube_id": "3", "views": 200, "confidence": 0.8},
    ]
    videos = [{"views": 100}, {"views": 50}, {"views": 200}]
    out = analyze(class_rows, videos)
    assert "genre_distribution" in out
    assert out["genre_distribution"]["romance"] == 2
    assert "evidence_by_genre" in out
    assert out["low_confidence_count"] == 1

def test_report_schema_keys():
    r = ResearchReport(
        title="t", executive_summary="e", research_objective="o", methodology="m",
        dataset_overview="d", genre_analysis="g", storytelling_pattern_analysis="s",
        engagement_analysis="en", genre_saturation="gs", whitespace_opportunities="w",
        limitations="l", conclusion="c",
    )
    assert r.title == "t"
