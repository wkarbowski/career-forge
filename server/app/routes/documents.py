from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.auth import get_current_active_user
from app.config import get_settings
from app.database import get_db
from app.schemas import (
    DocumentCreate,
    DocumentExport,
    DocumentImport,
    DocumentListResponse,
    DocumentResponse,
    DocumentUpdate,
    DocumentVersionCreate,
    DocumentVersionDetailResponse,
    DocumentVersionResponse,
    ErrorResponse,
    ImageUploadResponse,
    ShareLinkResponse,
)
from app.services import document_service
from app.services.profile_images import ensure_upload_dir

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models import User

_error_responses: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "Authentication required"},
    404: {"model": ErrorResponse, "description": "Resource not found"},
    429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
}

router = APIRouter(prefix="/documents", tags=["Documents"], responses=_error_responses)

settings = get_settings()
UPLOAD_DIR: str = settings.upload_dir
ensure_upload_dir(UPLOAD_DIR)


@router.delete("/{document_id}/profile-image", status_code=204)
async def remove_profile_image(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Remove the profile image for a document."""
    document_service.remove_profile_image(
        document_id=document_id,
        current_user=current_user,
        db=db,
        upload_dir=UPLOAD_DIR,
    )


@router.post("/{document_id}/upload-image", response_model=ImageUploadResponse, status_code=200)
async def upload_profile_image(
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ImageUploadResponse:
    """Upload a profile image for a document."""
    return await document_service.upload_profile_image(
        document_id=document_id,
        file=file,
        current_user=current_user,
        db=db,
        upload_dir=UPLOAD_DIR,
    )


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    document_data: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentResponse:
    """Create a new document for the current user."""
    return document_service.create_document(document_data, current_user, db)


@router.get("/", response_model=list[DocumentListResponse])
async def list_documents(
    document_type: str | None = Query(None, pattern="^(resume|cover_letter)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[DocumentListResponse]:
    """List all documents for the current user. Optionally filter by document_type."""
    return document_service.list_documents(document_type=document_type, current_user=current_user, db=db)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentResponse:
    """Get a specific document by ID."""
    return document_service.get_document(document_id=document_id, current_user=current_user, db=db)


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentResponse:
    """Update a document."""
    return document_service.update_document(
        document_id=document_id,
        document_update=document_update,
        current_user=current_user,
        db=db,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a document."""
    document_service.delete_document(document_id=document_id, current_user=current_user, db=db)


@router.get("/{document_id}/export", response_model=DocumentExport)
async def export_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentExport:
    """Export a document as JSON."""
    return document_service.export_document(document_id=document_id, current_user=current_user, db=db)


@router.post("/import", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def import_document(
    document_import: DocumentImport,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentResponse:
    """Import a document from JSON data."""
    return document_service.import_document(document_import, current_user, db)


@router.post("/{document_id}/duplicate", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentResponse:
    """Duplicate an existing document."""
    return document_service.duplicate_document(document_id=document_id, current_user=current_user, db=db)


@router.get("/default/current", response_model=DocumentResponse)
async def get_default_document(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentResponse:
    """Get the user's default document, or the most recent one if no default is set."""
    return document_service.get_default_document(current_user=current_user, db=db)


@router.post("/{document_id}/versions", response_model=DocumentVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_version(
    document_id: int,
    body: DocumentVersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentVersionResponse:
    """Create a named snapshot of the current document state."""
    return document_service.create_version(document_id=document_id, body=body, current_user=current_user, db=db)


@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def list_versions(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[DocumentVersionResponse]:
    """List all saved versions of a document."""
    return document_service.list_versions(document_id=document_id, current_user=current_user, db=db)


@router.get("/{document_id}/versions/{version_id}", response_model=DocumentVersionDetailResponse)
async def get_version(
    document_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentVersionDetailResponse:
    """Get full data of a specific version."""
    return document_service.get_version(
        document_id=document_id,
        version_id=version_id,
        current_user=current_user,
        db=db,
    )


@router.post("/{document_id}/versions/{version_id}/restore", response_model=DocumentResponse)
async def restore_version(
    document_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DocumentResponse:
    """Restore a document to a previous version's data."""
    return document_service.restore_version(
        document_id=document_id,
        version_id=version_id,
        current_user=current_user,
        db=db,
    )


@router.delete("/{document_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(
    document_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a saved version."""
    document_service.delete_version(document_id=document_id, version_id=version_id, current_user=current_user, db=db)


@router.post("/{document_id}/share", response_model=ShareLinkResponse)
async def create_share_link(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ShareLinkResponse:
    """Generate a unique share token for a document."""
    return document_service.create_share_link(document_id=document_id, current_user=current_user, db=db)


@router.delete("/{document_id}/share", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share_link(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Revoke the share link for a document."""
    document_service.revoke_share_link(document_id=document_id, current_user=current_user, db=db)
