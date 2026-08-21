from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from typing import TYPE_CHECKING

from app.auth import cleanup_expired_tokens
from app.database import SessionLocal

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI

logger = logging.getLogger(__name__)

TOKEN_CLEANUP_INTERVAL: int = 24 * 60 * 60  # seconds


async def periodic_token_cleanup() -> None:
    """Background task that purges expired refresh tokens daily."""
    while True:
        await asyncio.sleep(TOKEN_CLEANUP_INTERVAL)
        try:
            db = SessionLocal()
            try:
                deleted = cleanup_expired_tokens(db)
                if deleted:
                    logger.info("Token cleanup: removed %d expired tokens", deleted)
            finally:
                db.close()
        except Exception:
            logger.exception("Token cleanup failed")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: start background tasks on startup."""
    task = asyncio.create_task(periodic_token_cleanup())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
