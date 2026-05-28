"""Account lockout backends and factory."""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Any

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


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
        self._failures[identifier] = [t for t in self._failures[identifier] if t > cutoff]

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

    def __init__(
        self, redis_url: str, password: str | None = None, max_attempts: int = 10, lockout_duration: int = 15
    ) -> None:
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
                    self._redis_url, password=self._password, decode_responses=True, socket_timeout=5
                )
            else:
                self._redis = redis.from_url(self._redis_url, decode_responses=True, socket_timeout=5)
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
                self._redis.setex(self._lock_key(identifier), self._lockout_duration, "locked")
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
            lockout_duration=lockout_duration,
        )
        memory_lockout = InMemoryAccountLockout(max_attempts, lockout_duration)
        return FallbackAccountLockout(redis_lockout, memory_lockout)

    logger.info("Using in-memory account lockout")
    return InMemoryAccountLockout(max_attempts, lockout_duration)


account_lockout = create_account_lockout()
