from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm  # noqa: TC002 - FastAPI resolves at runtime

from app.audit import get_client_ip, get_user_agent
from app.auth import get_current_active_user
from app.config import get_settings
from app.database import get_db
from app.email import send_password_reset_email
from app.schemas import (
    AccessTokenResponse,
    ErrorResponse,
    LogoutAllResponse,
    MessageResponse,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetResponse,
    RefreshTokenRequest,
    UserCreate,
    UserLogin,
    UserPreferences,
    UserResponse,
)
from app.services import auth_service
from app.services.auth_service import AuthRequestContext, IssuedTokens

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models import User

_error_responses: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "Authentication required or invalid credentials"},
    429: {"model": ErrorResponse, "description": "Rate limit exceeded or account locked"},
}

router = APIRouter(prefix="/auth", tags=["Authentication"], responses=_error_responses)
settings = get_settings()


def _get_device_info(request: Request) -> str:
    user_agent = request.headers.get("User-Agent", "Unknown")
    return user_agent[:200] if user_agent else "Unknown"


def _get_auth_context(request: Request) -> AuthRequestContext:
    return AuthRequestContext(
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        device_info=_get_device_info(request),
    )


def _set_refresh_cookie(response: Response, token: str) -> None:
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


def _refresh_token_from_request(
    token_request: RefreshTokenRequest | None,
    refresh_token_cookie: str | None,
) -> str | None:
    if refresh_token_cookie:
        return refresh_token_cookie
    if token_request and token_request.refresh_token:
        return token_request.refresh_token
    return None


def _token_response(response: Response, issued_tokens: IssuedTokens) -> AccessTokenResponse:
    _set_refresh_cookie(response, issued_tokens.refresh_token)
    return issued_tokens.response


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_data: UserCreate,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Register a new user."""
    user = auth_service.register_user(user_data, _get_auth_context(request), db)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=AccessTokenResponse)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Login with OAuth2 form-data. Use email as the ``username`` field."""
    context = _get_auth_context(request)
    user = auth_service.authenticate_user(form_data.username, form_data.password, context, db, app_settings=settings)
    issued_tokens = auth_service.issue_tokens(user, context, db, app_settings=settings)
    return _token_response(response, issued_tokens)


@router.post("/login/json", response_model=AccessTokenResponse)
async def login_json(
    request: Request,
    response: Response,
    user_data: UserLogin,
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Login with JSON body (alternative to form-data)."""
    context = _get_auth_context(request)
    user = auth_service.authenticate_user(user_data.email, user_data.password, context, db, app_settings=settings)
    issued_tokens = auth_service.issue_tokens(user, context, db, app_settings=settings)
    return _token_response(response, issued_tokens)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_tokens(
    request: Request,
    response: Response,
    token_request: RefreshTokenRequest | None = None,
    refresh_token_cookie: str | None = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Refresh access token using a valid refresh token."""
    refresh_token = _refresh_token_from_request(token_request, refresh_token_cookie)
    issued_tokens = auth_service.refresh_access_tokens(
        refresh_token,
        _get_auth_context(request),
        db,
        app_settings=settings,
    )
    return _token_response(response, issued_tokens)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    token_request: RefreshTokenRequest | None = None,
    refresh_token_cookie: str | None = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Logout by revoking the refresh token."""
    refresh_token = _refresh_token_from_request(token_request, refresh_token_cookie)
    result = auth_service.logout(refresh_token, _get_auth_context(request), db)
    _clear_refresh_cookie(response)
    return result


@router.post("/logout/all", response_model=LogoutAllResponse)
async def logout_all_devices(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> LogoutAllResponse:
    """Logout from all devices by revoking all refresh tokens."""
    result = auth_service.logout_all_devices(current_user, _get_auth_context(request), db)
    _clear_refresh_cookie(response)
    return result


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
    user = auth_service.update_preferences(preferences, current_user, db)
    return UserResponse.model_validate(user)


@router.post("/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(
    request: Request,
    reset_request: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> PasswordResetResponse:
    """Record a password reset request."""
    return auth_service.request_password_reset(
        reset_request,
        _get_auth_context(request),
        db,
        email_sender=send_password_reset_email,
        app_settings=settings,
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: Request,
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Reset password using a valid reset token."""
    return auth_service.reset_password(reset_data, _get_auth_context(request), db, app_settings=settings)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: Request,
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Change the current user's password."""
    return auth_service.change_password(password_data, current_user, _get_auth_context(request), db)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> None:
    """Permanently delete account and all data (GDPR Art. 17)."""
    auth_service.delete_account(current_user, _get_auth_context(request), db, app_settings=settings)
    _clear_refresh_cookie(response)
