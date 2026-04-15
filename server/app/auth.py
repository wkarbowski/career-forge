from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import RefreshToken, User

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------


def _hash_token(token: str) -> str:
    """SHA-256 hash a raw token for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(
    data: dict[str, str],
    expires_delta: Optional[timedelta] = None,
    *,
    settings: Settings | None = None,
) -> str:
    """Create a signed JWT access token."""
    _settings = settings or get_settings()
    to_encode: dict[str, object] = {**data}
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=_settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "type": "access", "iat": now})
    return jwt.encode(to_encode, _settings.secret_key, algorithm=_settings.algorithm)


def create_password_reset_token(
    user_id: int,
    expires_minutes: int = 30,
    *,
    settings: Settings | None = None,
) -> str:
    """Create a short-lived JWT token for password reset."""
    _settings = settings or get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)
    to_encode: dict[str, object] = {
        "sub": str(user_id),
        "exp": expire,
        "type": "password_reset",
        "iat": now,
    }
    return jwt.encode(to_encode, _settings.secret_key, algorithm=_settings.algorithm)


def verify_password_reset_token(
    token: str,
    *,
    settings: Settings | None = None,
) -> Optional[int]:
    """Verify a password reset token and return user_id if valid."""
    _settings = settings or get_settings()
    try:
        payload: dict[str, object] = jwt.decode(
            token, _settings.secret_key, algorithms=[_settings.algorithm]
        )
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
    device_info: Optional[str] = None,
    *,
    settings: Settings | None = None,
) -> str:
    """Create a refresh token and store its hash in the database.

    Returns the raw token (only returned once — not stored).
    """
    _settings = settings or get_settings()
    raw_token = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=_settings.refresh_token_expire_days)

    refresh_token = RefreshToken(
        token_hash=token_hash,
        user_id=user_id,
        device_info=device_info,
        expires_at=expires_at,
    )
    db.add(refresh_token)
    db.commit()
    return raw_token


def verify_refresh_token(
    token: str,
    db: Session,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> tuple[Optional[User], Optional[RefreshToken]]:
    """Verify a refresh token, applying rotation security.

    * Valid & unused → returns ``(User, RefreshToken)``
    * Already used → revokes **all** user tokens (potential theft)
    * Expired / invalid → returns ``(None, None)``
    """
    token_hash = _hash_token(token)

    stored_token: Optional[RefreshToken] = (
        db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    )
    if stored_token is None:
        return None, None

    # Token-reuse detection
    if stored_token.used_at is not None:
        logger.warning(
            "🚨 SECURITY: Refresh token reuse detected for user %s. "
            "Revoking all tokens (potential token theft).",
            stored_token.user_id,
        )
        from app.audit import audit_logger

        audit_logger.log_token_reuse(
            db=db,
            user_id=stored_token.user_id,
            ip_address=ip_address or "unknown",
            user_agent=user_agent or "unknown",
        )
        db.query(RefreshToken).filter(RefreshToken.user_id == stored_token.user_id).update(
            {"is_revoked": True}
        )
        db.commit()
        return None, None

    if stored_token.is_revoked:
        return None, None

    # Timezone-safe expiry check
    expires = stored_token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        return None, None

    user: Optional[User] = db.query(User).filter(User.id == stored_token.user_id).first()
    if user is None or not user.is_active:
        return None, None

    return user, stored_token


def rotate_refresh_token(
    old_token: RefreshToken,
    db: Session,
    device_info: Optional[str] = None,
) -> str:
    """Mark *old_token* as used and issue a new refresh token."""
    old_token.used_at = datetime.now(timezone.utc)
    db.commit()
    return create_refresh_token(
        user_id=old_token.user_id,
        db=db,
        device_info=device_info or old_token.device_info,
    )


def revoke_refresh_token(token: str, db: Session) -> bool:
    """Revoke a single refresh token. Returns True if found & revoked."""
    token_hash = _hash_token(token)
    result: int = (
        db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).update({"is_revoked": True})
    )
    db.commit()
    return result > 0


def revoke_all_user_tokens(user_id: int, db: Session) -> int:
    """Revoke all active refresh tokens for a user. Returns count revoked."""
    result: int = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id, ~RefreshToken.is_revoked)
        .update({"is_revoked": True})
    )
    db.commit()
    return result


def cleanup_expired_tokens(db: Session) -> int:
    """Remove expired refresh tokens. Should run periodically."""
    result: int = (
        db.query(RefreshToken).filter(RefreshToken.expires_at < datetime.now(timezone.utc)).delete()
    )
    db.commit()
    return result


# ---------------------------------------------------------------------------
# JWT decode
# ---------------------------------------------------------------------------


def decode_token(
    token: str,
    *,
    settings: Settings | None = None,
) -> Optional[int]:
    """Decode and validate a JWT access token, returning ``user_id``.

    Validates token signature, expiration, and that ``type == 'access'``.
    """
    _settings = settings or get_settings()
    try:
        payload: dict[str, object] = jwt.decode(
            token, _settings.secret_key, algorithms=[_settings.algorithm]
        )
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

    user: Optional[User] = db.query(User).filter(User.id == user_id).first()
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
