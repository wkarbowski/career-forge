from __future__ import annotations

from typing import TYPE_CHECKING, Literal, cast

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models import Document
from app.schemas import ErrorResponse, HealthResponse, RootInfoResponse, SharedDocumentResponse

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def create_public_router(*, debug: bool, environment: str) -> APIRouter:
    router = APIRouter()

    @router.get("/", response_model=RootInfoResponse)
    async def root() -> RootInfoResponse:
        """Root endpoint — basic service info."""
        return RootInfoResponse(
            message="Career Forge API",
            version="1.0.0",
            docs="/api/docs" if debug else "Disabled in production",
        )

    @router.get("/api/health", response_model=HealthResponse)
    async def health_check() -> HealthResponse:
        """Health check endpoint."""
        return HealthResponse(
            status="healthy",
            environment=environment,
        )

    @router.get(
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

    return router
