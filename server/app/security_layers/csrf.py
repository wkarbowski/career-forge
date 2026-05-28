"""CSRF validation helpers and middleware."""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar
from urllib.parse import urlparse

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

settings = get_settings()


class CSRFProtection:
    """
    CSRF protection utilities.

    Note: For JWT-based APIs using Authorization headers, CSRF is less of a concern
    because browsers don't automatically include Authorization headers in cross-origin
    requests. However, we still implement best practices:

    1. SameSite cookie attribute (if using cookies)
    2. Origin/Referer validation for state-changing operations
    3. Custom header requirement (X-Requested-With)
    """

    @staticmethod
    def validate_origin(request: Request, allowed_origins: list[str]) -> bool:
        """
        Validate that the request origin is allowed.

        Args:
            request: The incoming request
            allowed_origins: List of allowed origins

        Returns:
            True if origin is valid or not present (same-origin)
        """
        origin = request.headers.get("Origin")

        # No origin header means same-origin request (browser doesn't send it)
        if not origin:
            return True

        # Check if origin is in allowed list
        return origin in allowed_origins

    @staticmethod
    def validate_referer(request: Request, allowed_hosts: list[str]) -> bool:
        """
        Validate the Referer header for additional security.

        Args:
            request: The incoming request
            allowed_hosts: List of allowed host names

        Returns:
            True if referer is valid
        """
        referer = request.headers.get("Referer")

        # No referer is acceptable (some browsers/privacy tools strip it)
        if not referer:
            return True

        # Parse referer to get host
        parsed = urlparse(referer)

        # Allow if host matches or in allowed list
        if "*" in allowed_hosts:
            return True

        return parsed.netloc in allowed_hosts


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce CSRF protection for state-changing requests.
    Validates Origin header for POST, PUT, PATCH, DELETE requests.

    Note: For JWT-based JSON APIs the risk is already mitigated by:
      - CORS policy (browser blocks cross-origin requests)
      - Content-Type validation (only application/json accepted, so browser
        form-based CSRF attacks cannot reach the handler)
      - SameSite cookie attribute on the refresh token cookie
    This middleware provides an additional layer of defence for production.
    In development it is skipped to avoid issues with local reverse proxies
    (e.g. webpack-dev-server) that may rewrite the Origin header.
    """

    STATE_CHANGING_METHODS: ClassVar[set[str]] = {"POST", "PUT", "PATCH", "DELETE"}

    # Paths that don't require CSRF validation (e.g., public APIs)
    EXEMPT_PATHS: ClassVar[set[str]] = {
        "/api/health",
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
    }

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # Skip entirely in development — local reverse proxies (CRA webpack-dev-
        # server, Vite, etc.) often rewrite or strip the Origin header, causing
        # false positives. CORS + Content-Type validation cover the same risk.
        if settings.environment.lower() != "production":
            return await call_next(request)

        # Only check state-changing methods
        if request.method not in self.STATE_CHANGING_METHODS:
            return await call_next(request)

        # Skip exempt paths
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Build the full list of acceptable origins: CORS whitelist + the server
        # host itself (covers direct browser-to-API requests).
        allowed = list(settings.cors_origins_list)
        host = request.headers.get("host", "")
        if host:
            scheme = "https" if settings.enforce_https else "http"
            allowed.append(f"{scheme}://{host}")

        # Validate origin
        if not CSRFProtection.validate_origin(request, allowed):
            return Response(
                content='{"detail": "CSRF validation failed: Invalid origin", "code": "csrf_failed"}',
                status_code=status.HTTP_403_FORBIDDEN,
                media_type="application/json",
            )

        return await call_next(request)
