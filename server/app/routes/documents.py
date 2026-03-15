import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import UploadFile, File, Depends, HTTPException, status, APIRouter, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Document
from app.schemas import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListResponse, DocumentExport, DocumentImport
from app.auth import get_current_active_user
from app.security import InputSanitizer

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '..', 'uploads', 'profile_images')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Raster-only allowlist — SVG is excluded because static SVG files served from
# the same origin can execute embedded JavaScript (XSS).
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

@router.post("/{document_id}/upload-image", status_code=200)
async def upload_profile_image(
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload a profile image for a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, GIF, and WebP images are allowed"
        )

    # Enforce server-side file size limit (defence-in-depth alongside Nginx)
    content = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")

    # Save file
    filename = f"doc_{document_id}_{int(datetime.now(timezone.utc).timestamp())}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(content)
    # Delete old image file if one existed
    if doc.profile_image:
        old_path = os.path.join(UPLOAD_DIR, doc.profile_image)
        if os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass
    doc.profile_image = filename
    db.commit()
    db.refresh(doc)
    return {"url": f"/uploads/profile_images/{filename}"}


def sanitize_document_data(data):
    """
    Recursively sanitize document data.
    Every string is passed through bleach so inline styles (font-size, color, etc.)
    are preserved while dangerous tags/attributes are still stripped.
    """
    if isinstance(data, dict):
        return {k: sanitize_document_data(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_document_data(item) for item in data]
    if isinstance(data, str):
        return InputSanitizer.sanitize_html(data)
    return data


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    document_data: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new document for the current user."""
    sanitized_title = InputSanitizer.sanitize_string(document_data.title)
    sanitized_data = sanitize_document_data(document_data.data) if isinstance(document_data.data, dict) else document_data.data

    new_document = Document(
        title=sanitized_title,
        document_type=document_data.document_type,
        data=sanitized_data,
        owner_id=current_user.id
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)
    return new_document


@router.get("/", response_model=List[DocumentListResponse])
async def list_documents(
    document_type: Optional[str] = Query(None, pattern="^(resume|cover_letter)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all documents for the current user. Optionally filter by document_type."""
    query = db.query(Document).filter(Document.owner_id == current_user.id)
    if document_type:
        query = query.filter(Document.document_type == document_type)
    return query.all()


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific document by ID."""
    doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    return doc


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_update: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Update fields if provided (with sanitization)
    if document_update.title is not None:
        doc.title = InputSanitizer.sanitize_string(document_update.title)

    if document_update.document_type is not None:
        doc.document_type = document_update.document_type

    if document_update.data is not None:
        doc.data = sanitize_document_data(document_update.data) if isinstance(document_update.data, dict) else document_update.data

    if document_update.is_default is not None:
        # If setting as default, unset other defaults
        if document_update.is_default:
            db.query(Document).filter(
                Document.owner_id == current_user.id,
                Document.id != document_id
            ).update({"is_default": False})
        doc.is_default = document_update.is_default

    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    db.delete(doc)
    db.commit()

    return None


@router.get("/{document_id}/export", response_model=DocumentExport)
async def export_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export a document as JSON."""
    doc = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    return DocumentExport(
        title=doc.title,
        document_type=doc.document_type,
        data=doc.data,
        exported_at=datetime.now(timezone.utc)
    )


@router.post("/import", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def import_document(
    document_import: DocumentImport,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Import a document from JSON data."""
    sanitized_title = InputSanitizer.sanitize_string(document_import.title or "Imported Document")
    sanitized_data = sanitize_document_data(document_import.data) if isinstance(document_import.data, dict) else document_import.data

    new_document = Document(
        title=sanitized_title,
        document_type=document_import.document_type,
        data=sanitized_data,
        owner_id=current_user.id
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)
    return new_document


@router.post("/{document_id}/duplicate", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Duplicate an existing document."""
    original = db.query(Document).filter(Document.id == document_id, Document.owner_id == current_user.id).first()

    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    new_document = Document(
        title=InputSanitizer.sanitize_string(f"{original.title} (Copy)"),
        document_type=original.document_type,
        data=original.data,
        owner_id=current_user.id
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)
    return new_document


@router.get("/default/current", response_model=DocumentResponse)
async def get_default_document(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the user's default document, or the most recent one if no default is set."""
    doc = db.query(Document).filter(
        Document.owner_id == current_user.id,
        Document.is_default
    ).first()

    if not doc:
        # Fall back to most recently updated document
        doc = db.query(Document).filter(
            Document.owner_id == current_user.id
        ).order_by(Document.updated_at.desc()).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No documents found"
        )

    return doc
