"""Unit tests for security and auth utilities.

Tests password hashing, JWT token creation/validation, password-reset
tokens, the InputSanitizer, and refresh-token DB lifecycle — all without
going through HTTP endpoints.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
    verify_password_reset_token,
    verify_refresh_token,
)
from app.models import RefreshToken, User
from app.security import InputSanitizer


class TestPasswordHashing:
    """bcrypt helpers: get_password_hash / verify_password."""

    def test_correct_password_verifies(self) -> None:
        hashed = get_password_hash("TestPassword123!")
        assert verify_password("TestPassword123!", hashed) is True

    def test_wrong_password_is_rejected(self) -> None:
        hashed = get_password_hash("TestPassword123!")
        assert verify_password("WrongPassword1!", hashed) is False

    def test_same_password_produces_unique_hashes(self) -> None:
        # bcrypt uses a random salt on every call
        h1 = get_password_hash("TestPassword123!")
        h2 = get_password_hash("TestPassword123!")
        assert h1 != h2


class TestJWTAccessTokens:
    """create_access_token / decode_token round-trips and security checks."""

    def test_valid_token_decodes_to_correct_user_id(self, test_user: User) -> None:
        token = create_access_token({"sub": str(test_user.id)})
        assert decode_token(token) == test_user.id

    def test_tampered_signature_is_rejected(self, test_user: User) -> None:
        token = create_access_token({"sub": str(test_user.id)})
        parts = token.split(".")
        sig = parts[2]
        # Tamper a middle character — all 6 bits are meaningful there.
        # The last base64url char of a 32-byte HMAC encodes only 4 meaningful
        # bits, so A↔B swaps there don't change the decoded bytes.
        mid = len(sig) // 2
        bad_sig = sig[:mid] + ("A" if sig[mid] != "A" else "B") + sig[mid + 1 :]
        bad_token = ".".join([parts[0], parts[1], bad_sig])
        assert decode_token(bad_token) is None

    def test_password_reset_token_not_accepted_as_access_token(self, test_user: User) -> None:
        """A password_reset JWT must be rejected by decode_token (type mismatch)."""
        reset_token = create_password_reset_token(test_user.id)
        assert decode_token(reset_token) is None

    def test_expired_access_token_is_rejected(self, test_user: User) -> None:
        token = create_access_token(
            {"sub": str(test_user.id)},
            expires_delta=timedelta(seconds=-1),
        )
        assert decode_token(token) is None


class TestPasswordResetToken:
    """create_password_reset_token / verify_password_reset_token."""

    def test_valid_token_returns_user_id(self, test_user: User) -> None:
        token = create_password_reset_token(test_user.id)
        assert verify_password_reset_token(token) == test_user.id

    def test_garbage_string_returns_none(self) -> None:
        assert verify_password_reset_token("garbage.token.here") is None

    def test_expired_token_returns_none(self, test_user: User) -> None:
        token = create_password_reset_token(test_user.id, expires_minutes=-1)
        assert verify_password_reset_token(token) is None


class TestInputSanitizer:
    """InputSanitizer static helpers."""

    def test_sanitize_string_escapes_html_tags(self) -> None:
        result = InputSanitizer.sanitize_string("<b>hello</b>")
        assert "<b>" not in result
        assert "hello" in result

    def test_sanitize_string_strips_leading_trailing_whitespace(self) -> None:
        assert InputSanitizer.sanitize_string("  hello  ") == "hello"

    def test_script_tag_flagged_as_dangerous(self) -> None:
        assert InputSanitizer.contains_dangerous_content("<script>alert(1)</script>") is True

    def test_inline_event_handler_flagged_as_dangerous(self) -> None:
        assert InputSanitizer.contains_dangerous_content("onclick=evil()") is True

    def test_javascript_url_flagged_as_dangerous(self) -> None:
        assert InputSanitizer.contains_dangerous_content("javascript:void(0)") is True

    def test_safe_plain_text_not_flagged(self) -> None:
        assert InputSanitizer.contains_dangerous_content("John Doe — Senior Software Engineer") is False


class TestRefreshTokenDB:
    """Refresh-token creation, verification, revocation, and expiry — against the DB."""

    def test_create_stores_hash_not_raw_token(self, test_user: User, db: Session) -> None:
        raw = create_refresh_token(test_user.id, db)
        assert raw  # raw token returned to caller
        stored = db.query(RefreshToken).filter(RefreshToken.user_id == test_user.id).first()
        assert stored is not None
        assert stored.token_hash != raw  # stored value is a hash

    def test_verify_valid_token_returns_user(self, test_user: User, db: Session) -> None:
        raw = create_refresh_token(test_user.id, db)
        user, record = verify_refresh_token(raw, db)
        assert user is not None
        assert user.id == test_user.id
        assert record is not None

    def test_verify_revoked_token_returns_none(self, test_user: User, db: Session) -> None:
        raw = create_refresh_token(test_user.id, db)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).update({"is_revoked": True})
        db.commit()

        user, record = verify_refresh_token(raw, db)
        assert user is None
        assert record is None

    def test_verify_expired_token_returns_none(self, test_user: User, db: Session) -> None:
        raw = create_refresh_token(test_user.id, db)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).update(
            {"expires_at": datetime(2000, 1, 1, tzinfo=UTC)}
        )
        db.commit()

        user, record = verify_refresh_token(raw, db)
        assert user is None
        assert record is None


class TestCleanupExpiredTokens:
    """cleanup_expired_tokens removes expired rows and leaves valid ones alone."""

    def test_cleanup_removes_expired_tokens(self, test_user: User, db: Session) -> None:
        from app.auth import cleanup_expired_tokens

        expired = RefreshToken(
            token_hash="expired-hash-xyz",
            user_id=test_user.id,
            expires_at=datetime(2000, 1, 1, tzinfo=UTC),
        )
        db.add(expired)
        db.commit()

        removed = cleanup_expired_tokens(db)
        assert removed >= 1
        assert db.query(RefreshToken).filter(RefreshToken.token_hash == "expired-hash-xyz").first() is None

    def test_cleanup_preserves_valid_tokens(self, test_user: User, db: Session) -> None:
        from app.auth import cleanup_expired_tokens, create_refresh_token

        create_refresh_token(test_user.id, db)
        before_count = db.query(RefreshToken).filter(RefreshToken.user_id == test_user.id).count()

        cleanup_expired_tokens(db)

        after_count = db.query(RefreshToken).filter(RefreshToken.user_id == test_user.id).count()
        assert after_count == before_count  # valid token must survive


class TestSanitizeHtml:
    """InputSanitizer.sanitize_html preserves safe tags and strips dangerous ones."""

    def test_safe_bold_tag_preserved(self) -> None:
        result = InputSanitizer.sanitize_html("<b>hello</b>")
        assert "hello" in result
        assert "<b>" in result

    def test_script_tag_stripped(self) -> None:
        result = InputSanitizer.sanitize_html("<script>badcode</script>Safe")
        assert "<script>" not in result
        assert "Safe" in result

    def test_inline_event_handler_stripped(self) -> None:
        result = InputSanitizer.sanitize_html('<p onclick="evil()">Text</p>')
        assert "onclick" not in result
        assert "Text" in result

    def test_text_decoration_style_preserved(self) -> None:
        result = InputSanitizer.sanitize_html('<span style="text-decoration: line-through">Text</span>')
        assert "text-decoration: line-through" in result
        assert "Text" in result

    def test_alignment_wrapper_styles_preserved(self) -> None:
        result = InputSanitizer.sanitize_html('<span style="display: block; text-align: right">Text</span>')
        assert "display: block" in result
        assert "text-align: right" in result
        assert "Text" in result

    def test_editor_rich_text_contract_preserved(self) -> None:
        result = InputSanitizer.sanitize_html(
            '<span style="color: #ff0000; background-color: #ffff00; '
            "font-weight: 700; font-style: italic; "
            "text-decoration: underline line-through; text-align: center; "
            'display: block; position: absolute">Text</span>'
            '<ul><li style="text-align: right">One</li></ul>'
            "<ol><li>Two</li></ol>"
            '<a href="https://example.com" target="_blank" '
            'rel="noopener noreferrer" style="color: #0044cc; '
            'text-decoration: underline" onclick="bad()">Project</a>'
            "<s>Strike</s><strike>Legacy</strike><del>Deleted</del>"
        )

        assert "color: #ff0000" in result
        assert "background-color: #ffff00" in result
        assert "font-weight: 700" in result
        assert "font-style: italic" in result
        assert "text-decoration: underline line-through" in result
        assert "text-align: center" in result
        assert "display: block" in result
        assert "position" not in result
        assert '<li style="text-align: right' in result
        assert "<ol><li>Two</li></ol>" in result
        assert 'href="https://example.com"' in result
        assert 'target="_blank"' in result
        assert 'rel="noopener noreferrer"' in result
        assert "color: #0044cc" in result
        assert "onclick" not in result
        assert "<s>Strike</s>" in result
        assert "<strike>Legacy</strike>" in result
        assert "<del>Deleted</del>" in result
