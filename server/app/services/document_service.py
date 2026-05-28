"""Document business workflows."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Literal, cast

from fastapi import HTTPException, status

from app.repositories import document_versions as version_repo
from app.repositories import documents as document_repo
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
    ImageUploadResponse,
    ShareLinkResponse,
)
from app.security import InputSanitizer
from app.services import profile_images

if TYPE_CHECKING:
    from fastapi import UploadFile
    from sqlalchemy.orm import Session

    from app.models import Document, User

MAX_VERSIONS_PER_DOCUMENT = 20


def sanitize_document_data(data: Any) -> Any:
    """Recursively sanitize document data while preserving safe rich text."""
    if isinstance(data, dict):
        return {k: sanitize_document_data(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_document_data(item) for item in data]
    if isinstance(data, str):
        return InputSanitizer.sanitize_html(data)
    return data


def _sanitize_data_if_needed(data: dict[str, Any]) -> dict[str, Any]:
    sanitized = sanitize_document_data(data)
    return cast("dict[str, Any]", sanitized)


def _get_user_document_or_404(db: Session, *, document_id: int, user_id: int) -> Document:
    doc = document_repo.get_document_for_user(db, document_id=document_id, user_id=user_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


def _validate_linked_resume(
    db: Session,
    *,
    user_id: int,
    linked_resume_id: int,
    exclude_document_id: int | None = None,
) -> None:
    resume = document_repo.get_resume_for_user(db, resume_id=linked_resume_id, user_id=user_id)
    if not resume:
        raise HTTPException(status_code=400, detail="Linked resume not found")

    existing = document_repo.get_cover_letter_linked_to_resume(
        db,
        resume_id=linked_resume_id,
        exclude_document_id=exclude_document_id,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Another cover letter is already linked to this resume")


def remove_profile_image(
    *,
    document_id: int,
    current_user: User,
    db: Session,
    upload_dir: str,
) -> None:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    if doc.profile_image:
        profile_images.remove_profile_image_file(upload_dir, doc.profile_image)
        doc.profile_image = None
        document_repo.save_document(db, doc)


async def upload_profile_image(
    *,
    document_id: int,
    file: UploadFile,
    current_user: User,
    db: Session,
    upload_dir: str,
) -> ImageUploadResponse:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    filename = await profile_images.store_profile_image(
        document_id=document_id,
        file=file,
        upload_dir=upload_dir,
        old_filename=doc.profile_image,
    )
    doc.profile_image = filename
    document_repo.save_document(db, doc)
    return ImageUploadResponse(url=f"/uploads/profile_images/{filename}")


def create_document(document_data: DocumentCreate, current_user: User, db: Session) -> DocumentResponse:
    sanitized_title = InputSanitizer.sanitize_string(document_data.title)
    sanitized_data = _sanitize_data_if_needed(document_data.data)
    linked_resume_id: int | None = None

    if document_data.linked_resume_id is not None and document_data.document_type == "cover_letter":
        _validate_linked_resume(
            db,
            user_id=current_user.id,
            linked_resume_id=document_data.linked_resume_id,
        )
        linked_resume_id = document_data.linked_resume_id

    new_document = document_repo.create_document_record(
        db,
        title=sanitized_title,
        document_type=document_data.document_type,
        data=sanitized_data,
        owner_id=current_user.id,
        linked_resume_id=linked_resume_id,
    )
    return DocumentResponse.model_validate(new_document)


def list_documents(
    *,
    document_type: str | None,
    current_user: User,
    db: Session,
) -> list[DocumentListResponse]:
    docs = document_repo.list_documents_for_user(db, user_id=current_user.id, document_type=document_type)
    results = []
    for doc in docs:
        item = DocumentListResponse.model_validate(doc)
        if doc.document_type == "resume" and isinstance(doc.data, dict):
            item.job_title = doc.data.get("data", {}).get("position") or doc.data.get("position") or None
            raw_name = doc.data.get("data", {}).get("name") or doc.data.get("name") or None
            item.document_name = raw_name or None
        results.append(item)
    return results


def get_document(*, document_id: int, current_user: User, db: Session) -> DocumentResponse:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    return DocumentResponse.model_validate(doc)


def update_document(
    *,
    document_id: int,
    document_update: DocumentUpdate,
    current_user: User,
    db: Session,
) -> DocumentResponse:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)

    if document_update.title is not None:
        doc.title = InputSanitizer.sanitize_string(document_update.title)

    if document_update.document_type is not None:
        doc.document_type = document_update.document_type

    if document_update.data is not None:
        doc.data = _sanitize_data_if_needed(document_update.data)

    if document_update.is_default is not None:
        if document_update.is_default:
            document_repo.unset_other_default_documents(db, owner_id=current_user.id, document_id=document_id)
        doc.is_default = document_update.is_default

    if "linked_resume_id" in (document_update.model_fields_set or set()):
        if document_update.linked_resume_id is None:
            doc.linked_resume_id = None
        elif doc.document_type == "cover_letter":
            _validate_linked_resume(
                db,
                user_id=current_user.id,
                linked_resume_id=document_update.linked_resume_id,
                exclude_document_id=document_id,
            )
            doc.linked_resume_id = document_update.linked_resume_id

    document_repo.save_document(db, doc)
    return DocumentResponse.model_validate(doc)


def delete_document(*, document_id: int, current_user: User, db: Session) -> None:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    document_repo.delete_document_record(db, doc)


def export_document(*, document_id: int, current_user: User, db: Session) -> DocumentExport:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    return DocumentExport(
        title=doc.title,
        document_type=cast("Literal['resume', 'cover_letter']", doc.document_type),
        data=doc.data,
        exported_at=datetime.now(UTC),
    )


def import_document(document_import: DocumentImport, current_user: User, db: Session) -> DocumentResponse:
    new_document = document_repo.create_document_record(
        db,
        title=InputSanitizer.sanitize_string(document_import.title or "Imported Document"),
        document_type=document_import.document_type,
        data=_sanitize_data_if_needed(document_import.data),
        owner_id=current_user.id,
    )
    return DocumentResponse.model_validate(new_document)


def duplicate_document(*, document_id: int, current_user: User, db: Session) -> DocumentResponse:
    original = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    new_document = document_repo.create_document_record(
        db,
        title=InputSanitizer.sanitize_string(f"{original.title} (Copy)"),
        document_type=original.document_type,
        data=original.data,
        owner_id=current_user.id,
    )
    return DocumentResponse.model_validate(new_document)


def get_default_document(*, current_user: User, db: Session) -> DocumentResponse:
    doc = document_repo.get_default_document(db, user_id=current_user.id)
    if not doc:
        doc = document_repo.get_most_recent_document(db, user_id=current_user.id)

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No documents found")

    return DocumentResponse.model_validate(doc)


def create_version(
    *,
    document_id: int,
    body: DocumentVersionCreate,
    current_user: User,
    db: Session,
) -> DocumentVersionResponse:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    count = version_repo.count_versions_for_document(db, document_id=document_id)
    if count >= MAX_VERSIONS_PER_DOCUMENT:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_VERSIONS_PER_DOCUMENT} versions per document")

    version = version_repo.create_version_record(
        db,
        document_id=document_id,
        version_name=InputSanitizer.sanitize_string(body.version_name),
        data=doc.data,
    )
    return DocumentVersionResponse.model_validate(version)


def list_versions(*, document_id: int, current_user: User, db: Session) -> list[DocumentVersionResponse]:
    _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    versions = version_repo.list_versions_for_document(db, document_id=document_id)
    return [DocumentVersionResponse.model_validate(v) for v in versions]


def get_version(
    *,
    document_id: int,
    version_id: int,
    current_user: User,
    db: Session,
) -> DocumentVersionDetailResponse:
    _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    version = version_repo.get_version_for_document(db, document_id=document_id, version_id=version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return DocumentVersionDetailResponse.model_validate(version)


def restore_version(
    *,
    document_id: int,
    version_id: int,
    current_user: User,
    db: Session,
) -> DocumentResponse:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    version = version_repo.get_version_for_document(db, document_id=document_id, version_id=version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    doc.data = version.data
    document_repo.save_document(db, doc)
    return DocumentResponse.model_validate(doc)


def delete_version(*, document_id: int, version_id: int, current_user: User, db: Session) -> None:
    _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    version = version_repo.get_version_for_document(db, document_id=document_id, version_id=version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    version_repo.delete_version_record(db, version)


def create_share_link(*, document_id: int, current_user: User, db: Session) -> ShareLinkResponse:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    if not doc.share_token:
        doc.share_token = secrets.token_urlsafe(32)
        document_repo.save_document(db, doc)

    return ShareLinkResponse(
        share_token=doc.share_token,
        url=f"/shared/{doc.share_token}",
    )


def revoke_share_link(*, document_id: int, current_user: User, db: Session) -> None:
    doc = _get_user_document_or_404(db, document_id=document_id, user_id=current_user.id)
    doc.share_token = None
    document_repo.save_document(db, doc)
