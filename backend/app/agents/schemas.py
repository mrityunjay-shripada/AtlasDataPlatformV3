from typing import List
from pydantic import BaseModel, Field

class ResearchPlan(BaseModel):
    objective: str
    target_records: int = Field(ge=5, le=50, default=30)
    search_queries: List[str] = Field(default_factory=list)
    analysis_dimensions: List[str] = Field(default_factory=lambda: [
        "genre", "trope", "hook", "emotion", "story_structure"
    ])

class ClassificationResult(BaseModel):
    genre: str
    subgenre: str = ""
    hook: str = ""
    trope: str = ""
    emotion: str = ""
    conflict: str = ""
    story_structure: str = ""
    ending_type: str = ""
    confidence: float = Field(ge=0, le=1, default=0.7)

class ResearchReport(BaseModel):
    title: str
    executive_summary: str
    research_objective: str
    methodology: str
    dataset_overview: str
    genre_analysis: str
    storytelling_pattern_analysis: str
    engagement_analysis: str
    genre_saturation: str
    whitespace_opportunities: str
    limitations: str
    conclusion: str
