"""Security middleware and utilities for Career Forge.

Provides rate limiting, HTTPS enforcement, security headers,
CSRF protection, request-size limits, content-type validation,
and input sanitization.
"""

from __future__ import annotations

import html
import logging
import re
import time
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import TYPE_CHECKING, Any, ClassVar
from urllib.parse import urlparse

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class RateLimiterBackend(ABC):
    """Abstract base class for rate limiter backends."""

    @abstractmethod
    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """Check if a request is allowed."""
        pass

    @abstractmethod
    def get_remaining(self, key: str, max_requests: int, window_seconds: int = 60) -> int:
        """Get remaining requests in the current window."""
        pass

    @abstractmethod
    def get_reset_time(self, key: str, window_seconds: int = 60) -> int:
        """Get seconds until the rate limit resets."""
        pass


class InMemoryRateLimiter(RateLimiterBackend):
    """In-memory rate limiter using sliding window algorithm.

    Suitable for single-instance deployments or development.

    Note: Includes automatic memory cleanup to prevent unbounded growth.
    """

    def __init__(self, max_keys: int = 10000) -> None:
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.max_keys = max_keys
        self._last_cleanup: float = time.time()
        self._cleanup_interval: float = 300.0  # 5 minutes

    def _cleanup_old_entries(self, window_seconds: int = 60) -> None:
        """Remove expired entries to prevent memory leaks."""
        current_time = time.time()

        # Only cleanup periodically
        if current_time - self._last_cleanup < self._cleanup_interval:
            return

        self._last_cleanup = current_time
        window_start = current_time - window_seconds

        # Remove empty or expired keys
        keys_to_remove = []
        for key, timestamps in self.requests.items():
            # Filter to only recent requests
            self.requests[key] = [t for t in timestamps if t > window_start]
            if not self.requests[key]:
                keys_to_remove.append(key)

        for key in keys_to_remove:
            del self.requests[key]

        # If still too many keys, remove oldest
        if len(self.requests) > self.max_keys:
            sorted_keys = sorted(
                self.requests.keys(),
                key=lambda k: min(self.requests[k]) if self.requests[k] else 0
            )
            for key in sorted_keys[:len(self.requests) - self.max_keys]:
                del self.requests[key]

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """
        Check if a request is allowed based on rate limit.

        Args:
            key: Unique identifier (e.g., IP address or user ID)
            max_requests: Maximum requests allowed in the window
            window_seconds: Time window in seconds

        Returns:
            True if request is allowed, False if rate limited
        """
        # Periodic cleanup to prevent memory leaks
        self._cleanup_old_entries(window_seconds)

        current_time = time.time()
        window_start = current_time - window_seconds

        # Clean old requests outside the window
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if req_time > window_start
        ]

        # Check if under limit
        if len(self.requests[key]) >= max_requests:
            return False

        # Record this request
        self.requests[key].append(current_time)
        return True

    def get_remaining(self, key: str, max_requests: int, window_seconds: int = 60) -> int:
        """Get remaining requests in the current window."""
        current_time = time.time()
        window_start = current_time - window_seconds

        current_requests = [
            req_time for req_time in self.requests[key]
            if req_time > window_start
        ]

        return max(0, max_requests - len(current_requests))

    def get_reset_time(self, key: str, window_seconds: int = 60) -> int:
        """Get seconds until the rate limit resets."""
        if not self.requests[key]:
            return 0

        oldest_request = min(self.requests[key])
        reset_time = oldest_request + window_seconds - time.time()
        return max(0, int(reset_time))


