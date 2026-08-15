"""
Optional dedicated Render Background Worker.

Deploy as a second Render service:
  startCommand: python -m app.worker_main

Web service can set ENABLE_INLINE_WORKER=false to avoid double-processing
(or rely on job leases — both can run safely with leases).
"""
import asyncio
import logging
from app.config import get_settings
from app.db.session import init_db
from app.services.pipeline import queue_worker_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("atlas-v3-worker")

async def main():
    settings = get_settings()
    init_db()
    logger.info("Dedicated worker starting env=%s", settings.app_env)
    await queue_worker_loop()

if __name__ == "__main__":
    asyncio.run(main())
