"""Input sanitization helpers."""

from __future__ import annotations

import html
import logging
import re
from typing import Any, ClassVar

logger = logging.getLogger(__name__)


class InputSanitizer:
    """
    Utility class for sanitizing user inputs to prevent XSS and injection attacks.
    """

    # Patterns that might indicate malicious input
    DANGEROUS_PATTERNS: ClassVar[list[str]] = [
        r"<script[^>]*>",  # Script tags
        r"javascript:",  # JavaScript URLs
        r"on\w+\s*=",  # Event handlers (onclick, onerror, etc.)
        r"data:text/html",  # Data URLs with HTML
        r"vbscript:",  # VBScript URLs
        r"expression\s*\(",  # CSS expressions
    ]

    # Compile patterns for efficiency
    _compiled_patterns: ClassVar[list[re.Pattern[str]]] = [re.compile(p, re.IGNORECASE) for p in DANGEROUS_PATTERNS]

    # Safe HTML tags for document rich text fields
    SAFE_HTML_TAGS: ClassVar[list[str]] = [
        "b",
        "i",
        "u",
        "strong",
        "em",
        "br",
        "p",
        "ul",
        "ol",
        "li",
        "a",
        "span",
        "div",
    ]
    SAFE_HTML_ATTRS: ClassVar[dict[str, list[str]]] = {
        "a": ["href", "title"],
        "span": ["class", "style"],
        "p": ["style"],
        "div": ["style"],
        "li": ["style"],
        "ul": ["style"],
        "ol": ["style"],
        "b": ["style"],
        "i": ["style"],
        "u": ["style"],
        "strong": ["style"],
        "em": ["style"],
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
                "color",
                "background-color",
                "font-size",
                "font-family",
                "font-weight",
                "font-style",
                "text-decoration",
                "text-align",
            ]
            css_sanitizer = CSSSanitizer(allowed_css_properties=allowed_css)

            # Clean HTML with allowed tags, attributes, and CSS
            cleaned = bleach.clean(
                value,
                tags=cls.SAFE_HTML_TAGS,
                attributes=cls.SAFE_HTML_ATTRS,
                css_sanitizer=css_sanitizer,
                strip=True,
                strip_comments=True,
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
        value = value.replace("\x00", "")

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
                    cls.sanitize_dict(item, allow_html_fields)
                    if isinstance(item, dict)
                    else cls.sanitize_html(item)
                    if isinstance(item, str) and key in allow_html_fields
                    else cls.sanitize_string(item)
                    if isinstance(item, str)
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
        filename = filename.replace("\x00", "")

        # Remove leading dots (hidden files, parent directory traversal)
        filename = filename.lstrip(".")

        # Limit length
        if len(filename) > 255:
            filename = filename[:255]

        return filename or "unnamed"
