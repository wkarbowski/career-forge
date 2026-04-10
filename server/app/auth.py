from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import bcrypt
import secrets
import hashlib
import logging
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User, RefreshToken

settings = get_settings()
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return bcrypt.hashpw(
        password.encode('utf-8'), 
        bcrypt.gensalt()
    ).decode('utf-8')


def _hash_token(token: str) -> str:
    """Hash a token for secure storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({
        "exp": expire,
        "type": "access",
        "iat": datetime.now(timezone.utc)  # Issued at time for additional validation
    })
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_password_reset_token(user_id: int, expires_minutes: int = 30) -> str:
    """Create a short-lived JWT token for password reset."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "type": "password_reset",
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def verify_password_reset_token(token: str) -> Optional[int]:
    """Verify a password reset token and return the user_id if valid."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "password_reset":
            return None
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except JWTError:
        return None


def create_refresh_token(
    user_id: int, 
    db: Session,
    device_info: Optional[str] = None
) -> str:
    """
    Create a refresh token and store its hash in the database.
    
    Args:
        user_id: The user's ID
        db: Database session
        device_info: Optional device/browser info for tracking
    
    Returns:
        The raw refresh token (only returned once, not stored)
    """
    raw_token = secrets.token_urlsafe(64)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    
    refresh_token = RefreshToken(
        token_hash=token_hash,
        user_id=user_id,
        device_info=device_info,
        expires_at=expires_at
    )
    db.add(refresh_token)
    db.commit()
    
    return raw_token


def verify_refresh_token(
    token: str, 
    db: Session,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Tuple[Optional[User], Optional[RefreshToken]]:
    """
    Verify a refresh token and return the user if valid.
    
    Implements token rotation security:
    - If token is valid and unused: returns user, marks token as used
    - If token was already used: REVOKES ALL user tokens (potential theft)
    - If token is expired or invalid: returns None
    
    Args:
        token: The raw refresh token
        db: Database session
        ip_address: Optional IP for audit logging
        user_agent: Optional user agent for audit logging
    
    Returns:
        Tuple of (User, RefreshToken) if valid, (None, None) otherwise
    """
    token_hash = _hash_token(token)
    
    stored_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).first()
    
    if not stored_token:
        return None, None
    
    # Check if token was already used (potential token theft!)
    if stored_token.used_at is not None:
        logger.warning(
            f"🚨 SECURITY: Refresh token reuse detected for user {stored_token.user_id}. "
            "Revoking all tokens (potential token theft)."
        )
        
        from app.audit import audit_logger
        audit_logger.log_token_reuse(
            db=db,
            user_id=stored_token.user_id,
            ip_address=ip_address or "unknown",
            user_agent=user_agent or "unknown"
        )
        
        db.query(RefreshToken).filter(
            RefreshToken.user_id == stored_token.user_id
        ).update({"is_revoked": True})
        db.commit()
        return None, None
    
    if stored_token.is_revoked:
        return None, None
    
    if datetime.now(timezone.utc) > stored_token.expires_at.replace(tzinfo=timezone.utc) if stored_token.expires_at.tzinfo is None else stored_token.expires_at:
        return None, None
    
    user = db.query(User).filter(User.id == stored_token.user_id).first()
    if not user or not user.is_active:
        return None, None
    
    return user, stored_token


def rotate_refresh_token(
    old_token: RefreshToken,
    db: Session,
    device_info: Optional[str] = None
) -> str:
    """
    Rotate a refresh token: mark old one as used, create new one.
    
    Args:
        old_token: The old RefreshToken record
        db: Database session
        device_info: Optional device info for the new token
    
    Returns:
        New raw refresh token
    """
    old_token.used_at = datetime.now(timezone.utc)
    db.commit()
    
    return create_refresh_token(
        user_id=old_token.user_id,
        db=db,
        device_info=device_info or old_token.device_info
    )


def revoke_refresh_token(token: str, db: Session) -> bool:
    """
    Revoke a specific refresh token.
    
    Args:
        token: The raw refresh token
        db: Database session
    
    Returns:
        True if token was found and revoked, False otherwise
    """
    token_hash = _hash_token(token)
    
    result = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).update({"is_revoked": True})
    db.commit()
    
    return result > 0


def revoke_all_user_tokens(user_id: int, db: Session) -> int:
    """
    Revoke all refresh tokens for a user (logout from all devices).
    
    Args:
        user_id: The user's ID
        db: Database session
    
    Returns:
        Number of tokens revoked
    """
    result = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        ~RefreshToken.is_revoked
    ).update({"is_revoked": True})
    db.commit()
    
    return result


def cleanup_expired_tokens(db: Session) -> int:
    """
    Remove expired refresh tokens from database.
    Should be run periodically (e.g., daily cron job).
    
    Args:
        db: Database session
    
    Returns:
        Number of tokens deleted
    """
    result = db.query(RefreshToken).filter(
        RefreshToken.expires_at < datetime.now(timezone.utc)
    ).delete()
    db.commit()
    
    return result


def decode_token(token: str) -> Optional[int]:
    """
    Decode and validate a JWT access token, return user_id.
    
    Validates:
    - Token signature and expiration (via jose)
    - Token type is 'access' (prevents refresh token misuse)
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        
        # Validate token type - must be access token
        token_type = payload.get("type")
        if token_type != "access":
            logger.warning(f"Invalid token type: {token_type} (expected 'access')")
            return None
        
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user from the JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    user_id = decode_token(token)
    if user_id is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure the current user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
