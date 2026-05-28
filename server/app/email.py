from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import TYPE_CHECKING
from urllib.parse import urlencode

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger(__name__)


def build_password_reset_url(token: str, settings: Settings) -> str:
    """Build the frontend password-reset URL for an issued reset token."""
    base_url = settings.app_base_url.rstrip("/")
    return f"{base_url}/reset-password?{urlencode({'token': token})}"


def send_password_reset_email(
    *,
    recipient: str,
    reset_url: str,
    settings: Settings,
) -> bool:
    """Send a password reset email via SMTP.

    Returns ``False`` when SMTP is not configured. SMTP errors are allowed to
    propagate so callers can log them without changing the public response.
    """
    if not settings.password_reset_email_enabled:
        logger.info("Password reset email requested, but SMTP is not configured")
        return False

    message = EmailMessage()
    message["Subject"] = "Reset your Career Forge password"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        "\n".join(
            [
                "We received a request to reset your Career Forge password.",
                "",
                "Open this link to choose a new password:",
                reset_url,
                "",
                "This link expires in 30 minutes. If you did not request this, you can ignore this email.",
            ]
        )
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)

    return True
