"""Tests for authentication endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User


class TestRegistration:
    """Test user registration."""

    def test_register_new_user(self, client: TestClient, db: Session) -> None:
        """Test successful user registration."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePassword123!",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"

        # Verify user exists in database
        user = db.query(User).filter(User.email == "newuser@example.com").first()
        assert user is not None
        assert user.is_active is True

    def test_register_duplicate_email(
        self, client: TestClient, test_user: User
    ) -> None:
        """Test registration with existing email fails."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "password": "AnotherPassword123!",
            },
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_weak_password(self, client: TestClient) -> None:
        """Test registration with weak password fails."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "weak@example.com",
                "password": "weak",
            },
        )
        assert response.status_code == 400
        assert "password" in response.json()["detail"].lower()

    def test_register_invalid_email(self, client: TestClient) -> None:
        """Test registration with invalid email fails."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": "not-an-email",
                "password": "ValidPassword123!",
            },
        )
        assert response.status_code == 422  # Validation error


class TestLogin:
    """Test user login."""

    def test_login_success(self, client: TestClient, test_user: User) -> None:
        """Test successful login."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPassword123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "test@example.com"

        # Check that refresh token cookie is set
        assert "refresh_token" in response.cookies

    def test_login_wrong_password(self, client: TestClient, test_user: User) -> None:
        """Test login with incorrect password fails."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 401
        assert "invalid credentials" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, client: TestClient) -> None:
        """Test login with non-existent email fails."""
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePassword123!",
            },
        )
        assert response.status_code == 401
        assert "invalid credentials" in response.json()["detail"].lower()

    def test_login_inactive_user(self, client: TestClient, db: Session) -> None:
        """Test login with inactive account fails."""
        # Create inactive user
        from app.security import get_password_hash

        inactive_user = User(
            email="inactive@example.com",
            hashed_password=get_password_hash("TestPassword123!"),
            is_active=False,
        )
        db.add(inactive_user)
        db.commit()

        response = client.post(
            "/api/auth/login",
            json={
                "email": "inactive@example.com",
                "password": "TestPassword123!",
            },
        )
        assert response.status_code == 400
        assert "inactive" in response.json()["detail"].lower()


class TestTokenRefresh:
    """Test token refresh functionality."""

    def test_refresh_token_success(
        self, client: TestClient, test_user: User
    ) -> None:
        """Test successful token refresh."""
        # First login to get refresh token
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPassword123!",
            },
        )
        assert login_response.status_code == 200

        # Use refresh token to get new access token
        refresh_response = client.post("/api/auth/refresh")
        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert "access_token" in data
        assert "token_type" in data

    def test_refresh_without_token(self, client: TestClient) -> None:
        """Test refresh without refresh token fails."""
        response = client.post("/api/auth/refresh")
        assert response.status_code == 401


class TestLogout:
    """Test logout functionality."""

    def test_logout_success(self, client: TestClient, auth_headers: dict) -> None:
        """Test successful logout."""
        response = client.post("/api/auth/logout", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Successfully logged out"

    def test_logout_without_auth(self, client: TestClient) -> None:
        """Test logout without authentication fails."""
        response = client.post("/api/auth/logout")
        assert response.status_code == 401


class TestGetCurrentUser:
    """Test getting current user information."""

    def test_get_me_success(
        self, client: TestClient, auth_headers: dict, test_user: User
    ) -> None:
        """Test getting current user info."""
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["is_active"] is True
        assert "id" in data

    def test_get_me_without_auth(self, client: TestClient) -> None:
        """Test getting current user without authentication fails."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401


class TestPasswordValidation:
    """Test password strength validation."""

    @pytest.mark.parametrize(
        "password,should_pass",
        [
            ("Short1!", False),  # Too short
            ("NoNumbers!", False),  # No numbers
            ("nonumber123", False),  # No uppercase
            ("NOLOWER123", False),  # No lowercase
            ("NoSpecial123", False),  # No special chars
            ("ValidPass123!", True),  # Valid
            ("AnotherGood1@", True),  # Valid
        ],
    )
    def test_password_strength(
        self, client: TestClient, password: str, should_pass: bool
    ) -> None:
        """Test password strength validation."""
        response = client.post(
            "/api/auth/register",
            json={
                "email": f"test{password}@example.com",
                "password": password,
            },
        )
        if should_pass:
            assert response.status_code == 201
        else:
            assert response.status_code == 400
            assert "password" in response.json()["detail"].lower()
