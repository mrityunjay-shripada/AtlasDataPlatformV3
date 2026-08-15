from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.models import PromptRegistry

DEFAULTS = {
    "plan": (
        "You plan YouTube micro-drama research. Output JSON only. "
        "Prefer 6-8 search queries. target_records within allowed bounds."
    ),
    "classify": (
        "Classify YouTube micro-drama. JSON: genre, subgenre, hook, trope, emotion, "
        "conflict, story_structure, ending_type, confidence. "
        "genre in: romance,thriller,family,revenge,comedy,tragedy,mystery,slice_of_life,supernatural,other."
    ),
    "report": (
        "Write a grounded research report as JSON matching the schema. "
        "Never invent numbers or video IDs. Cite only provided evidence pins. "
        "Use careful language (underrepresented, appears frequently)."
    ),
}

def seed_prompts(db: Session) -> None:
    s = get_settings()
    for name, body in DEFAULTS.items():
        exists = db.query(PromptRegistry).filter_by(name=name, version=s.prompt_version).first()
        if not exists:
            db.add(PromptRegistry(name=name, version=s.prompt_version, body=body, active=True))
    db.commit()

def get_prompt(db: Session, name: str) -> str:
    row = (
        db.query(PromptRegistry)
        .filter_by(name=name, active=True)
        .order_by(PromptRegistry.id.desc())
        .first()
    )
    if row:
        return row.body
    return DEFAULTS.get(name, "")
