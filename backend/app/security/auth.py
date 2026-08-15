from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.config import get_settings
from app.db.session import get_db
from app.db.models import UserAccount
from app.security.passwords import verify_password, hash_password

bearer = HTTPBearer(auto_error=False)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str
    role: str

class CurrentUser(BaseModel):
    username: str
    role: str

def ensure_bootstrap_admin(db: Session) -> None:
    """Create admin from env if no users exist. Password stored hashed."""
    if db.query(UserAccount).count() > 0:
        return
    s = get_settings()
    db.add(UserAccount(
        username=s.admin_username,
        password_hash=hash_password(s.admin_password),
        role="admin",
    ))
    # optional viewer
    if s.viewer_username and s.viewer_password:
        db.add(UserAccount(
            username=s.viewer_username,
            password_hash=hash_password(s.viewer_password),
            role="viewer",
        ))
    db.commit()

def authenticate(db: Session, username: str, password: str) -> Optional[UserAccount]:
    user = db.query(UserAccount).filter_by(username=username, active=True).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def create_token(username: str, role: str) -> TokenResponse:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(hours=s.jwt_expire_hours)
    token = jwt.encode(
        {"sub": username, "role": role, "exp": exp, "iat": datetime.now(timezone.utc)},
        s.jwt_secret, algorithm="HS256",
    )
    return TokenResponse(
        access_token=token,
        expires_in=s.jwt_expire_hours * 3600,
        username=username,
        role=role,
    )

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> CurrentUser:
    s = get_settings()
    if x_api_key and s.atlas_api_key and x_api_key == s.atlas_api_key:
        return CurrentUser(username="api-key-user", role="admin")
    if credentials and credentials.credentials:
        payload = decode_token(credentials.credentials)
        if payload.get("sub"):
            return CurrentUser(username=payload["sub"], role=payload.get("role") or "admin")
    if not s.is_production and not s.atlas_api_key:
        return CurrentUser(username="dev-user", role="admin")
    raise HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})

def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(403, "Admin role required")
    return user
