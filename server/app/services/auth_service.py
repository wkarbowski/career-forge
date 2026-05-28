"""Authentication and account business workflows."""

from __future__ import annotations

import contextlib
import logging
import os
from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING, Protocol

from fastapi import HTTPException, status

from app.audit import AuditEventType, audit_logger
from app.auth import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    get_password_hash,
    revoke_all_user_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_password,
    verify_password_reset_token,
    verify_refresh_token,
)
from app.config import Settings, get_settings
from app.email import build_password_reset_url
from app.repositories import users as user_repo
from app.schemas import (
    AccessTokenResponse,
    LogoutAllResponse,
    MessageResponse,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetResponse,
    UserCreate,
    UserPreferences,
)
from app.security import InputSanitizer, account_lockout

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models import User

logger = logging.getLogger(__name__)
settings = get_settings()

GENERIC_RESET_MESSAGE = "If an account with that email exists, a password reset request has been recorded."


class PasswordResetEmailSender(Protocol):
    def __call__(self, *, recipient: str, reset_url: str, settings: Settings) -> bool: ...


@dataclass(frozen=True)
class AuthRequestContext:
    ip_address: str
    user_agent: str
    device_info: str


@dataclass(frozen=True)
class IssuedTokens:
    response: AccessTokenResponse
    refresh_token: str


def _settings(app_settings: Settings | None) -> Settings:
    return app_settings or settings


