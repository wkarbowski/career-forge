from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import List
import secrets


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All sensitive values should be set via .env file or environment variables.
    """
    
    app_name: str = "Career Forge API"
    debug: bool = False
    environment: str = "development"
    
    # Database — PostgreSQL required. Set DATABASE_URL in your .env file.
    # Run server/scripts/setup_postgres.sh to create the user and database.
    database_url: str = "postgresql://careerforge:password@localhost:5432/careerforge"
    
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_token_rotate: bool = True
    
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    rate_limit_per_minute: int = 60
    rate_limit_auth_per_minute: int = 10
    
    redis_url: str = ""
    redis_password: str = ""
    rate_limit_backend: str = "memory"
    
    account_lockout_attempts: int = 10
    account_lockout_duration: int = 15
    
    cookie_secure: bool = True
    cookie_samesite: str = "lax"
    cookie_domain: str = ""
    
    enforce_https: bool = False
    trusted_hosts: str = ""

    # Feature boundaries
    
    @field_validator('secret_key')
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """Ensure secret key is set and secure in production."""
        if not v or v == "your-secret-key-generate-with-openssl-rand-hex-32":
            import logging
            logging.warning(
                "⚠️  SECRET_KEY not set! Using auto-generated key. "
                "Set SECRET_KEY in .env for production!"
            )
            return secrets.token_hex(32)
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        if not self.cors_origins:
            return []
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    @property
    def trusted_hosts_list(self) -> List[str]:
        """Parse trusted hosts from comma-separated string."""
        if not self.trusted_hosts:
            return ["*"]  # Allow all if not specified
        return [host.strip() for host in self.trusted_hosts.split(",") if host.strip()]
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

