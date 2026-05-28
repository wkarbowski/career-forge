"""Rate limiting backends and factory."""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Any

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
            sorted_keys = sorted(self.requests.keys(), key=lambda k: min(self.requests[k]) if self.requests[k] else 0)
            for key in sorted_keys[: len(self.requests) - self.max_keys]:
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
        self.requests[key] = [req_time for req_time in self.requests[key] if req_time > window_start]

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

        current_requests = [req_time for req_time in self.requests[key] if req_time > window_start]

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
                    socket_timeout=5,
                )
            else:
                self._redis = redis.from_url(
                    self._redis_url, decode_responses=True, socket_connect_timeout=5, socket_timeout=5
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
        redis_limiter = RedisRateLimiter(redis_url=settings.redis_url, password=settings.redis_password or None)

        # Create fallback wrapper
        memory_limiter = InMemoryRateLimiter()
        return FallbackRateLimiter(redis_limiter, memory_limiter)

    logger.info("Using in-memory rate limiter")
    return InMemoryRateLimiter()


rate_limiter = create_rate_limiter()