class RedisRateLimiter(RateLimiterBackend):
    """
    Redis-based rate limiter using sliding window algorithm.
    Suitable for distributed/multi-instance deployments.

    Uses Redis sorted sets to implement an efficient sliding window.
    Each request timestamp is stored as a score, allowing efficient
    range queries and automatic expiration.
    """

    def __init__(self, redis_url: str, password: str | None = None) -> None:
        self._redis: Any = None
        self._redis_url = redis_url
        self._password = password
        self._connected = False
        self._connect()

    def _connect(self) -> None:
        """Establish Redis connection."""
        try:
            import redis

            # Parse URL and add password if provided
            if self._password:
                self._redis = redis.from_url(
                    self._redis_url,
                    password=self._password,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            else:
                self._redis = redis.from_url(
                    self._redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )

            # Test connection
            self._redis.ping()
            self._connected = True
            logger.info("✅ Redis rate limiter connected successfully")

        except ImportError:
            logger.error("❌ Redis package not installed. Run: pip install redis")
            self._connected = False
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            self._connected = False

    @property
    def is_connected(self) -> bool:
        if not self._connected or not self._redis:
            return False
        try:
            self._redis.ping()
            return True
        except Exception:
            self._connected = False
            return False

    def _get_key(self, key: str) -> str:
        return f"ratelimit:{key}"

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        """
        Check if a request is allowed using Redis sorted set.

        Uses ZREMRANGEBYSCORE to remove old entries and ZCARD to count current.
        All operations are pipelined for efficiency.
        """
        if not self.is_connected:
            return True  # Fail open if Redis is down

        try:
            redis_key = self._get_key(key)
            current_time = time.time()
            window_start = current_time - window_seconds

            # Use pipeline for atomic operations
            pipe = self._redis.pipeline()

            # Remove old entries outside the window
            pipe.zremrangebyscore(redis_key, 0, window_start)

            # Count current entries
            pipe.zcard(redis_key)

            # Execute pipeline
            results = pipe.execute()
            current_count = results[1]

            # Check if under limit
            if current_count >= max_requests:
                return False

            # Add new request with current timestamp as score
            # Use pipeline again for the add + expire
            pipe = self._redis.pipeline()
            pipe.zadd(redis_key, {f"{current_time}:{id(current_time)}": current_time})
            pipe.expire(redis_key, window_seconds + 10)  # Extra buffer for safety
            pipe.execute()

            return True

        except Exception as e:
            logger.warning(f"Redis rate limit error: {e}")
            return True  # Fail open

    def get_remaining(self, key: str, max_requests: int, window_seconds: int = 60) -> int:
        """Get remaining requests in the current window."""
        if not self.is_connected:
            return max_requests

        try:
            redis_key = self._get_key(key)
            current_time = time.time()
            window_start = current_time - window_seconds

            # Count entries in the current window
            pipe = self._redis.pipeline()
            pipe.zremrangebyscore(redis_key, 0, window_start)
            pipe.zcard(redis_key)
            results = pipe.execute()

            current_count = int(results[1])
            return max(0, max_requests - current_count)

        except Exception as e:
            logger.warning(f"Redis get_remaining error: {e}")
            return max_requests

    def get_reset_time(self, key: str, window_seconds: int = 60) -> int:
        """Get seconds until the rate limit resets."""
        if not self.is_connected:
            return 0

        try:
            redis_key = self._get_key(key)

            # Get the oldest entry (smallest score)
            oldest = self._redis.zrange(redis_key, 0, 0, withscores=True)

            if not oldest:
                return 0

            oldest_timestamp = oldest[0][1]
            reset_time = oldest_timestamp + window_seconds - time.time()
            return max(0, int(reset_time))

        except Exception as e:
            logger.warning(f"Redis get_reset_time error: {e}")
            return 0


class FallbackRateLimiter(RateLimiterBackend):
    """Rate limiter with automatic fallback from Redis to in-memory."""

    def __init__(self, primary: RateLimiterBackend, fallback: RateLimiterBackend) -> None:
        self._primary = primary
        self._fallback = fallback
        self._using_fallback = False

    def _get_backend(self) -> RateLimiterBackend:
        """Get the appropriate backend, checking Redis health."""
        if isinstance(self._primary, RedisRateLimiter):
            if self._primary.is_connected:
                if self._using_fallback:
                    logger.info("✅ Redis reconnected, switching back from fallback")
                    self._using_fallback = False
                return self._primary
            else:
                if not self._using_fallback:
                    logger.warning("⚠️ Redis unavailable, using in-memory fallback")
                    self._using_fallback = True
                return self._fallback
        return self._primary

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        return self._get_backend().is_allowed(key, max_requests, window_seconds)

    def get_remaining(self, key: str, max_requests: int, window_seconds: int = 60) -> int:
        return self._get_backend().get_remaining(key, max_requests, window_seconds)

    def get_reset_time(self, key: str, window_seconds: int = 60) -> int:
        return self._get_backend().get_reset_time(key, window_seconds)


def create_rate_limiter() -> RateLimiterBackend:
    """
    Factory function to create the appropriate rate limiter based on config.

    Returns:
        Configured rate limiter instance
    """
    if settings.rate_limit_backend == "redis" and settings.redis_url:
        logger.info(f"Initializing Redis rate limiter: {settings.redis_url}")
        redis_limiter = RedisRateLimiter(
            redis_url=settings.redis_url,
            password=settings.redis_password or None
        )

        # Create fallback wrapper
        memory_limiter = InMemoryRateLimiter()
        return FallbackRateLimiter(redis_limiter, memory_limiter)

    logger.info("Using in-memory rate limiter")
    return InMemoryRateLimiter()


rate_limiter = create_rate_limiter()


class AccountLockoutBackend(ABC):
    """Abstract base class for account lockout backends."""

    @abstractmethod
    def record_failure(self, identifier: str) -> int:
        """Record a failed login attempt. Returns current failure count."""
        pass

    @abstractmethod
    def get_failures(self, identifier: str) -> int:
        """Get current failure count for identifier."""
        pass

    @abstractmethod
    def is_locked(self, identifier: str) -> bool:
        """Check if account is locked."""
        pass

    @abstractmethod
    def get_lockout_remaining(self, identifier: str) -> int:
        """Get remaining lockout time in seconds."""
        pass

    @abstractmethod
    def clear_failures(self, identifier: str) -> None:
        """Clear failure count (called on successful login)."""
        pass


class InMemoryAccountLockout(AccountLockoutBackend):
    """In-memory account lockout tracker.

    Suitable for single-instance deployments.
    """

    def __init__(self, max_attempts: int = 10, lockout_duration: int = 15) -> None:
        self._failures: dict[str, list[float]] = defaultdict(list)
        self._lockouts: dict[str, float] = {}
        self._max_attempts = max_attempts
        self._lockout_duration: int = lockout_duration * 60  # seconds
        self._window: int = 30 * 60  # 30 minutes

    def _cleanup_old_failures(self, identifier: str) -> None:
        cutoff = time.time() - self._window
        self._failures[identifier] = [
            t for t in self._failures[identifier] if t > cutoff
        ]

    def record_failure(self, identifier: str) -> int:
        self._cleanup_old_failures(identifier)
        self._failures[identifier].append(time.time())

        count = len(self._failures[identifier])

        if count >= self._max_attempts:
            self._lockouts[identifier] = time.time() + self._lockout_duration
            logger.warning(f"Account locked due to {count} failed attempts: {identifier}")

        return count

    def get_failures(self, identifier: str) -> int:
        """Get current failure count."""
        self._cleanup_old_failures(identifier)
        return len(self._failures[identifier])

    def is_locked(self, identifier: str) -> bool:
        if identifier not in self._lockouts:
            return False

        if time.time() >= self._lockouts[identifier]:
            # Lockout expired
            del self._lockouts[identifier]
            self._failures[identifier] = []  # Clear failures after lockout expires
            return False

        return True

    def get_lockout_remaining(self, identifier: str) -> int:
        """Get remaining lockout time in seconds."""
        if identifier not in self._lockouts:
            return 0

        remaining = self._lockouts[identifier] - time.time()
        return max(0, int(remaining))

    def clear_failures(self, identifier: str) -> None:
        self._failures[identifier] = []
        if identifier in self._lockouts:
            del self._lockouts[identifier]


class RedisAccountLockout(AccountLockoutBackend):
    """
    Redis-based account lockout tracker.
    Suitable for distributed/multi-instance deployments.
    """

    def __init__(self, redis_url: str, password: str | None = None,
                 max_attempts: int = 10, lockout_duration: int = 15) -> None:
        self._redis: Any = None
        self._redis_url = redis_url
        self._password = password
        self._connected = False
        self._max_attempts = max_attempts
        self._lockout_duration: int = lockout_duration * 60
        self._window: int = 30 * 60
        self._connect()

    def _connect(self) -> None:
        try:
            import redis

            if self._password:
                self._redis = redis.from_url(
                    self._redis_url, password=self._password,
                    decode_responses=True, socket_timeout=5
                )
            else:
                self._redis = redis.from_url(
                    self._redis_url, decode_responses=True, socket_timeout=5
                )
            self._redis.ping()
            self._connected = True
        except Exception as e:
            logger.error(f"Redis account lockout connection failed: {e}")
            self._connected = False

    @property
    def is_connected(self) -> bool:
        if not self._connected or not self._redis:
            return False
        try:
            self._redis.ping()
            return True
        except Exception:
            return False

    def _failure_key(self, identifier: str) -> str:
        return f"lockout:failures:{identifier}"

    def _lock_key(self, identifier: str) -> str:
        return f"lockout:locked:{identifier}"

    def record_failure(self, identifier: str) -> int:
        """Record failed attempt using Redis sorted set."""
        if not self.is_connected:
            return 0

        try:
            current_time = time.time()
            failure_key = self._failure_key(identifier)

            pipe = self._redis.pipeline()
            # Remove old failures
            pipe.zremrangebyscore(failure_key, 0, current_time - self._window)
            # Add new failure
            pipe.zadd(failure_key, {str(current_time): current_time})
            # Set expiry on failure tracking
            pipe.expire(failure_key, self._window + 60)
            # Get count
            pipe.zcard(failure_key)
            results = pipe.execute()

            count = int(results[3])

            # Lock if threshold reached
            if count >= self._max_attempts:
                self._redis.setex(
                    self._lock_key(identifier),
                    self._lockout_duration,
                    "locked"
                )
                logger.warning(f"Account locked (Redis): {identifier}")

            return count
        except Exception as e:
            logger.warning(f"Redis record_failure error: {e}")
            return 0

    def get_failures(self, identifier: str) -> int:
        if not self.is_connected:
            return 0
        try:
            current_time = time.time()
            failure_key = self._failure_key(identifier)
            self._redis.zremrangebyscore(failure_key, 0, current_time - self._window)
            return int(self._redis.zcard(failure_key))
        except Exception:
            return 0

    def is_locked(self, identifier: str) -> bool:
        if not self.is_connected:
            return False
        try:
            return bool(self._redis.exists(self._lock_key(identifier)))
        except Exception:
            return False

    def get_lockout_remaining(self, identifier: str) -> int:
        if not self.is_connected:
            return 0
        try:
            ttl = self._redis.ttl(self._lock_key(identifier))
            return max(0, ttl) if ttl > 0 else 0
        except Exception:
            return 0

    def clear_failures(self, identifier: str) -> None:
        if not self.is_connected:
            return
        try:
            pipe = self._redis.pipeline()
            pipe.delete(self._failure_key(identifier))
            pipe.delete(self._lock_key(identifier))
            pipe.execute()
        except Exception as e:
            logger.warning(f"Redis clear_failures error: {e}")


class FallbackAccountLockout(AccountLockoutBackend):
    """Account lockout with automatic fallback."""

    def __init__(self, primary: AccountLockoutBackend, fallback: AccountLockoutBackend) -> None:
        self._primary = primary
        self._fallback = fallback

    def _get_backend(self) -> AccountLockoutBackend:
        if isinstance(self._primary, RedisAccountLockout):
            if self._primary.is_connected:
                return self._primary
            return self._fallback
        return self._primary

    def record_failure(self, identifier: str) -> int:
        return self._get_backend().record_failure(identifier)

    def get_failures(self, identifier: str) -> int:
        return self._get_backend().get_failures(identifier)

    def is_locked(self, identifier: str) -> bool:
        return self._get_backend().is_locked(identifier)

    def get_lockout_remaining(self, identifier: str) -> int:
        return self._get_backend().get_lockout_remaining(identifier)

    def clear_failures(self, identifier: str) -> None:
        return self._get_backend().clear_failures(identifier)


def create_account_lockout() -> AccountLockoutBackend:
    """Factory function to create account lockout tracker."""
    max_attempts = settings.account_lockout_attempts
    lockout_duration = settings.account_lockout_duration

    if settings.rate_limit_backend == "redis" and settings.redis_url:
        logger.info("Initializing Redis account lockout")
        redis_lockout = RedisAccountLockout(
            redis_url=settings.redis_url,
            password=settings.redis_password or None,
            max_attempts=max_attempts,
            lockout_duration=lockout_duration
        )
        memory_lockout = InMemoryAccountLockout(max_attempts, lockout_duration)
        return FallbackAccountLockout(redis_lockout, memory_lockout)

    logger.info("Using in-memory account lockout")
    return InMemoryAccountLockout(max_attempts, lockout_duration)


account_lockout = create_account_lockout()


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
                        success=False
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
                }
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
            "geolocation=(), microphone=(), camera=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=()"
        )

        # Content Security Policy for API
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'"
        )

        # HSTS (only in production with HTTPS)
        if settings.enforce_https:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Cache control for sensitive endpoints
        if "/api/auth/" in request.url.path:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        return response


