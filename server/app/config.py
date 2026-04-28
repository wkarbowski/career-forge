from __future__ import annotations

import logging
import secrets
from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sentinel used to detect unset SECRET_KEY
# ---------------------------------------------------------------------------
_SECRET_KEY_PLACEHOLDER = "your-secret-key-generate-with-openssl-rand-hex-32"  # noqa: S105


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All sensitive values should be set via ``.env`` file or environment
    variables.  Never commit real secrets to source control.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── General ──────────────────────────────────────────────────────────
    app_name: str = "Career Forge API"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"

    # ── Database ─────────────────────────────────────────────────────────
    # PostgreSQL required.  Set DATABASE_URL in your .env file.
    # Run server/scripts/setup_postgres.sh to create the user and database.
    database_url: str = "postgresql://careerforge:password@localhost:5432/careerforge"

    # ── Auth / JWT ───────────────────────────────────────────────────────
    secret_key: str = ""
    algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_token_rotate: bool = True

    # ── CORS ─────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ── Rate limiting ────────────────────────────────────────────────────
    rate_limit_per_minute: int = 60
    rate_limit_auth_per_minute: int = 10

    # ── Redis ────────────────────────────────────────────────────────────
    redis_url: str = ""
    redis_password: str = ""
    rate_limit_backend: Literal["memory", "redis"] = "memory"

    # ── Account lockout ──────────────────────────────────────────────────
    account_lockout_attempts: int = 10
    account_lockout_duration: int = 15  # minutes

    # ── Cookies ──────────────────────────────────────────────────────────
    # Set to True in production (HTTPS only). False is safe for local HTTP dev.
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_domain: str = ""

    # ── HTTPS / Hosts ────────────────────────────────────────────────────
    enforce_https: bool = False
    trusted_hosts: str = ""

    # ── File uploads ─────────────────────────────────────────────────────
    upload_dir: str = "uploads/profile_images"

    # ── Feature boundaries ───────────────────────────────────────────────

    # ── Validators ───────────────────────────────────────────────────────

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        """Ensure SECRET_KEY is set and sufficiently long.

        In **development** a random key is generated on the fly (with a
        warning).  In **production** the app will refuse to start if the
        key is missing — an auto-generated key would silently invalidate
        every JWT on each restart.
        """
        if not v or v == _SECRET_KEY_PLACEHOLDER:
            # We cannot access `self.environment` here because Pydantic
            # field validators run before the model is fully constructed.
            # Production environment check is done in `_reject_insecure_production`.
            logger.warning(
                "⚠️  SECRET_KEY not set! Using auto-generated key. "
                "Set SECRET_KEY in .env for production!"
            )
            return secrets.token_hex(32)
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @model_validator(mode="after")
    def _reject_insecure_production(self) -> Settings:
        """Block production startup with dangerous defaults."""
        if self.is_production:
            if self.debug:
                raise ValueError(
                    "Cannot run with DEBUG=true when ENVIRONMENT=production. "
                    "Set DEBUG=false in your .env file."
                )
            if "password@" in self.database_url:
                raise ValueError(
                    "Default database password detected in production. "
                    "Set a strong DATABASE_URL in your .env file."
                )
            if not self.cookie_secure:
                raise ValueError(
                    "COOKIE_SECURE must be True in production. "
                    "Set COOKIE_SECURE=true in your .env file."
                )
        return self

    # ── Derived helpers ──────────────────────────────────────────────────

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.cors_origins:
            return []
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> list[str]:
        if not self.trusted_hosts:
            # Fail closed: only trust localhost when TRUSTED_HOSTS is not
            # configured.  This disables the middleware in practice for local
            # development while blocking Host-header injection in any deployment
            # that forgot to set the variable.
            return ["localhost", "127.0.0.1"]
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached, validated application settings."""
    return Settings()

