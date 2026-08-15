import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes.auth import router as auth_router
from app.api.routes.mcp import router as mcp_router
from app.api.routes.ops import router as ops_router
from app.api.routes.public import router as public_router
from app.api.routes.research import router as research_router
from app.config import get_settings
from app.db.session import init_db
from app.services.pipeline import queue_worker_loop
from app.observability.metrics import incr

logger = logging.getLogger("atlasdataplatform-v3")

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    init_db()
    task = None
    if settings.enable_inline_worker:
        task = asyncio.create_task(queue_worker_loop())
        logger.info("Atlas Data Platform V3 %s inline worker ON", settings.app_version)
    else:
        logger.info("Atlas Data Platform V3 %s inline worker OFF", settings.app_version)
    yield
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

settings = get_settings()
app = FastAPI(
    title="Atlas Data Platform V3",
    version=settings.app_version,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list if settings.cors_list != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    incr("http.requests")
    try:
        response = await call_next(request)
        incr(f"http.status.{response.status_code}")
        return response
    except Exception:
        incr("http.exceptions")
        raise

app.include_router(auth_router)
app.include_router(research_router)
app.include_router(public_router)
app.include_router(mcp_router)
app.include_router(ops_router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "atlasdataplatform-v3", "version": settings.app_version}

@app.get("/ready")
async def ready():
    try:
        from app.db.session import SessionLocal
        from app.db.models import ResearchRun
        db = SessionLocal()
        db.query(ResearchRun).limit(1).all()
        db.close()
        return {"status": "ready", "database": "ok"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "not_ready", "error": str(e)})

@app.get("/api/v1/health")
async def health_v1():
    return await health()
