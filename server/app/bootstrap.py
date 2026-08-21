from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.audit import AuditLog  # noqa: F401 — ensure table is registered
from app.config import get_settings
from app.database import Base, engine
from app.lifecycle import lifespan
from app.models import Document, DocumentVersion, RefreshToken, User  # noqa: F401
from app.routes import auth, documents
from app.routes.public import create_public_router
from app.security import setup_security_middleware


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    logger = logging.getLogger(__name__)

    if not os.getenv("PYTEST_CURRENT_TEST"):
        Base.metadata.create_all(bind=engine)

    logger.info("Starting %s", settings.app_name)
    logger.info("Environment: %s", settings.environment)
    logger.info("Debug mode: %s", settings.debug)
    logger.info("HTTPS enforced: %s", settings.enforce_https)

    app = FastAPI(
        title=settings.app_name,
        description="Resume & Cover Letter Builder API — self-hosted, open source",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs" if settings.debug else None,
        redoc_url="/api/redoc" if settings.debug else None,
        openapi_url="/api/openapi.json" if settings.debug else None,
    )

    os.makedirs(settings.upload_dir, exist_ok=True)
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
    app.include_router(create_public_router(debug=settings.debug, environment=settings.environment))

    return app
