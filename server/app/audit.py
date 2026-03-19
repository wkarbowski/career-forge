"""
Audit logging for security events.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Audit logging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This file:
  • AuditEventType / AuditSeverity enums
  • AuditLog SQLAlchemy model  (schema — needed for table creation)
  • AuditLogger service        (write path — called by auth/document routes)
  • get_client_ip / get_user_agent helpers


The Audit events are written on every security-relevant action.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from app.database import Base

logger = logging.getLogger(__name__)


class AuditEventType(str, Enum):
    """Types of security events to audit."""
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    LOGOUT_ALL_DEVICES = "logout_all_devices"
    
    TOKEN_REFRESH = "token_refresh"
    TOKEN_REFRESH_FAILURE = "token_refresh_failure"
    TOKEN_REUSE_DETECTED = "token_reuse_detected"
    TOKEN_REVOKED = "token_revoked"
    
    ACCOUNT_CREATED = "account_created"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"
    PASSWORD_RESET_COMPLETED = "password_reset_completed"
    
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


class AuditSeverity(str, Enum):
    """Severity levels for audit events."""
    INFO = "info"
    WARNING = "warning"
    ALERT = "alert"
    CRITICAL = "critical"


class AuditLog(Base):
    """Database model for audit logs."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    event_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="info")
    
    # Who
    user_id = Column(Integer, nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    
    description = Column(String(500), nullable=False)
    details = Column(Text, nullable=True)
    
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    endpoint = Column(String(255), nullable=True)
    
    success = Column(String(10), nullable=True)
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_audit_user_time', 'user_id', 'timestamp'),
        Index('idx_audit_type_time', 'event_type', 'timestamp'),
        Index('idx_audit_severity_time', 'severity', 'timestamp'),
        Index('idx_audit_ip_time', 'ip_address', 'timestamp'),
    )


class AuditLogger:
    """
    Service for logging security audit events.
    
    Logs to both database (for querying/compliance) and 
    file/stdout (for real-time monitoring/SIEM integration).
    """
    
    # Map event types to default severities
    SEVERITY_MAP = {
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
    
    def __init__(self):
        self.logger = logging.getLogger("audit")
        # Ensure audit logger outputs even in production
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter(
                '%(asctime)s - AUDIT - %(levelname)s - %(message)s'
            ))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def log(
        self,
        db: Session,
        event_type: AuditEventType,
        description: str,
        user_id: Optional[int] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        success: Optional[bool] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: Optional[AuditSeverity] = None,
    ) -> AuditLog:
        """
        Log a security audit event.
        
        Args:
            db: Database session
            event_type: Type of security event
            description: Human-readable description
            user_id: ID of the user involved (if known)
            user_email: Email of the user (for failed logins where ID unknown)
            ip_address: Client IP address
            user_agent: Client user agent string
            endpoint: API endpoint accessed
            success: Whether the action succeeded
            details: Additional JSON-serializable details
            severity: Override default severity
        
        Returns:
            The created AuditLog record
        """
        # Determine severity
        if severity is None:
            severity = self.SEVERITY_MAP.get(event_type, AuditSeverity.INFO)
        
        # Create database record
        audit_log = AuditLog(
            event_type=event_type.value,
            severity=severity.value,
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
        
        # Also log to stdout/file for real-time monitoring
        log_message = self._format_log_message(audit_log, details)
        self._write_to_logger(severity, log_message)
        
        return audit_log
    
    def _format_log_message(
        self, 
        audit_log: AuditLog, 
        details: Optional[Dict[str, Any]]
    ) -> str:
        parts = [
            f"[{audit_log.event_type.upper()}]",
            f"user_id={audit_log.user_id or 'anonymous'}",
            f"ip={audit_log.ip_address or 'unknown'}",
            f"- {audit_log.description}",
        ]
        
        if audit_log.success is not None:
            parts.insert(3, f"success={audit_log.success}")
        
        if details:
            safe_details = {k: v for k, v in details.items() 
                          if k not in ('password', 'token', 'secret')}
            if safe_details:
                parts.append(f"details={json.dumps(safe_details)}")
        
        return " ".join(parts)
    
    def _write_to_logger(self, severity: AuditSeverity, message: str):
        """Write to Python logger with appropriate level."""
        if severity == AuditSeverity.CRITICAL:
            self.logger.critical(message)
        elif severity == AuditSeverity.ALERT:
            self.logger.warning(message)  # Use warning for visibility
        elif severity == AuditSeverity.WARNING:
            self.logger.warning(message)
        else:
            self.logger.info(message)
    
    # Convenience methods for common events
    
    def log_login_success(
        self, db: Session, user_id: int, user_email: str,
        ip_address: str, user_agent: str
    ):
        """Log successful login."""
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
        self, db: Session, email: str, ip_address: str, 
        user_agent: str, reason: str, attempts_remaining: Optional[int] = None
    ):
        """Log failed login attempt."""
        details: Dict[str, Any] = {"reason": reason}
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
        self, db: Session, email: str, ip_address: str,
        user_agent: str, failed_attempts: int
    ):
        """Log account lockout."""
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
        self, db: Session, user_id: int, ip_address: str,
        user_agent: str
    ):
        """Log refresh token reuse - CRITICAL security event."""
        return self.log(
            db=db,
            event_type=AuditEventType.TOKEN_REUSE_DETECTED,
            description="SECURITY ALERT: Refresh token reuse detected - potential token theft",
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint="/api/auth/refresh",
            success=False,
            severity=AuditSeverity.CRITICAL,
        )
    
    def log_token_refresh(
        self, db: Session, user_id: int, ip_address: str,
        user_agent: str
    ):
        """Log successful token refresh."""
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
        self, db: Session, user_id: Optional[int], ip_address: str,
        user_agent: str, all_devices: bool = False
    ):
        """Log user logout."""
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
        self, db: Session, user_id: int, user_email: str,
        ip_address: str, user_agent: str
    ):
        """Log new account registration."""
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
        self, db: Session, ip_address: str, endpoint: str,
        user_id: Optional[int] = None
    ):
        """Log rate limit exceeded."""
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
        self, db: Session, ip_address: str, endpoint: str,
        user_agent: str, reason: str
    ):
        """Log unauthorized access attempt."""
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


def get_client_ip(request) -> str:
    """
    Extract real client IP from request, handling proxies.
    
    Checks X-Forwarded-For header for proxied requests,
    falls back to direct client IP.
    """
    # Check for proxy headers (in order of trust)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
        # The first one is the original client
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Direct connection
    if request.client:
        return request.client.host
    
    return "unknown"


def get_user_agent(request) -> str:
    return request.headers.get("User-Agent", "unknown")[:500]
