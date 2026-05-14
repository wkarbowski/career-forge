"""Extended authentication tests.

Covers: change-password, forgot/reset-password, logout/all,
account deletion (GDPR), preferences, username collision,
and refresh-token rotation / reuse-detection.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import RefreshToken, User


class TestChangePassword:
    """Tests for POST /api/auth/change-password."""

    def test_change_password_success(self, client: TestClient, auth_headers: dict, test_user: User) -> None:
        response = client.post(
            "/api/auth/change-password",
            headers=auth_headers,
            json={"current_password": "TestPassword123!", "new_password": "NewPassword456@"},
        )
        assert response.status_code == 200
        assert "changed" in response.json()["message"].lower()

        # New password must work for a fresh login
        login = client.post(
            "/api/auth/login/json",
            json={"email": "test@example.com", "password": "NewPassword456@"},
        )
        assert login.status_code == 200

    def test_change_password_wrong_current_returns_400(self, client: TestClient, auth_headers: dict) -> None:
        response = client.post(
            "/api/auth/change-password",
            headers=auth_headers,
            json={"current_password": "WrongPassword1!", "new_password": "NewPassword456@"},
        )
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()

    def test_change_password_unauthenticated_returns_401(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/change-password",
            json={"current_password": "TestPassword123!", "new_password": "NewPassword456@"},
        )
        assert response.status_code == 401

    def test_change_password_weak_new_password_returns_422(self, client: TestClient, auth_headers: dict) -> None:
        response = client.post(
            "/api/auth/change-password",
            headers=auth_headers,
            json={"current_password": "TestPassword123!", "new_password": "weak"},
        )
        assert response.status_code == 422


class TestForgotPassword:
    """Tests for POST /api/auth/forgot-password."""

    def test_forgot_password_existing_email_returns_token(self, client: TestClient, test_user: User) -> None:
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "reset_token" in data
        assert data["reset_token"] is not None

    def test_forgot_password_nonexistent_email_returns_same_response(self, client: TestClient) -> None:
        """Anti-enumeration: same 200 response even if email doesn't exist."""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "nobody@nowhere.example"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # No token for unknown email
        assert data.get("reset_token") is None

    def test_forgot_password_invalid_email_returns_422(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422


class TestResetPassword:
    """Tests for POST /api/auth/reset-password."""

    def test_reset_password_with_valid_token_succeeds(self, client: TestClient, test_user: User) -> None:
        r = client.post(
            "/api/auth/forgot-password",
            json={"email": "test@example.com"},
        )
        assert r.status_code == 200
        reset_token = r.json().get("reset_token")
        assert reset_token is not None

        response = client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "new_password": "ResetPassword789#"},
        )
        assert response.status_code == 200
        assert "reset" in response.json()["message"].lower()

        # New password must work for a fresh login
        login = client.post(
            "/api/auth/login/json",
            json={"email": "test@example.com", "password": "ResetPassword789#"},
        )
        assert login.status_code == 200

    def test_reset_password_invalid_token_returns_400(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/reset-password",
            json={"token": "invalid.garbage.token", "new_password": "ResetPassword789#"},
        )
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()


class TestLogoutAllDevices:
    """Tests for POST /api/auth/logout/all."""

    def test_logout_all_devices_revokes_all_tokens(
        self, client: TestClient, auth_headers: dict, test_user: User, db: Session
    ) -> None:
        # Create a second session
        client.post(
            "/api/auth/login/json",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )

        response = client.post("/api/auth/logout/all", headers=auth_headers, json={})
        assert response.status_code == 200
        data = response.json()
        assert "sessions_revoked" in data
        assert data["sessions_revoked"] >= 1

        # All tokens for this user must be revoked in the DB
        active_tokens = (
            db.query(RefreshToken).filter(RefreshToken.user_id == test_user.id, ~RefreshToken.is_revoked).count()
        )
        assert active_tokens == 0

    def test_logout_all_devices_unauthenticated_returns_401(self, client: TestClient) -> None:
        response = client.post("/api/auth/logout/all", json={})
        assert response.status_code == 401


class TestDeleteAccount:
    """Tests for DELETE /api/auth/me (GDPR Art. 17)."""

    def test_delete_account_unauthenticated_returns_401(self, client: TestClient) -> None:
        response = client.delete("/api/auth/me")
        assert response.status_code == 401

    def test_delete_account_removes_user(
        self, client: TestClient, auth_headers: dict, test_user: User, db: Session
    ) -> None:
        user_id = test_user.id
        response = client.delete("/api/auth/me", headers=auth_headers)
        assert response.status_code == 204

        user = db.query(User).filter(User.id == user_id).first()
        assert user is None

    def test_delete_account_cascades_documents(
        self, client: TestClient, auth_headers: dict, test_user: User, db: Session
    ) -> None:
        from app.models import Document

        doc = Document(
            title="Should Be Deleted",
            document_type="resume",
            data={"name": "Test"},
            owner_id=test_user.id,
        )
        db.add(doc)
        db.commit()

        user_id = test_user.id
        response = client.delete("/api/auth/me", headers=auth_headers)
        assert response.status_code == 204

        remaining = db.query(Document).filter(Document.owner_id == user_id).count()
        assert remaining == 0


