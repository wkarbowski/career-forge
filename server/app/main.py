import os
import asyncio

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from app.config import get_settings
from app.database import engine, Base, get_db, SessionLocal
from app.routes import auth, documents
from app.security import setup_security_middleware
from app.models import User, Document, DocumentVersion, RefreshToken  # noqa: F401
from app.schemas import SharedDocumentResponse
from app.audit import AuditLog  # noqa: F401
from app.auth import cleanup_expired_tokens

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

settings = get_settings()

logger.info(f"Starting {settings.app_name}")
logger.info(f"Environment: {settings.environment}")
logger.info(f"Debug mode: {settings.debug}")
logger.info(f"HTTPS enforced: {settings.enforce_https}")

if settings.debug and settings.is_production:
    logger.critical("❌ FATAL: DEBUG=true in production environment!")
    raise RuntimeError(
        "Cannot run with DEBUG=true when ENVIRONMENT=production. "
        "Set DEBUG=false in your .env file for production deployment."
    )

app = FastAPI(
    title=settings.app_name,
    description="Resume & Cover Letter Builder API — self-hosted, open source",
    version="1.0.0",
    docs_url="/api/docs" if settings.debug else None,  # Disable docs in production
    redoc_url="/api/redoc" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None
)

UPLOADS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads', 'profile_images')
app.mount("/uploads/profile_images", StaticFiles(directory=UPLOADS_PATH), name="profile_images")

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

# Optional extended modules — loaded only when CLOUD_FEATURES=true
if settings.cloud_features:
    try:
        from app.cloud import setup_cloud_routes  # type: ignore[import]
        setup_cloud_routes(app)
        logger.info("✅ Extended modules loaded")
    except ImportError as exc:
        logger.warning(
            "CLOUD_FEATURES=true but app.cloud package not found — "
            "extended routes will not be available. (%s)", exc
        )


TOKEN_CLEANUP_INTERVAL = 24 * 60 * 60  # 24 hours


async def _periodic_token_cleanup():
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


@app.on_event("startup")
async def start_token_cleanup():
    asyncio.create_task(_periodic_token_cleanup())


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "message": "Career Forge API",
        "version": "1.0.0",
        "docs": "/api/docs" if settings.debug else "Disabled in production"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.environment
    }


@app.get("/api/shared/{share_token}", response_model=SharedDocumentResponse)
async def get_shared_document(share_token: str, db: Session = Depends(get_db)):
    """Public endpoint to view a shared document (no auth required)."""
    doc = db.query(Document).filter(Document.share_token == share_token).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Shared document not found")
    return SharedDocumentResponse(
        title=doc.title,
        document_type=doc.document_type,
        data=doc.data,
    )
