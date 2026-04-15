from __future__ import annotations

import os
from datetime import timedelta
from typing import Any, Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.audit import AuditEventType, audit_logger, get_client_ip, get_user_agent
from app.auth import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    get_current_active_user,
    get_password_hash,
    revoke_all_user_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_password,
    verify_password_reset_token,
    verify_refresh_token,
)
from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import (
    AccessTokenResponse,
    ErrorResponse,
    LogoutAllResponse,
    MessageResponse,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetTokenResponse,
    RefreshTokenRequest,
    UserCreate,
    UserLogin,
    UserPreferences,
    UserResponse,
)
from app.security import InputSanitizer, account_lockout

_error_responses: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "Authentication required or invalid credentials"},
    429: {"model": ErrorResponse, "description": "Rate limit exceeded or account locked"},
}

router = APIRouter(prefix="/auth", tags=["Authentication"], responses=_error_responses)
settings = get_settings()


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _get_device_info(request: Request) -> str:
    user_agent = request.headers.get("User-Agent", "Unknown")
    return user_agent[:200] if user_agent else "Unknown"


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set the refresh token as an HttpOnly cookie."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/auth",
        domain=settings.cookie_domain or None,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="refresh_token",
        path="/api/auth",
        domain=settings.cookie_domain or None,
    )