def register_user(
    user_data: UserCreate,
    context: AuthRequestContext,
    db: Session,
) -> User:
    sanitized_username = InputSanitizer.sanitize_string(user_data.username)

    if InputSanitizer.contains_dangerous_content(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username contains invalid characters",
        )

    normalized_email = user_data.email.lower()

    if user_repo.get_user_by_email(db, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    if user_repo.get_user_by_username(db, sanitized_username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    new_user = user_repo.create_user(
        db,
        email=normalized_email,
        username=sanitized_username,
        hashed_password=get_password_hash(user_data.password),
    )

    audit_logger.log_registration(
        db=db,
        user_id=new_user.id,
        user_email=new_user.email,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )

    return new_user


def authenticate_user(
    email: str,
    password: str,
    context: AuthRequestContext,
    db: Session,
    *,
    app_settings: Settings | None = None,
) -> User:
    """Authenticate a user and apply lockout/audit rules."""
    active_settings = _settings(app_settings)
    email = email.lower()

    if account_lockout.is_locked(email):
        remaining = account_lockout.get_lockout_remaining(email)
        minutes = remaining // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(f"Account temporarily locked due to too many failed attempts. Try again in {minutes + 1} minutes."),
            headers={"Retry-After": str(remaining)},
        )

    user = user_repo.get_user_by_email(db, email)

    if not user or not verify_password(password, user.hashed_password):
        failures = account_lockout.record_failure(email)
        remaining_attempts = max(0, active_settings.account_lockout_attempts - failures)

        detail = "Incorrect email or password"
        if 0 < remaining_attempts <= 3:
            detail = f"Incorrect email or password. {remaining_attempts} attempts remaining before lockout."
        elif remaining_attempts == 0:
            detail = (
                "Account locked due to too many failed attempts. "
                f"Try again in {active_settings.account_lockout_duration} minutes."
            )

        audit_logger.log_login_failure(
            db=db,
            email=email,
            ip_address=context.ip_address,
            user_agent=context.user_agent,
            reason="Invalid credentials",
            attempts_remaining=remaining_attempts,
        )

        if remaining_attempts == 0:
            audit_logger.log_account_locked(
                db=db,
                email=email,
                ip_address=context.ip_address,
                user_agent=context.user_agent,
                failed_attempts=active_settings.account_lockout_attempts,
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        audit_logger.log_login_failure(
            db=db,
            email=email,
            ip_address=context.ip_address,
            user_agent=context.user_agent,
            reason="Account inactive",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    account_lockout.clear_failures(email)
    return user


def issue_tokens(
    user: User,
    context: AuthRequestContext,
    db: Session,
    *,
    app_settings: Settings | None = None,
) -> IssuedTokens:
    active_settings = _settings(app_settings)
    access_token_expires = timedelta(minutes=active_settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires,
        settings=active_settings,
    )
    refresh_token = create_refresh_token(user.id, db, context.device_info, settings=active_settings)

    audit_logger.log_login_success(
        db=db,
        user_id=user.id,
        user_email=user.email,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )

    return IssuedTokens(
        response=AccessTokenResponse(
            access_token=access_token,
            token_type="bearer",  # noqa: S106
            expires_in=active_settings.access_token_expire_minutes * 60,
        ),
        refresh_token=refresh_token,
    )


def refresh_access_tokens(
    refresh_token: str | None,
    context: AuthRequestContext,
    db: Session,
    *,
    app_settings: Settings | None = None,
) -> IssuedTokens:
    active_settings = _settings(app_settings)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user, old_token = verify_refresh_token(
        refresh_token,
        db,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )

    if not user or not old_token:
        audit_logger.log(
            db=db,
            event_type=AuditEventType.TOKEN_REFRESH_FAILURE,
            description="Token refresh failed — invalid or expired token",
            ip_address=context.ip_address,
            user_agent=context.user_agent,
            endpoint="/api/auth/refresh",
            success=False,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=active_settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires,
        settings=active_settings,
    )
    new_refresh_token = rotate_refresh_token(old_token, db, context.device_info)

    audit_logger.log_token_refresh(
        db=db,
        user_id=user.id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )

    return IssuedTokens(
        response=AccessTokenResponse(
            access_token=access_token,
            token_type="bearer",  # noqa: S106
            expires_in=active_settings.access_token_expire_minutes * 60,
        ),
        refresh_token=new_refresh_token,
    )


def logout(refresh_token: str | None, context: AuthRequestContext, db: Session) -> MessageResponse:
    if refresh_token:
        revoke_refresh_token(refresh_token, db)

    audit_logger.log_logout(
        db=db,
        user_id=None,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
        all_devices=False,
    )

    return MessageResponse(message="Successfully logged out")


def logout_all_devices(user: User, context: AuthRequestContext, db: Session) -> LogoutAllResponse:
    count = revoke_all_user_tokens(user.id, db)

    audit_logger.log_logout(
        db=db,
        user_id=user.id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
        all_devices=True,
    )

    return LogoutAllResponse(
        message="Successfully logged out from all devices",
        sessions_revoked=count,
    )


def update_preferences(preferences: UserPreferences, user: User, db: Session) -> User:
    return user_repo.update_user_preferences(
        db,
        user,
        theme=preferences.theme,
        language=preferences.language,
    )


def request_password_reset(
    reset_request: PasswordResetRequest,
    context: AuthRequestContext,
    db: Session,
    *,
    email_sender: PasswordResetEmailSender,
    app_settings: Settings | None = None,
) -> PasswordResetResponse:
    active_settings = _settings(app_settings)
    email = reset_request.email.lower()
    user = user_repo.get_user_by_email(db, email)

    if not user or not user.is_active:
        audit_logger.log(
            db=db,
            event_type=AuditEventType.PASSWORD_RESET_REQUESTED,
            description=f"Password reset requested for unknown/inactive email: {email}",
            ip_address=context.ip_address,
            user_agent=context.user_agent,
            endpoint="/api/auth/forgot-password",
            success=False,
        )
        return PasswordResetResponse(message=GENERIC_RESET_MESSAGE)

    audit_logger.log(
        db=db,
        event_type=AuditEventType.PASSWORD_RESET_REQUESTED,
        description="Password reset requested",
        user_id=user.id,
        user_email=user.email,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
        endpoint="/api/auth/forgot-password",
        success=True,
    )

    reset_token = create_password_reset_token(user.id, settings=active_settings)
    reset_url = build_password_reset_url(reset_token, active_settings)
    try:
        if not email_sender(recipient=user.email, reset_url=reset_url, settings=active_settings):
            logger.info("Password reset requested for %s, but SMTP is not configured", user.email)
    except Exception:
        logger.exception("Failed to send password reset email for %s", user.email)

    return PasswordResetResponse(message=GENERIC_RESET_MESSAGE)


def reset_password(
    reset_data: PasswordResetConfirm,
    context: AuthRequestContext,
    db: Session,
    *,
    app_settings: Settings | None = None,
) -> MessageResponse:
    active_settings = _settings(app_settings)
    user_id = verify_password_reset_token(reset_data.token, settings=active_settings)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user = user_repo.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user_repo.update_user_password(db, user, get_password_hash(reset_data.new_password))
    revoke_all_user_tokens(user.id, db)

    audit_logger.log(
        db=db,
        event_type=AuditEventType.PASSWORD_RESET_COMPLETED,
        description="Password reset completed successfully",
        user_id=user.id,
        user_email=user.email,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
        endpoint="/api/auth/reset-password",
        success=True,
    )

    return MessageResponse(
        message="Password has been reset successfully. Please log in with your new password.",
    )


def change_password(
    password_data: PasswordChange,
    user: User,
    context: AuthRequestContext,
    db: Session,
) -> MessageResponse:
    if not verify_password(password_data.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user_repo.update_user_password(db, user, get_password_hash(password_data.new_password))

    audit_logger.log(
        db=db,
        event_type=AuditEventType.PASSWORD_CHANGED,
        description="Password changed successfully",
        user_id=user.id,
        user_email=user.email,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
        endpoint="/api/auth/change-password",
        success=True,
    )

    return MessageResponse(message="Password changed successfully")


def delete_account(
    user: User,
    context: AuthRequestContext,
    db: Session,
    *,
    app_settings: Settings | None = None,
) -> None:
    active_settings = _settings(app_settings)
    for doc in user.documents:
        if doc.profile_image:
            img_path = os.path.join(active_settings.upload_dir, doc.profile_image)
            if os.path.isfile(img_path):
                with contextlib.suppress(OSError):
                    os.remove(img_path)

    revoke_all_user_tokens(user.id, db)

    audit_logger.log_logout(
        db=db,
        user_id=user.id,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
        all_devices=True,
    )

    user_repo.delete_user(db, user)