class InputSanitizer:
    """
    Utility class for sanitizing user inputs to prevent XSS and injection attacks.
    """

    # Patterns that might indicate malicious input
    DANGEROUS_PATTERNS: ClassVar[list[str]] = [
        r'<script[^>]*>',  # Script tags
        r'javascript:',     # JavaScript URLs
        r'on\w+\s*=',       # Event handlers (onclick, onerror, etc.)
        r'data:text/html',  # Data URLs with HTML
        r'vbscript:',       # VBScript URLs
        r'expression\s*\(', # CSS expressions
    ]

    # Compile patterns for efficiency
    _compiled_patterns: ClassVar[list[re.Pattern[str]]] = [re.compile(p, re.IGNORECASE) for p in DANGEROUS_PATTERNS]

    # Safe HTML tags for document rich text fields
    SAFE_HTML_TAGS: ClassVar[list[str]] = [
        'b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'span', 'div',
    ]
    SAFE_HTML_ATTRS: ClassVar[dict[str, list[str]]] = {
        'a': ['href', 'title'],
        'span': ['class', 'style'],
        'p': ['style'],
        'div': ['style'],
        'li': ['style'],
        'ul': ['style'],
        'ol': ['style'],
        'b': ['style'],
        'i': ['style'],
        'u': ['style'],
        'strong': ['style'],
        'em': ['style'],
    }

    @classmethod
    def sanitize_html(cls, value: str) -> str:
        """
        Sanitize HTML content, allowing only safe tags and CSS properties.
        Uses bleach + CSSSanitizer so inline styles (font-size, color, etc.)
        are preserved while dangerous content is stripped.
        """
        if not isinstance(value, str):
            return value

        try:
            import bleach
            from bleach.css_sanitizer import CSSSanitizer

            # CSS properties that the document editor legitimately uses
            allowed_css = [
                'color', 'background-color', 'font-size', 'font-family',
                'font-weight', 'font-style', 'text-decoration', 'text-align',
            ]
            css_sanitizer = CSSSanitizer(allowed_css_properties=allowed_css)

            # Clean HTML with allowed tags, attributes, and CSS
            cleaned = bleach.clean(
                value,
                tags=cls.SAFE_HTML_TAGS,
                attributes=cls.SAFE_HTML_ATTRS,
                css_sanitizer=css_sanitizer,
                strip=True,
                strip_comments=True
            )

            return str(cleaned)
        except ImportError:
            # Fallback to basic HTML escaping if bleach not available
            logger.warning("bleach not installed, falling back to HTML escaping")
            return html.escape(value)

    @classmethod
    def sanitize_string(cls, value: str, allow_html: bool = False) -> str:
        """
        Sanitize a string input.

        Args:
            value: The string to sanitize
            allow_html: If False, escape HTML entities

        Returns:
            Sanitized string
        """
        if not isinstance(value, str):
            return value

        # Strip leading/trailing whitespace
        value = value.strip()

        # Escape HTML if not allowed
        if not allow_html:
            value = html.escape(value)

        # Remove null bytes
        value = value.replace('\x00', '')

        return value

    @classmethod
    def contains_dangerous_content(cls, value: str) -> bool:
        """
        Check if a string contains potentially dangerous content.

        Args:
            value: The string to check

        Returns:
            True if dangerous content is detected
        """
        if not isinstance(value, str):
            return False

        return any(pattern.search(value) for pattern in cls._compiled_patterns)

    @classmethod
    def sanitize_dict(cls, data: dict[str, Any], allow_html_fields: set[str] | None = None) -> dict[str, Any]:
        """
        Recursively sanitize all string values in a dictionary.

        Args:
            data: Dictionary to sanitize
            allow_html_fields: Set of field names that can contain safe HTML (sanitized with bleach)

        Returns:
            Sanitized dictionary
        """
        if allow_html_fields is None:
            allow_html_fields = set()

        sanitized: dict[str, Any] = {}
        for key, value in data.items():
            if isinstance(value, str):
                if key in allow_html_fields:
                    # Allow safe HTML tags using bleach
                    sanitized[key] = cls.sanitize_html(value)
                else:
                    # Escape all HTML
                    sanitized[key] = cls.sanitize_string(value, allow_html=False)
            elif isinstance(value, dict):
                sanitized[key] = cls.sanitize_dict(value, allow_html_fields)
            elif isinstance(value, list):
                sanitized[key] = [
                    cls.sanitize_dict(item, allow_html_fields) if isinstance(item, dict)
                    else cls.sanitize_html(item) if isinstance(item, str) and key in allow_html_fields
                    else cls.sanitize_string(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                sanitized[key] = value

        return sanitized

    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        """
        Sanitize a filename to prevent path traversal attacks.

        Args:
            filename: The filename to sanitize

        Returns:
            Safe filename
        """
        if not filename:
            return "unnamed"

        # Remove path separators
        filename = filename.replace("/", "_").replace("\\", "_")

        # Remove null bytes
        filename = filename.replace('\x00', '')

        # Remove leading dots (hidden files, parent directory traversal)
        filename = filename.lstrip(".")

        # Limit length
        if len(filename) > 255:
            filename = filename[:255]

        return filename or "unnamed"


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
                media_type="application/json"
            )

        return await call_next(request)


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
                    host = request.client.host if request.client else 'unknown'
                    logger.warning(f"Request too large: {size} bytes from {host}")
                    return Response(
                        content=(
                            '{"detail": "Request body too large. Maximum size is 10MB.",'
                            ' "code": "request_too_large"}'
                        ),
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        media_type="application/json"
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
                media_type="application/json"
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
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.trusted_hosts_list
        )
