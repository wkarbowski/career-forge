"""Document version repository functions."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.models import DocumentVersion

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def count_versions_for_document(db: Session, *, document_id: int) -> int:
    return int(db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).count())


def create_version_record(
    db: Session,
    *,
    document_id: int,
    version_name: str,
    data: dict[str, Any],
) -> DocumentVersion:
    version = DocumentVersion(
        document_id=document_id,
        version_name=version_name,
        data=data,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def list_versions_for_document(db: Session, *, document_id: int) -> list[DocumentVersion]:
    return list(
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
        .all()
    )


def get_version_for_document(db: Session, *, document_id: int, version_id: int) -> DocumentVersion | None:
    return (
        db.query(DocumentVersion)
        .filter(
            DocumentVersion.id == version_id,
            DocumentVersion.document_id == document_id,
        )
        .first()
    )


def delete_version_record(db: Session, version: DocumentVersion) -> None:
    db.delete(version)
    db.commit()
