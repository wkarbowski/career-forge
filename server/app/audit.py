"""Audit logging for security events.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Audit logging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This file:
  • AuditEventType / AuditSeverity enums
  • AuditLog SQLAlchemy model  (schema — needed for table creation)
  • AuditLogger service        (write path — called by auth/document routes)
  • get_client_ip / get_user_agent helpers

Query endpoints (available via optional extended modules):
  • GET /api/admin/audit/logs         — paginated query API
  • GET /api/admin/audit/stats        — aggregate statistics
  • GET /api/admin/audit/recent-alerts
  • GET /api/admin/audit/user/{id}
  • GET /api/admin/audit/ip/{addr}

The Audit events are written on every security-relevant action.
Query endpoints are available via optional extended modules.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, ClassVar

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from app.database import Base

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class AuditEventType(StrEnum):
    """Types of security events to audit."""

    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    LOGOUT_ALL_DEVICES = "logout_all_devices"

    TOKEN_REFRESH = "token_refresh"  # noqa: S105
    TOKEN_REFRESH_FAILURE = "token_refresh_failure"  # noqa: S105
    TOKEN_REUSE_DETECTED = "token_reuse_detected"  # noqa: S105
    TOKEN_REVOKED = "token_revoked"  # noqa: S105

    ACCOUNT_CREATED = "account_created"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    PASSWORD_CHANGED = "password_changed"  # noqa: S105
    PASSWORD_RESET_REQUESTED = "password_reset_requested"  # noqa: S105
    PASSWORD_RESET_COMPLETED = "password_reset_completed"  # noqa: S105

    UNAUTHORIZED_ACCESS = "unauthorized_access"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"

    DOCUMENT_CREATED = "document_created"
    DOCUMENT_DELETED = "document_deleted"
    DOCUMENT_EXPORTED = "document_exported"
    DATA_EXPORTED = "data_exported"

    USER_DEACTIVATED = "user_deactivated"
    USER_REACTIVATED = "user_reactivated"
    SETTINGS_CHANGED = "settings_changed"


class AuditSeverity(StrEnum):
    """Severity levels for audit events."""

    INFO = "info"
    WARNING = "warning"
    ALERT = "alert"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# ORM model
# ---------------------------------------------------------------------------


class AuditLog(Base):
    """Database model for audit logs."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")

    # Who
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    endpoint: Mapped[str | None] = mapped_column(String(255), nullable=True)

    success: Mapped[str | None] = mapped_column(String(10), nullable=True)

    __table_args__ = (
        Index("idx_audit_user_time", "user_id", "timestamp"),
        Index("idx_audit_type_time", "event_type", "timestamp"),
        Index("idx_audit_severity_time", "severity", "timestamp"),
        Index("idx_audit_ip_time", "ip_address", "timestamp"),
    )


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class AuditLogger:
    """Service for logging security audit events.

    Logs to both database (for querying/compliance) and
    stdout (for real-time monitoring / SIEM integration).
    """

    SEVERITY_MAP: ClassVar[dict[AuditEventType, AuditSeverity]] = {
        AuditEventType.LOGIN_SUCCESS: AuditSeverity.INFO,
        AuditEventType.LOGIN_FAILURE: AuditSeverity.WARNING,
        AuditEventType.LOGOUT: AuditSeverity.INFO,
        AuditEventType.LOGOUT_ALL_DEVICES: AuditSeverity.INFO,
        AuditEventType.TOKEN_REFRESH: AuditSeverity.INFO,
        AuditEventType.TOKEN_REFRESH_FAILURE: AuditSeverity.WARNING,
        AuditEventType.TOKEN_REUSE_DETECTED: AuditSeverity.CRITICAL,
        AuditEventType.TOKEN_REVOKED: AuditSeverity.INFO,
        AuditEventType.ACCOUNT_CREATED: AuditSeverity.INFO,
        AuditEventType.ACCOUNT_LOCKED: AuditSeverity.ALERT,
        AuditEventType.ACCOUNT_UNLOCKED: AuditSeverity.INFO,
        AuditEventType.PASSWORD_CHANGED: AuditSeverity.INFO,
        AuditEventType.PASSWORD_RESET_REQUESTED: AuditSeverity.WARNING,
        AuditEventType.PASSWORD_RESET_COMPLETED: AuditSeverity.INFO,
        AuditEventType.UNAUTHORIZED_ACCESS: AuditSeverity.ALERT,
        AuditEventType.RATE_LIMIT_EXCEEDED: AuditSeverity.WARNING,
        AuditEventType.SUSPICIOUS_ACTIVITY: AuditSeverity.ALERT,
        AuditEventType.DOCUMENT_CREATED: AuditSeverity.INFO,
        AuditEventType.DOCUMENT_DELETED: AuditSeverity.INFO,
        AuditEventType.DOCUMENT_EXPORTED: AuditSeverity.INFO,
        AuditEventType.DATA_EXPORTED: AuditSeverity.INFO,
        AuditEventType.USER_DEACTIVATED: AuditSeverity.WARNING,
        AuditEventType.USER_REACTIVATED: AuditSeverity.INFO,
        AuditEventType.SETTINGS_CHANGED: AuditSeverity.INFO,
    }

    def __init__(self) -> None:
        self.logger = logging.getLogger("audit")
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter("%(asctime)s - AUDIT - %(levelname)s - %(message)s"))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    # ── Core log method ──────────────────────────────────────────────────

    def log(
        self,
        db: Session,
        event_type: AuditEventType,
        description: str,
        *,
        user_id: int | None = None,
        user_email: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        endpoint: str | None = None,
        success: bool | None = None,
        details: dict[str, Any] | None = None,
        severity: AuditSeverity | None = None,
    ) -> AuditLog:
        """Log a security audit event to DB and stdout."""
        resolved_severity = severity or self.SEVERITY_MAP.get(event_type, AuditSeverity.INFO)

        audit_log = AuditLog(
            event_type=event_type.value,
            severity=resolved_severity.value,
            description=description,
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
            endpoint=endpoint,
            success=str(success).lower() if success is not None else None,
            details=json.dumps(details) if details else None,
        )
        db.add(audit_log)
        db.commit()

        log_message = self._format_log_message(audit_log, details)
        self._write_to_logger(resolved_severity, log_message)

        return audit_log

    # ── Formatting ───────────────────────────────────────────────────────

    def _format_log_message(
        self,
        audit_log: AuditLog,
        details: dict[str, Any] | None,
    ) -> str:
        parts: list[str] = [
            f"[{audit_log.event_type.upper()}]",
            f"user_id={audit_log.user_id or 'anonymous'}",
            f"ip={audit_log.ip_address or 'unknown'}",
        ]
        if audit_log.success is not None:
            parts.append(f"success={audit_log.success}")
        parts.append(f"- {audit_log.description}")

        if details:
            safe_details = {k: v for k, v in details.items() if k not in ("password", "token", "secret")}
            if safe_details:
                parts.append(f"details={json.dumps(safe_details)}")

        return " ".join(parts)

    def _write_to_logger(self, severity: AuditSeverity, message: str) -> None:
        if severity == AuditSeverity.CRITICAL:
            self.logger.critical(message)
        elif severity in (AuditSeverity.ALERT, AuditSeverity.WARNING):
            self.logger.warning(message)
        else:
            self.logger.info(message)

    # ── Convenience methods ──────────────────────────────────────────────

    def log_login_success(
        self,
        db: Session,
        user_id: int,
        user_email: str,
        ip_address: str,
        user_agent: str,
    ) -> AuditLog:
        return self.log(
            db=db,
            event_type=AuditEventType.LOGIN_SUCCESS,
            description="User logged in successfully",
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/login",
            success=True,
        )

    def log_login_failure(
        self,
        db: Session,
        email: str,
        ip_address: str,
        user_agent: str,
        reason: str,
        attempts_remaining: int | None = None,
    ) -> AuditLog:
        details: dict[str, Any] = {"reason": reason}
        if attempts_remaining is not None:
            details["attempts_remaining"] = attempts_remaining
        return self.log(
            db=db,
            event_type=AuditEventType.LOGIN_FAILURE,
            description=f"Login failed for {email}: {reason}",
            user_email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/login",
            success=False,
            details=details,
        )

    def log_account_locked(
        self,
        db: Session,
        email: str,
        ip_address: str,
        user_agent: str,
        failed_attempts: int,
    ) -> AuditLog:
        return self.log(
            db=db,
            event_type=AuditEventType.ACCOUNT_LOCKED,
            description=f"Account locked after {failed_attempts} failed attempts",
            user_email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            success=False,
            details={"failed_attempts": failed_attempts},
            severity=AuditSeverity.ALERT,
        )

    def log_token_reuse(
        self,
        db: Session,
        user_id: int,
        ip_address: str,
        user_agent: str,
    ) -> AuditLog:
        return self.log(
            db=db,
            event_type=AuditEventType.TOKEN_REUSE_DETECTED,
            description="SECURITY ALERT: Refresh token reuse detected — potential token theft",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/refresh",
            success=False,
            severity=AuditSeverity.CRITICAL,
        )

    def log_token_refresh(
        self,
        db: Session,
        user_id: int,
        ip_address: str,
        user_agent: str,
    ) -> AuditLog:
        return self.log(
            db=db,
            event_type=AuditEventType.TOKEN_REFRESH,
            description="Access token refreshed",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/refresh",
            success=True,
        )

    def log_logout(
        self,
        db: Session,
        user_id: int | None,
        ip_address: str,
        user_agent: str,
        all_devices: bool = False,
    ) -> AuditLog:
        event_type = AuditEventType.LOGOUT_ALL_DEVICES if all_devices else AuditEventType.LOGOUT
        description = "User logged out from all devices" if all_devices else "User logged out"
        return self.log(
            db=db,
            event_type=event_type,
            description=description,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/logout",
            success=True,
        )

    def log_registration(
        self,
        db: Session,
        user_id: int,
        user_email: str,
        ip_address: str,
        user_agent: str,
    ) -> AuditLog:
        return self.log(
            db=db,
            event_type=AuditEventType.ACCOUNT_CREATED,
            description="New account registered",
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/register",
            success=True,
        )

    def log_rate_limit(
        self,
        db: Session,
        ip_address: str,
        endpoint: str,
        user_id: int | None = None,
    ) -> AuditLog:
        return self.log(
            db=db,
            event_type=AuditEventType.RATE_LIMIT_EXCEEDED,
            description=f"Rate limit exceeded for endpoint {endpoint}",
            user_id=user_id,
            ip_address=ip_address,
            endpoint=endpoint,
            success=False,
        )

    def log_unauthorized_access(
        self,
        db: Session,
        ip_address: str,
        endpoint: str,
        user_agent: str,
        reason: str,
    ) -> AuditLog:
        return self.log(
            db=db,
            event_type=AuditEventType.UNAUTHORIZED_ACCESS,
            description=f"Unauthorized access attempt: {reason}",
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            success=False,
            details={"reason": reason},
        )


# Global audit logger instance
audit_logger = AuditLogger()


# ---------------------------------------------------------------------------
# Request helpers
# ---------------------------------------------------------------------------


def get_client_ip(request: Any) -> str:
    """Extract real client IP from *request*, respecting proxy headers."""
    forwarded_for: str | None = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip: str | None = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    if request.client:
        return str(request.client.host)

    return "unknown"


def get_user_agent(request: Any) -> str:
    """Return the User-Agent header, truncated to 500 chars."""
    return str(request.headers.get("User-Agent", "unknown"))[:500]
