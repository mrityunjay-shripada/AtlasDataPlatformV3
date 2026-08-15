from typing import Any, Dict
from uuid import uuid4
from app.db.session import SessionLocal
from app.db.models import ResearchRun
from app.agents.schemas import ResearchPlan
from app.services.pipeline import plan as make_plan

TOOLS = [
    {"name": "atlas_plan_research", "description": "Create a research plan (no collection)."},
    {"name": "atlas_collect_youtube", "description": "Queue a full durable research run."},
    {"name": "atlas_get_dataset", "description": "Get dataset for a run."},
    {"name": "atlas_analyze", "description": "Get analysis JSON for a run."},
    {"name": "atlas_generate_report", "description": "Get report JSON for a run."},
]

async def execute_tool(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        if name == "atlas_plan_research":
            p = await make_plan(arguments["research_question"], int(arguments.get("target_records") or 30))
            return {"plan": p.model_dump()}
        if name == "atlas_collect_youtube":
            from datetime import datetime
            run = ResearchRun(
                id=str(uuid4()),
                research_question=arguments["research_question"],
                status="queued",
                stage_checkpoint="queued",
                target_records=min(int(arguments.get("target_records") or 30), 50),
            )
            db.add(run)
            db.commit()
            return {"run_id": run.id, "status": "queued"}
        if name == "atlas_get_dataset":
            run = db.query(ResearchRun).filter_by(id=arguments["run_id"]).first()
            if not run:
                return {"error": "not found"}
            return {"run_id": run.id, "status": run.status, "collected_count": run.collected_count}
        if name == "atlas_analyze":
            run = db.query(ResearchRun).filter_by(id=arguments["run_id"]).first()
            return {"analysis": run.analysis_json} if run else {"error": "not found"}
        if name == "atlas_generate_report":
            run = db.query(ResearchRun).filter_by(id=arguments["run_id"]).first()
            return {"report": run.report_json} if run else {"error": "not found"}
        return {"error": f"unknown tool {name}"}
    finally:
        db.close()
