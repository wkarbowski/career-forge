from __future__ import annotations

import re
from datetime import datetime  # noqa: TC003 — Pydantic resolves this at runtime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ---------------------------------------------------------------------------
# Shared password-strength validator (DRY — used by three schemas)
# ---------------------------------------------------------------------------


def _validate_password_strength(v: str) -> str:
    """Validate that a password meets security requirements.

    Requirements:
    - Minimum 8 characters (also enforced by Field(min_length=8))
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    errors: list[str] = []
    if len(v) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", v):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", v):
        errors.append("one lowercase letter")
    if not re.search(r"[0-9]", v):
        errors.append("one number")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/~`]', v):
        errors.append("one special character (!@#$%^&*...)")
    if errors:
        raise ValueError(f"Password must contain {', '.join(errors)}")
    return v


# ============== User schemas ==============


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return v


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    theme: str = "dark"
    language: str = "en"
    created_at: datetime


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=100)
    email: EmailStr | None = None


class UserPreferences(BaseModel):
    theme: Literal["dark", "light"] | None = None
    language: str | None = Field(None, min_length=2, max_length=10)


# ============== Token schemas ==============


class Token(BaseModel):
    """Legacy token response (access token only)."""

    access_token: str
    token_type: str = "bearer"  # noqa: S105


class TokenPair(BaseModel):
    """Token response with both access and refresh tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int


class AccessTokenResponse(BaseModel):
    """Token response for HttpOnly cookie-based auth.

    Refresh token is sent as HttpOnly cookie, not in response body.
    """

    access_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int


# ============== Password schemas ==============


class PasswordChange(BaseModel):
    """Schema for changing user password."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class RefreshTokenRequest(BaseModel):
    """Request body for token refresh (fallback for clients not using cookies)."""

    refresh_token: str | None = None


class PasswordResetRequest(BaseModel):
    """Schema for requesting a password reset."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for completing a password reset with a token."""

    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_reset_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class TokenData(BaseModel):
    user_id: int | None = None


# ============== Document schemas ==============

DocumentType = Literal["resume", "cover_letter"]


class DocumentBase(BaseModel):
    title: str = Field(default="Untitled Resume", max_length=255)
    document_type: DocumentType = "resume"


class DocumentCreate(DocumentBase):
    data: dict[str, Any]
    linked_resume_id: int | None = None


class DocumentUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    document_type: DocumentType | None = None
    data: dict[str, Any] | None = None
    is_default: bool | None = None
    linked_resume_id: int | None = None


class DocumentResponse(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    data: dict[str, Any]
    owner_id: int
    is_default: bool
    share_token: str | None = None
    linked_resume_id: int | None = None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    is_default: bool
    share_token: str | None = None
    linked_resume_id: int | None = None
    created_at: datetime
    updated_at: datetime
    job_title: str | None = None
    document_name: str | None = None


# ============== Export / Import schemas ==============


class DocumentExport(BaseModel):
    title: str
    document_type: DocumentType = "resume"
    data: dict[str, Any]
    exported_at: datetime


class DocumentImport(BaseModel):
    title: str | None = "Imported Resume"
    document_type: DocumentType = "resume"
    data: dict[str, Any]


# ============== Version schemas ==============


class DocumentVersionCreate(BaseModel):
    version_name: str = Field(..., min_length=1, max_length=255)


class DocumentVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    version_name: str
    created_at: datetime


class DocumentVersionDetailResponse(DocumentVersionResponse):
    data: dict[str, Any]


# ============== Share schemas ==============


class ShareLinkResponse(BaseModel):
    share_token: str
    url: str


class SharedDocumentResponse(BaseModel):
    """Public response for a shared document (no owner info)."""

    title: str
    document_type: DocumentType
    data: dict[str, Any]


# ============== Generic message schemas ==============


class MessageResponse(BaseModel):
    """Generic JSON message returned by mutating endpoints."""

    message: str


class LogoutAllResponse(MessageResponse):
    sessions_revoked: int


class PasswordResetResponse(MessageResponse):
    """Returned by the forgot-password endpoint."""


class ImageUploadResponse(BaseModel):
    url: str


# ============== Infrastructure schemas ==============


class HealthResponse(BaseModel):
    status: str
    environment: str


class RootInfoResponse(BaseModel):
    message: str
    version: str
    docs: str


# ============== Error schemas ==============


class ValidationErrorDetail(BaseModel):
    """Individual field validation error."""

    loc: list[str] = Field(default_factory=list, description="Path to the invalid field")
    msg: str = Field(..., description="Human-readable error message")
    type: str | None = Field(None, description="Error type identifier")


class ErrorResponse(BaseModel):
    """Standardized error payload returned by all non-2xx responses."""

    detail: str = Field(..., description="Human-readable error summary")
    code: str | None = Field(None, description="Machine-readable error code")
    field_errors: list[ValidationErrorDetail] | None = Field(
        None, description="Per-field validation errors, when applicable"
    )
