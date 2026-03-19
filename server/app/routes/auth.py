from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional

from app.database import get_db
from app.models import User
from app.schemas import (
    UserCreate, UserResponse, AccessTokenResponse,
    UserLogin, UserPreferences, RefreshTokenRequest
)
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    revoke_all_user_tokens,
    get_current_active_user
)
from app.config import get_settings
from app.security import InputSanitizer, account_lockout
from app.audit import audit_logger, get_client_ip, get_user_agent

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _get_device_info(request: Request) -> str:
    user_agent = request.headers.get("User-Agent", "Unknown")
    return user_agent[:200] if user_agent else "Unknown"


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set the refresh token as an HttpOnly cookie."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,  # Not accessible via JavaScript
        secure=settings.cookie_secure,  # HTTPS only in production
        samesite=settings.cookie_samesite,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/auth",  # Only sent to auth endpoints
        domain=settings.cookie_domain if settings.cookie_domain else None
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key="refresh_token",
        path="/api/auth",
        domain=settings.cookie_domain if settings.cookie_domain else None
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    sanitized_username = InputSanitizer.sanitize_string(user_data.username)
    
    if InputSanitizer.contains_dangerous_content(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username contains invalid characters"
        )
    
    # Normalize email to lowercase for case-insensitive matching
    normalized_email = user_data.email.lower()
    
    existing_email = db.query(User).filter(User.email == normalized_email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = db.query(User).filter(User.username == sanitized_username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=normalized_email,
        username=sanitized_username,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    audit_logger.log_registration(
        db=db,
        user_id=new_user.id,
        user_email=new_user.email,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    return new_user


@router.post("/login", response_model=AccessTokenResponse)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """Login and get access + refresh tokens. Use email as username field."""
    email = form_data.username.lower()
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    if account_lockout.is_locked(email):
        remaining = account_lockout.get_lockout_remaining(email)
        minutes = remaining // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked due to too many failed attempts. Try again in {minutes + 1} minutes.",
            headers={"Retry-After": str(remaining)},
        )
    
    user = db.query(User).filter(User.email == email).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        failures = account_lockout.record_failure(email)
        remaining_attempts = max(0, settings.account_lockout_attempts - failures)
        
        detail = "Incorrect email or password"
        if remaining_attempts <= 3 and remaining_attempts > 0:
            detail = f"Incorrect email or password. {remaining_attempts} attempts remaining before lockout."
        elif remaining_attempts == 0:
            detail = f"Account locked due to too many failed attempts. Try again in {settings.account_lockout_duration} minutes."
        
        audit_logger.log_login_failure(
            db=db,
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            reason="Invalid credentials",
            attempts_remaining=remaining_attempts
        )
        
        if remaining_attempts == 0:
            audit_logger.log_account_locked(
                db=db,
                email=email,
                ip_address=ip_address,
                user_agent=user_agent,
                failed_attempts=settings.account_lockout_attempts
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
            ip_address=ip_address,
            user_agent=user_agent,
            reason="Account inactive"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    account_lockout.clear_failures(email)
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    device_info = _get_device_info(request)
    refresh_token = create_refresh_token(user.id, db, device_info)
    
    audit_logger.log_login_success(
        db=db,
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    _set_refresh_cookie(response, refresh_token)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60
    }


@router.post("/login/json", response_model=AccessTokenResponse)
async def login_json(
    request: Request,
    response: Response,
    user_data: UserLogin, 
    db: Session = Depends(get_db)
):
    """Login with JSON body (alternative to form-data)."""
    email = user_data.email.lower()
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    if account_lockout.is_locked(email):
        remaining = account_lockout.get_lockout_remaining(email)
        minutes = remaining // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked due to too many failed attempts. Try again in {minutes + 1} minutes.",
            headers={"Retry-After": str(remaining)},
        )
    
    user = db.query(User).filter(User.email == email).first()
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        failures = account_lockout.record_failure(email)
        remaining_attempts = max(0, settings.account_lockout_attempts - failures)
        
        detail = "Incorrect email or password"
        if remaining_attempts <= 3 and remaining_attempts > 0:
            detail = f"Incorrect email or password. {remaining_attempts} attempts remaining before lockout."
        elif remaining_attempts == 0:
            detail = f"Account locked due to too many failed attempts. Try again in {settings.account_lockout_duration} minutes."
        
        audit_logger.log_login_failure(
            db=db,
            email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            reason="Invalid credentials",
            attempts_remaining=remaining_attempts
        )
        
        if remaining_attempts == 0:
            audit_logger.log_account_locked(
                db=db,
                email=email,
                ip_address=ip_address,
                user_agent=user_agent,
                failed_attempts=settings.account_lockout_attempts
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
            ip_address=ip_address,
            user_agent=user_agent,
            reason="Account inactive"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    account_lockout.clear_failures(email)
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    device_info = _get_device_info(request)
    refresh_token = create_refresh_token(user.id, db, device_info)
    
    audit_logger.log_login_success(
        db=db,
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    _set_refresh_cookie(response, refresh_token)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60
    }


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_tokens(
    request: Request,
    response: Response,
    token_request: Optional[RefreshTokenRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db)
):
    """
    Refresh access token using a valid refresh token.
    
    The refresh token can be provided either:
    1. As an HttpOnly cookie (preferred, more secure)
    2. In the request body (fallback for clients that can't use cookies)
    
    Implements token rotation: each refresh token can only be used once.
    A new refresh token is returned with each successful refresh.
    
    If a previously-used refresh token is presented, ALL tokens for that
    user are revoked (security measure against token theft).
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
        refresh_token, db,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    if not user or not old_token:
        from app.audit import AuditEventType
        audit_logger.log(
            db=db,
            event_type=AuditEventType.TOKEN_REFRESH_FAILURE,
            description="Token refresh failed - invalid or expired token",
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/refresh",
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    device_info = _get_device_info(request)
    new_refresh_token = rotate_refresh_token(old_token, db, device_info)
    
    audit_logger.log_token_refresh(
        db=db,
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    _set_refresh_cookie(response, new_refresh_token)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60
    }


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    token_request: Optional[RefreshTokenRequest] = None,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    db: Session = Depends(get_db)
):
    """
    Logout by revoking the refresh token.
    
    The refresh token can be provided either as an HttpOnly cookie or in the request body.
    The access token will remain valid until it expires (short-lived),
    but the refresh token is immediately invalidated.
    """
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
        user_id=None,  # We don't know user_id from just the token
        ip_address=ip_address,
        user_agent=user_agent,
        all_devices=False
    )
    
    return {"message": "Successfully logged out"}


@router.post("/logout/all")
async def logout_all_devices(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Logout from all devices by revoking all refresh tokens.
    
    Requires valid access token authentication.
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    count = revoke_all_user_tokens(current_user.id, db)
    
    _clear_refresh_cookie(response)
    
    audit_logger.log_logout(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        all_devices=True
    )
    
    return {
        "message": "Successfully logged out from all devices",
        "sessions_revoked": count
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return current_user


@router.patch("/preferences", response_model=UserResponse)
async def update_preferences(
    preferences: UserPreferences,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user preferences (theme, language)."""
    if preferences.theme is not None:
        current_user.theme = preferences.theme
    if preferences.language is not None:
        current_user.language = preferences.language
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Permanently delete the authenticated user's account and all associated data.

    This implements the GDPR right to erasure (Art. 17 GDPR). All documents, profile
    images, refresh tokens, and the user record itself are deleted. The action is
    irreversible.
    """
    import os

    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    from app.config import get_settings as _get_settings
    _settings = _get_settings()
    upload_dir = getattr(_settings, "upload_dir", "uploads/profile_images")
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
        all_devices=True
    )

    db.delete(current_user)
    db.commit()

    _clear_refresh_cookie(response)
