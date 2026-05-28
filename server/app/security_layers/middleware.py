"""Security middleware stack setup."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, ClassVar

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.security_layers.csrf import CSRFMiddleware
from app.security_layers.rate_limit import rate_limiter

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

settings = get_settings()
logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce rate limits on API requests.
    Uses different limits for auth endpoints vs general endpoints.
    Logs rate limit violations to audit system.
    """

    # Auth endpoints that need stricter rate limiting
    AUTH_PATHS: ClassVar[set[str]] = {"/api/auth/login", "/api/auth/register", "/api/auth/login/json"}

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # Get client identifier (IP address)
        client_ip = self._get_client_ip(request)
        path = request.url.path

        # Determine rate limit based on endpoint
        if path in self.AUTH_PATHS:
            max_requests = settings.rate_limit_auth_per_minute
            limit_key = f"auth:{client_ip}"
        else:
            max_requests = settings.rate_limit_per_minute
            limit_key = f"general:{client_ip}"

        # Check rate limit
        if not rate_limiter.is_allowed(limit_key, max_requests):
            remaining = rate_limiter.get_remaining(limit_key, max_requests)
            reset_time = rate_limiter.get_reset_time(limit_key)

            # Log rate limit violation for security monitoring
            logger.warning(f"Rate limit exceeded: {client_ip} on {path}")

            # Audit log the rate limit violation (async-safe)
            try:
                from app.audit import AuditEventType, AuditSeverity, audit_logger
                from app.database import SessionLocal

                db = SessionLocal()
                try:
                    audit_logger.log(
                        db=db,
                        event_type=AuditEventType.RATE_LIMIT_EXCEEDED,
                        severity=AuditSeverity.WARNING,
                        description=f"Rate limit exceeded on {path}",
                        ip_address=client_ip,
                        user_agent=request.headers.get("User-Agent", "")[:200],
                        endpoint=path,
                        success=False,
                    )
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Failed to log rate limit audit: {e}")

            return Response(
                content='{"detail": "Too many requests. Please try again later.", "code": "rate_limit_exceeded"}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(reset_time),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        remaining = rate_limiter.get_remaining(limit_key, max_requests)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)

        return response

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP, considering proxy headers.

        Security: Only trust proxy headers when TRUSTED_HOSTS is configured,
        indicating we're behind a known reverse proxy.
        """
        # Only trust proxy headers if we're behind a configured proxy
        if settings.trusted_hosts and settings.trusted_hosts_list != ["*"]:
            # Check for forwarded header (when behind proxy/load balancer)
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                # Take the first IP in the chain (original client)
                # Note: If behind multiple proxies, configure trusted proxy count
                return forwarded.split(",")[0].strip()

            # Check for real IP header
            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                return real_ip

        # Fall back to direct connection IP (safest default)
        return request.client.host if request.client else "unknown"


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """
    Middleware to redirect HTTP requests to HTTPS in production.
    Only active when ENFORCE_HTTPS is set to true.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if not settings.enforce_https:
            return await call_next(request)

        # Check if request is already HTTPS
        # Also check X-Forwarded-Proto for requests behind proxy
        proto = request.headers.get("X-Forwarded-Proto", request.url.scheme)

        if proto != "https":
            # Build HTTPS URL
            https_url = request.url.replace(scheme="https")
            return RedirectResponse(url=str(https_url), status_code=301)

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    Implements OWASP recommended security headers.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # XSS Protection (legacy, but still useful for older browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()"
        )

        # Content Security Policy for API
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

        # HSTS (only in production with HTTPS)
        if settings.enforce_https:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Cache control for sensitive endpoints
        if "/api/auth/" in request.url.path:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        return response


# =============================================================================
# REQUEST SIZE LIMITING (DoS Prevention)
# =============================================================================


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to limit request body size to prevent DoS attacks.
    Default limit is 10MB, configurable via MAX_REQUEST_SIZE.
    """

    MAX_SIZE = 10 * 1024 * 1024  # 10MB default

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # Check Content-Length header if present
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                size = int(content_length)
                if size > self.MAX_SIZE:
                    host = request.client.host if request.client else "unknown"
                    logger.warning(f"Request too large: {size} bytes from {host}")
                    return Response(
                        content=(
                            '{"detail": "Request body too large. Maximum size is 10MB.", "code": "request_too_large"}'
                        ),
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        media_type="application/json",
                    )
            except ValueError:
                pass  # Invalid content-length, let it through for other validation

        return await call_next(request)


# =============================================================================
# CONTENT-TYPE VALIDATION
# =============================================================================


class ContentTypeValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce Content-Type for API endpoints.
    Prevents CSRF attacks via form submissions to JSON APIs.
    """

    STATE_CHANGING_METHODS: ClassVar[set[str]] = {"POST", "PUT", "PATCH"}

    # Paths that accept form data
    FORM_ALLOWED_PATHS: ClassVar[set[str]] = {
        "/api/auth/login",  # OAuth2 form login
        # Allow image upload endpoint to accept multipart/form-data
        "/api/documents/upload-image",  # generic fallback (if not using path params)
    }

    # Accept all /api/documents/{id}/upload-image
    def is_form_allowed(self, path: str) -> bool:
        if path.startswith("/api/documents/") and path.endswith("/upload-image"):
            return True
        return path in self.FORM_ALLOWED_PATHS

    # Paths to skip validation
    SKIP_PATHS: ClassVar[set[str]] = {
        "/api/health",
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
        "/",
    }

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        path = request.url.path

        # Skip non-API paths and exempted paths
        if not path.startswith("/api/") or path in self.SKIP_PATHS:
            return await call_next(request)

        # Only validate state-changing methods
        if request.method not in self.STATE_CHANGING_METHODS:
            return await call_next(request)

        # Allow form data for specific paths
        if self.is_form_allowed(path):
            return await call_next(request)

        # Validate Content-Type
        content_type = request.headers.get("content-type", "")

        # Must be JSON for API endpoints
        if "application/json" not in content_type.lower():
            return Response(
                content='{"detail": "Content-Type must be application/json", "code": "invalid_content_type"}',
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                media_type="application/json",
            )

        return await call_next(request)


# =============================================================================
# MIDDLEWARE SETUP HELPER
# =============================================================================


def setup_security_middleware(app: FastAPI) -> None:
    """Configure all security middleware for the FastAPI application."""
    # Add middleware in reverse order (last added = first executed)

    # 1. Security headers (runs last, adds headers to response)
    app.add_middleware(SecurityHeadersMiddleware)

    # 2. CSRF protection
    app.add_middleware(CSRFMiddleware)

    # 3. Content-Type validation for API endpoints
    app.add_middleware(ContentTypeValidationMiddleware)

    # 4. Rate limiting (with audit logging)
    app.add_middleware(RateLimitMiddleware)

    # 5. Request size limiting (prevent DoS)
    app.add_middleware(RequestSizeLimitMiddleware)

    # 6. HTTPS redirect (runs first, redirects if needed)
    app.add_middleware(HTTPSRedirectMiddleware)

    # 7. Trusted hosts (prevent host header attacks)
    if settings.trusted_hosts and settings.trusted_hosts_list != ["*"]:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)