def _authenticate_user(
    email: str,
    password: str,
    request: Request,
    db: Session,
) -> User:
    """Shared authentication logic for both form-data and JSON login.

    Handles lockout checks, credential verification, failure counting,
    audit logging, and account-active checks.

    Returns the authenticated :class:`User` or raises ``HTTPException``.
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    email = email.lower()

    # ── Lockout check ────────────────────────────────────────────────
    if account_lockout.is_locked(email):
        remaining = account_lockout.get_lockout_remaining(email)
        minutes = remaining // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Account temporarily locked due to too many failed attempts. "
                f"Try again in {minutes + 1} minutes."
            ),
            headers={"Retry-After": str(remaining)},
        )

    # ── Credential verification ──────────────────────────────────────
    user: Optional[User] = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.hashed_password):
        failures = account_lockout.record_failure(email)
        remaining_attempts = max(0, settings.account_lockout_attempts - failures)

        detail = "Incorrect email or password"
        if 0 < remaining_attempts <= 3:
            detail = (
                f"Incorrect email or password. "
                f"{remaining_attempts} attempts remaining before lockout."
            )
        elif remaining_attempts == 0:
            detail = (
                "Account locked due to too many failed attempts. "
                f"Try again in {settings.account_lockout_duration} minutes."
            )

        audit_logger.log_login_failure(
            db=db,
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            reason="Invalid credentials",
            attempts_remaining=remaining_attempts,
        )

        if remaining_attempts == 0:
            audit_logger.log_account_locked(
                db=db,
                email=email,
                ip_address=ip_address,
                user_agent=user_agent,
                failed_attempts=settings.account_lockout_attempts,
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Active check ─────────────────────────────────────────────────
    if not user.is_active:
        audit_logger.log_login_failure(
            db=db,
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            reason="Account inactive",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    account_lockout.clear_failures(email)
    return user


def _issue_tokens(
    user: User,
    request: Request,
    response: Response,
    db: Session,
) -> AccessTokenResponse:
    """Create access + refresh tokens, set cookie, audit-log success."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires,
    )

    device_info = _get_device_info(request)
    refresh_token = create_refresh_token(user.id, db, device_info)

    audit_logger.log_login_success(
        db=db,
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    _set_refresh_cookie(response, refresh_token)

    return AccessTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_data: UserCreate,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Register a new user."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    sanitized_username = InputSanitizer.sanitize_string(user_data.username)

    if InputSanitizer.contains_dangerous_content(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username contains invalid characters",
        )

    normalized_email = user_data.email.lower()

    if db.query(User).filter(User.email == normalized_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    if db.query(User).filter(User.username == sanitized_username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=normalized_email,
        username=sanitized_username,
        hashed_password=hashed_password,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    audit_logger.log_registration(
        db=db,
        user_id=new_user.id,
        user_email=new_user.email,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return UserResponse.model_validate(new_user)


@router.post("/login", response_model=AccessTokenResponse)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Login with OAuth2 form-data. Use email as the ``username`` field."""
    user = _authenticate_user(form_data.username, form_data.password, request, db)
    return _issue_tokens(user, request, response, db)


@router.post("/login/json", response_model=AccessTokenResponse)
async def login_json(
    request: Request,
    response: Response,
    user_data: UserLogin,
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Login with JSON body (alternative to form-data)."""
    user = _authenticate_user(user_data.email, user_data.password, request, db)
    return _issue_tokens(user, request, response, db)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_tokens(
    request: Request,
    response: Response,
    token_request: Optional[RefreshTokenRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Refresh access token using a valid refresh token.

    The refresh token can be provided either as an HttpOnly cookie
    (preferred) or in the request body (fallback).

    Implements token rotation: each refresh token can only be used once.
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    refresh_token = refresh_token_cookie
    if not refresh_token and token_request and token_request.refresh_token:
        refresh_token = token_request.refresh_token

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user, old_token = verify_refresh_token(
        refresh_token, db, ip_address=ip_address, user_agent=user_agent
    )

    if not user or not old_token:
        audit_logger.log(
            db=db,
            event_type=AuditEventType.TOKEN_REFRESH_FAILURE,
            description="Token refresh failed — invalid or expired token",
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/refresh",
            success=False,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires,
    )

    device_info = _get_device_info(request)
    new_refresh_token = rotate_refresh_token(old_token, db, device_info)

    audit_logger.log_token_refresh(
        db=db,
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    _set_refresh_cookie(response, new_refresh_token)

    return AccessTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    token_request: Optional[RefreshTokenRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Logout by revoking the refresh token."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    refresh_token = refresh_token_cookie
    if not refresh_token and token_request and token_request.refresh_token:
        refresh_token = token_request.refresh_token

    if refresh_token:
        revoke_refresh_token(refresh_token, db)

    _clear_refresh_cookie(response)

    audit_logger.log_logout(
        db=db,
        user_id=None,
        ip_address=ip_address,
        user_agent=user_agent,
        all_devices=False,
    )

    return MessageResponse(message="Successfully logged out")


@router.post("/logout/all", response_model=LogoutAllResponse)
async def logout_all_devices(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> LogoutAllResponse:
    """Logout from all devices by revoking all refresh tokens."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    count = revoke_all_user_tokens(current_user.id, db)
    _clear_refresh_cookie(response)

    audit_logger.log_logout(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        all_devices=True,
    )

    return LogoutAllResponse(
        message="Successfully logged out from all devices",
        sessions_revoked=count,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """Get current user information."""
    return UserResponse.model_validate(current_user)


@router.patch("/preferences", response_model=UserResponse)
async def update_preferences(
    preferences: UserPreferences,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Update user preferences (theme, language)."""
    if preferences.theme is not None:
        current_user.theme = preferences.theme
    if preferences.language is not None:
        current_user.language = preferences.language

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/forgot-password", response_model=PasswordResetTokenResponse)
async def forgot_password(
    request: Request,
    reset_request: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> PasswordResetTokenResponse:
    """Request a password reset token.

    
    Always returns 200 to prevent email enumeration.
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    email = reset_request.email.lower()

    user: Optional[User] = db.query(User).filter(User.email == email).first()

    if not user or not user.is_active:
        audit_logger.log(
            db=db,
            event_type=AuditEventType.PASSWORD_RESET_REQUESTED,
            description=f"Password reset requested for unknown/inactive email: {email}",
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/forgot-password",
            success=False,
        )
        return PasswordResetTokenResponse(
            message="If an account with that email exists, a reset token has been generated.",
        )

    reset_token = create_password_reset_token(user.id)

    audit_logger.log(
        db=db,
        event_type=AuditEventType.PASSWORD_RESET_REQUESTED,
        description="Password reset token generated",
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        endpoint="/api/auth/forgot-password",
        success=True,
    )

        return PasswordResetTokenResponse(
            message="If an account with that email exists, a reset token has been generated.",
            reset_token=reset_token,
        )

    return PasswordResetTokenResponse(
        message="If an account with that email exists, a reset link has been sent.",
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: Request,
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Reset password using a valid reset token."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    user_id = verify_password_reset_token(reset_data.token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user: Optional[User] = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.hashed_password = get_password_hash(reset_data.new_password)
    db.commit()

    revoke_all_user_tokens(user.id, db)

    audit_logger.log(
        db=db,
        event_type=AuditEventType.PASSWORD_RESET_COMPLETED,
        description="Password reset completed successfully",
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        endpoint="/api/auth/reset-password",
        success=True,
    )

    return MessageResponse(
        message="Password has been reset successfully. Please log in with your new password.",
    )


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: Request,
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Change the current user's password."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    audit_logger.log(
        db=db,
        event_type=AuditEventType.PASSWORD_CHANGED,
        description="Password changed successfully",
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        endpoint="/api/auth/change-password",
        success=True,
    )

    return MessageResponse(message="Password changed successfully")


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    """Permanently delete account and all data (GDPR Art. 17)."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    upload_dir: str = settings.upload_dir
    for doc in current_user.documents:
        if doc.profile_image:
            img_path = os.path.join(upload_dir, doc.profile_image)
            if os.path.isfile(img_path):
                try:
                    os.remove(img_path)
                except OSError:
                    pass  # best-effort

    revoke_all_user_tokens(current_user.id, db)

    audit_logger.log_logout(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        all_devices=True,
    )

    db.delete(current_user)
    db.commit()
    _clear_refresh_cookie(response)
