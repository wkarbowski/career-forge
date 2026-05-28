from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.config import Settings, get_settings
from app.database import get_db
from app.repositories import refresh_tokens as refresh_token_repo
from app.repositories import users as user_repo

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models import RefreshToken, User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bool(
        bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    )


def get_password_hash(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    hashed: bytes = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    )
    return hashed.decode("utf-8")


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------


def _hash_token(token: str) -> str:
    """SHA-256 hash a raw token for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(
    data: dict[str, str],
    expires_delta: timedelta | None = None,
    *,
    settings: Settings | None = None,
) -> str:
    """Create a signed JWT access token."""
    _settings = settings or get_settings()
    to_encode: dict[str, object] = {**data}
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=_settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "type": "access", "iat": now})
    return str(jwt.encode(to_encode, _settings.secret_key, algorithm=_settings.algorithm))


def create_password_reset_token(
    user_id: int,
    expires_minutes: int = 30,
    *,
    settings: Settings | None = None,
) -> str:
    """Create a short-lived JWT token for password reset."""
    _settings = settings or get_settings()
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=expires_minutes)
    to_encode: dict[str, object] = {
        "sub": str(user_id),
        "exp": expire,
        "type": "password_reset",
        "iat": now,
    }
    return str(jwt.encode(to_encode, _settings.secret_key, algorithm=_settings.algorithm))


def verify_password_reset_token(
    token: str,
    *,
    settings: Settings | None = None,
) -> int | None:
    """Verify a password reset token and return user_id if valid."""
    _settings = settings or get_settings()
    try:
        payload: dict[str, object] = jwt.decode(token, _settings.secret_key, algorithms=[_settings.algorithm])
        if payload.get("type") != "password_reset":
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(str(user_id))
    except (JWTError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Refresh-token lifecycle
# ---------------------------------------------------------------------------


def create_refresh_token(
    user_id: int,
    db: Session,
    device_info: str | None = None,
    *,
    settings: Settings | None = None,
) -> str:
    """Create a refresh token and store its hash in the database.

    Returns the raw token (only returned once — not stored).
    """
    _settings = settings or get_settings()
    raw_token = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(UTC) + timedelta(days=_settings.refresh_token_expire_days)

    refresh_token_repo.create_refresh_token_record(
        db,
        token_hash=token_hash,
        user_id=user_id,
        device_info=device_info,
        expires_at=expires_at,
    )
    return raw_token


def verify_refresh_token(
    token: str,
    db: Session,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[User | None, RefreshToken | None]:
    """Verify a refresh token, applying rotation security.

    * Valid & unused → returns ``(User, RefreshToken)``
    * Already used → revokes **all** user tokens (potential theft)
    * Expired / invalid → returns ``(None, None)``
    """
    token_hash = _hash_token(token)

    stored_token = refresh_token_repo.get_refresh_token_by_hash(db, token_hash)
    if stored_token is None:
        return None, None

    # Token-reuse detection
    if stored_token.used_at is not None:
        logger.warning(
            "🚨 SECURITY: Refresh token reuse detected for user %s. " "Revoking all tokens (potential token theft).",
            stored_token.user_id,
        )
        from app.audit import audit_logger

        audit_logger.log_token_reuse(
            db=db,
            user_id=stored_token.user_id,
            ip_address=ip_address or "unknown",
            user_agent=user_agent or "unknown",
        )
        refresh_token_repo.revoke_user_refresh_tokens(db, stored_token.user_id)
        return None, None

    if stored_token.is_revoked:
        return None, None

    # Timezone-safe expiry check
    expires = stored_token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if datetime.now(UTC) > expires:
        return None, None

    user = user_repo.get_user_by_id(db, stored_token.user_id)
    if user is None or not user.is_active:
        return None, None

    return user, stored_token


def rotate_refresh_token(
    old_token: RefreshToken,
    db: Session,
    device_info: str | None = None,
) -> str:
    """Mark *old_token* as used and issue a new refresh token."""
    refresh_token_repo.mark_refresh_token_used(db, old_token, datetime.now(UTC))
    return create_refresh_token(
        user_id=old_token.user_id,
        db=db,
        device_info=device_info or old_token.device_info,
    )


def revoke_refresh_token(token: str, db: Session) -> bool:
    """Revoke a single refresh token. Returns True if found & revoked."""
    token_hash = _hash_token(token)
    result = refresh_token_repo.revoke_refresh_token_by_hash(db, token_hash)
    return result > 0


def revoke_all_user_tokens(user_id: int, db: Session) -> int:
    """Revoke all active refresh tokens for a user. Returns count revoked."""
    return refresh_token_repo.revoke_user_refresh_tokens(db, user_id, active_only=True)


def cleanup_expired_tokens(db: Session) -> int:
    """Remove expired refresh tokens. Should run periodically."""
    return refresh_token_repo.delete_expired_refresh_tokens(db, datetime.now(UTC))


# ---------------------------------------------------------------------------
# JWT decode
# ---------------------------------------------------------------------------


def decode_token(
    token: str,
    *,
    settings: Settings | None = None,
) -> int | None:
    """Decode and validate a JWT access token, returning ``user_id``.

    Validates token signature, expiration, and that ``type == 'access'``.
    """
    _settings = settings or get_settings()
    try:
        payload: dict[str, object] = jwt.decode(token, _settings.secret_key, algorithms=[_settings.algorithm])
        if payload.get("type") != "access":
            logger.warning("Invalid token type: %s (expected 'access')", payload.get("type"))
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(str(user_id))
    except (JWTError, ValueError):
        return None


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: get the authenticated user from the JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_token(token)
    if user_id is None:
        raise credentials_exception

    user = user_repo.get_user_by_id(db, user_id)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: ensure the current user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
