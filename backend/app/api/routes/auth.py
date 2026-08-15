from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.security.auth import (
    LoginRequest, TokenResponse, authenticate, create_token,
    get_current_user, CurrentUser, ensure_bootstrap_admin,
)
from app.services.audit import audit

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ensure_bootstrap_admin(db)
    user = authenticate(db, body.username, body.password)
    if not user:
        audit(db, body.username, "login_failed", ip=request.client.host if request.client else None)
        raise HTTPException(401, "Incorrect username or password")
    audit(db, user.username, "login", ip=request.client.host if request.client else None)
    return create_token(user.username, user.role)

@router.get("/me")
async def me(user: CurrentUser = Depends(get_current_user)):
    return {"username": user.username, "role": user.role, "authenticated": True}
