from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from typing import TYPE_CHECKING, Literal, cast

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from sqlalchemy.orm import Session

from app.audit import AuditLog  # noqa: F401 — ensure table is registered
from app.auth import cleanup_expired_tokens
from app.config import get_settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import Document, DocumentVersion, RefreshToken, User  # noqa: F401
from app.routes import auth, documents
from app.schemas import ErrorResponse, HealthResponse, RootInfoResponse, SharedDocumentResponse
from app.security import setup_security_middleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Skip database initialization during test runs (tests manage their own DB)
if not os.getenv("PYTEST_CURRENT_TEST"):
    Base.metadata.create_all(bind=engine)

settings = get_settings()

logger.info("Starting %s", settings.app_name)
logger.info("Environment: %s", settings.environment)
logger.info("Debug mode: %s", settings.debug)
logger.info("HTTPS enforced: %s", settings.enforce_https)

TOKEN_CLEANUP_INTERVAL: int = 24 * 60 * 60  # seconds


async def _periodic_token_cleanup() -> None:
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
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: start background tasks on startup."""
    task = asyncio.create_task(_periodic_token_cleanup())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(
    title=settings.app_name,
    description="Resume & Cover Letter Builder API — self-hosted, open source",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
)

app.mount(
    "/uploads/profile_images",
    StaticFiles(directory=settings.upload_dir),
    name="profile_images",
)

setup_security_middleware(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")


@app.get("/", response_model=RootInfoResponse)
async def root() -> RootInfoResponse:
    """Root endpoint — basic service info."""
    return RootInfoResponse(
        message="Career Forge API",
        version="1.0.0",
        docs="/api/docs" if settings.debug else "Disabled in production",
    )


@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        environment=settings.environment,
    )


@app.get(
    "/api/shared/{share_token}",
    response_model=SharedDocumentResponse,
    responses={404: {"model": ErrorResponse, "description": "Shared document not found"}},
)
async def get_shared_document(
    share_token: str,
    db: Session = Depends(get_db),
) -> SharedDocumentResponse:
    """Public endpoint to view a shared document (no auth required)."""
    doc = db.query(Document).filter(Document.share_token == share_token).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Shared document not found")
    return SharedDocumentResponse(
        title=doc.title,
        document_type=cast("Literal['resume', 'cover_letter']", doc.document_type),
        data=doc.data,
    )
