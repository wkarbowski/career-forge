"""Compatibility facade for backend security utilities.

The implementation lives in focused modules under ``app.security_layers`` so
rate limiting, lockout, middleware, CSRF, and sanitization can evolve
independently while existing imports from ``app.security`` remain stable.
"""

from __future__ import annotations

from app.security_layers.account_lockout import (
    AccountLockoutBackend,
    FallbackAccountLockout,
    InMemoryAccountLockout,
    RedisAccountLockout,
    account_lockout,
    create_account_lockout,
)
from app.security_layers.csrf import CSRFMiddleware, CSRFProtection
from app.security_layers.middleware import (
    ContentTypeValidationMiddleware,
    HTTPSRedirectMiddleware,
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
    setup_security_middleware,
)
from app.security_layers.rate_limit import (
    FallbackRateLimiter,
    InMemoryRateLimiter,
    RateLimiterBackend,
    RedisRateLimiter,
    create_rate_limiter,
    rate_limiter,
)
from app.security_layers.sanitization import InputSanitizer

__all__ = [
    "AccountLockoutBackend",
    "CSRFMiddleware",
    "CSRFProtection",
    "ContentTypeValidationMiddleware",
    "FallbackAccountLockout",
    "FallbackRateLimiter",
    "HTTPSRedirectMiddleware",
    "InMemoryAccountLockout",
    "InMemoryRateLimiter",
    "InputSanitizer",
    "RateLimitMiddleware",
    "RateLimiterBackend",
    "RedisAccountLockout",
    "RedisRateLimiter",
    "RequestSizeLimitMiddleware",
    "SecurityHeadersMiddleware",
    "account_lockout",
    "create_account_lockout",
    "create_rate_limiter",
    "rate_limiter",
    "setup_security_middleware",
]
