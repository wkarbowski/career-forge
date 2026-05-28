"""Document repository functions."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.models import Document

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def get_document_for_user(db: Session, *, document_id: int, user_id: int) -> Document | None:
    return db.query(Document).filter(Document.id == document_id, Document.owner_id == user_id).first()


def list_documents_for_user(db: Session, *, user_id: int, document_type: str | None = None) -> list[Document]:
    query = db.query(Document).filter(Document.owner_id == user_id)
    if document_type:
        query = query.filter(Document.document_type == document_type)
    return list(query.all())


def create_document_record(
    db: Session,
    *,
    title: str,
    document_type: str,
    data: dict[str, Any],
    owner_id: int,
    linked_resume_id: int | None = None,
) -> Document:
    document = Document(
        title=title,
        document_type=document_type,
        data=data,
        owner_id=owner_id,
        linked_resume_id=linked_resume_id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def save_document(db: Session, document: Document) -> Document:
    db.commit()
    db.refresh(document)
    return document


def delete_document_record(db: Session, document: Document) -> None:
    db.delete(document)
    db.commit()


def unset_other_default_documents(db: Session, *, owner_id: int, document_id: int) -> None:
    db.query(Document).filter(Document.owner_id == owner_id, Document.id != document_id).update({"is_default": False})


def get_default_document(db: Session, *, user_id: int) -> Document | None:
    return db.query(Document).filter(Document.owner_id == user_id, Document.is_default).first()


def get_most_recent_document(db: Session, *, user_id: int) -> Document | None:
    return db.query(Document).filter(Document.owner_id == user_id).order_by(Document.updated_at.desc()).first()


def get_resume_for_user(db: Session, *, resume_id: int, user_id: int) -> Document | None:
    return (
        db.query(Document)
        .filter(
            Document.id == resume_id,
            Document.owner_id == user_id,
            Document.document_type == "resume",
        )
        .first()
    )


def get_cover_letter_linked_to_resume(
    db: Session,
    *,
    resume_id: int,
    exclude_document_id: int | None = None,
) -> Document | None:
    query = db.query(Document).filter(Document.linked_resume_id == resume_id)
    if exclude_document_id is not None:
        query = query.filter(Document.id != exclude_document_id)
    return query.first()
