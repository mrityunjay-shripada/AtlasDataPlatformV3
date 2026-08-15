from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.mcp.tools import TOOLS, execute_tool
from app.security.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/api/mcp", tags=["mcp"])

class CallBody(BaseModel):
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)

@router.get("/tools")
async def list_tools(user: CurrentUser = Depends(get_current_user)):
    return {"tools": TOOLS}

@router.post("/call")
async def call_tool(body: CallBody, user: CurrentUser = Depends(get_current_user)):
    if body.name not in {t["name"] for t in TOOLS}:
        raise HTTPException(404, "Unknown tool")
    result = await execute_tool(body.name, body.arguments)
    return {"name": body.name, "result": result}
