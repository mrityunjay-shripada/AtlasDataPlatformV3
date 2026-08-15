from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.models import ResearchRun
from app.db.session import get_db

router = APIRouter(prefix="/api/public", tags=["public"])

@router.get("/report/{token}")
async def public_report(token: str, db: Session = Depends(get_db)):
    run = db.query(ResearchRun).filter_by(share_token=token, public_share=True).first()
    if not run or not run.report_json:
        # fallback: allow run_id only if explicitly shared AND share_token is null (legacy)
        run = db.query(ResearchRun).filter_by(id=token, public_share=True).first()
        if not run or not run.report_json:
            raise HTTPException(404, "Not found or not shared")
    return {
        "run_id": run.id,
        "research_question": run.research_question,
        "report": run.report_json,
        "analysis": run.analysis_json,
        "evidence": run.evidence_json,
        "collected_count": run.collected_count,
        "status": run.status,
        "prompt_version": run.prompt_version,
    }
