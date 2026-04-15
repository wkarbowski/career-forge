from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    """Return current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


class User(Base):
    """User model for authentication."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    theme: Mapped[str] = mapped_column(String(20), default="dark")
    language: Mapped[str] = mapped_column(String(10), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    documents: Mapped[list[Document]] = relationship(
        "Document", back_populates="owner", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class Document(Base):
    """Document model to store resume/cover letter data as JSONB."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="My CV")
    document_type: Mapped[str] = mapped_column(String(20), nullable=False, default="resume")
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    profile_image: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    share_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)
    linked_resume_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    owner: Mapped[User] = relationship("User", back_populates="documents")
    versions: Mapped[list[DocumentVersion]] = relationship(
        "DocumentVersion", back_populates="document", cascade="all, delete-orphan"
    )
    linked_resume: Mapped[Optional[Document]] = relationship(
        "Document", remote_side=[id], foreign_keys=[linked_resume_id]
    )


class DocumentVersion(Base):
    """Snapshot of a document at a point in time."""

    __tablename__ = "document_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    document: Mapped[Document] = relationship("Document", back_populates="versions")


class RefreshToken(Base):
    """Refresh token model for token rotation.

    Each refresh token can only be used once.  When used it is marked as
    consumed and a new token is issued.  If a consumed token is presented
    again, all tokens for that user are revoked (potential token theft).
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    device_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")
