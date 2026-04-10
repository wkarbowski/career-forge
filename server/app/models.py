from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base


def _now():
    """Return current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


class User(Base):
    """User model for authentication."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    theme = Column(String(20), default="dark")
    language = Column(String(10), default="en")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    """Document model to store resume/cover letter data as JSONB."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, default="My CV")
    document_type = Column(String(20), nullable=False, default="resume")
    data = Column(JSONB, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    profile_image = Column(String(255), nullable=True)
    share_token = Column(String(64), unique=True, nullable=True, index=True)

    owner = relationship("User", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(Base):
    """Snapshot of a document at a point in time."""
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    version_name = Column(String(255), nullable=False)
    data = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=_now)

    document = relationship("Document", back_populates="versions")


class RefreshToken(Base):
    """
    Refresh token model for token rotation.
    
    Each refresh token can only be used once. When used, it's marked as used
    and a new token is issued. If a used token is presented again, all tokens
    for that user are revoked (potential token theft).
    """
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_info = Column(String(255), nullable=True)
    is_revoked = Column(Boolean, default=False)
    used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="refresh_tokens")