class TestUserPreferences:
    """Tests for PATCH /api/auth/preferences."""

    def test_update_theme_to_dark(self, client: TestClient, auth_headers: dict) -> None:
        response = client.patch(
            "/api/auth/preferences",
            headers=auth_headers,
            json={"theme": "dark"},
        )
        assert response.status_code == 200
        assert response.json()["theme"] == "dark"

    def test_update_theme_to_light(self, client: TestClient, auth_headers: dict) -> None:
        response = client.patch(
            "/api/auth/preferences",
            headers=auth_headers,
            json={"theme": "light"},
        )
        assert response.status_code == 200
        assert response.json()["theme"] == "light"

    def test_update_language(self, client: TestClient, auth_headers: dict) -> None:
        response = client.patch(
            "/api/auth/preferences",
            headers=auth_headers,
            json={"language": "pl"},
        )
        assert response.status_code == 200
        assert response.json()["language"] == "pl"

    def test_update_invalid_theme_returns_422(self, client: TestClient, auth_headers: dict) -> None:
        response = client.patch(
            "/api/auth/preferences",
            headers=auth_headers,
            json={"theme": "rainbow"},
        )
        assert response.status_code == 422

    def test_update_preferences_unauthenticated_returns_401(self, client: TestClient) -> None:
        response = client.patch("/api/auth/preferences", json={"theme": "dark"})
        assert response.status_code == 401


class TestUsernameCollision:
    """Duplicate username registration must be rejected."""

    def test_register_duplicate_username_returns_400(self, client: TestClient, test_user: User) -> None:
        response = client.post(
            "/api/auth/register",
            json={
                "email": "different@example.com",
                "username": "testuser",  # same as test_user
                "password": "ValidPass123!",
            },
        )
        assert response.status_code == 400
        detail = response.json()["detail"].lower()
        assert "username" in detail and "taken" in detail


class TestRefreshTokenRotation:
    """Token rotation and theft-detection (reuse) tests."""

    def test_rotation_issues_new_access_token(self, client: TestClient, test_user: User) -> None:
        login_r = client.post(
            "/api/auth/login/json",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )
        assert login_r.status_code == 200

        refresh_r = client.post("/api/auth/refresh", json={})
        assert refresh_r.status_code == 200
        assert "access_token" in refresh_r.json()

    def test_reuse_detection_revokes_all_tokens(self, client: TestClient, test_user: User, db: Session) -> None:
        """Presenting a consumed refresh token triggers theft detection."""
        login_r = client.post(
            "/api/auth/login/json",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )
        assert login_r.status_code == 200
        old_token = login_r.cookies.get("refresh_token")
        assert old_token is not None

        # First refresh — legitimate; marks old_token as used
        r1 = client.post("/api/auth/refresh", json={})
        assert r1.status_code == 200

        # Clear cookie jar so the body token is used on the next call
        client.cookies.clear()

        # Reuse the now-consumed token — theft detection must fire
        r2 = client.post("/api/auth/refresh", json={"refresh_token": old_token})
        assert r2.status_code == 401

        # Every refresh token for this user must be revoked
        active = db.query(RefreshToken).filter(RefreshToken.user_id == test_user.id, ~RefreshToken.is_revoked).count()
        assert active == 0


class TestOAuth2FormLogin:
    """Tests for POST /api/auth/login (OAuth2 form-data variant)."""

    def test_form_login_success(self, client: TestClient, test_user: User) -> None:
        response = client.post(
            "/api/auth/login",
            data={"username": "test@example.com", "password": "TestPassword123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "refresh_token" in response.cookies

    def test_form_login_wrong_password(self, client: TestClient, test_user: User) -> None:
        response = client.post(
            "/api/auth/login",
            data={"username": "test@example.com", "password": "WrongPassword1!"},
        )
        assert response.status_code == 401

    def test_form_login_nonexistent_user(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/login",
            data={"username": "nobody@nowhere.example", "password": "SomePass1!"},
        )
        assert response.status_code == 401


class TestRefreshWithBodyToken:
    """Refresh using a token in the request body (cookie-less fallback)."""

    def test_refresh_with_body_token_succeeds(self, client: TestClient, test_user: User) -> None:
        login_r = client.post(
            "/api/auth/login/json",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )
        assert login_r.status_code == 200
        raw_token = login_r.cookies.get("refresh_token")
        assert raw_token is not None

        # Clear cookies so the server cannot use the cookie
        client.cookies.clear()

        response = client.post("/api/auth/refresh", json={"refresh_token": raw_token})
        assert response.status_code == 200
        assert "access_token" in response.json()


class TestForgotPasswordInactiveAccount:
    """forgot-password on an inactive account returns the same opaque 200."""

    def test_inactive_account_returns_opaque_response(self, client: TestClient, db: Session) -> None:
        from app.auth import get_password_hash

        inactive = User(
            email="inactive2@example.com",
            username="inactive2user",
            hashed_password=get_password_hash("TestPassword123!"),
            is_active=False,
        )
        db.add(inactive)
        db.commit()

        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "inactive2@example.com"},
        )
        assert response.status_code == 200
        # Must behave identically to unknown email (anti-enumeration)
        assert response.json().get("reset_token") is None
