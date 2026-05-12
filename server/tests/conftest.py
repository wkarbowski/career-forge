"""Pytest configuration and fixtures for Career Forge tests.

Note: These tests are designed to work with PostgreSQL. For SQLite compatibility,
the JSONB column types need to be converted to JSON. See tests/README.md for setup instructions.
"""

from __future__ import annotations

import os
from typing import Iterator

# Set test environment variables BEFORE importing app modules
os.environ.setdefault(
    "SECRET_KEY", "test-secret-key-minimum-32-characters-long-for-testing"
)
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DEBUG", "true")
# Use PostgreSQL for tests (recommended) or override with SQLite if needed
os.environ.setdefault(
    "DATABASE_URL", "postgresql://testuser:testpass@localhost:5433/testdb"
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.auth import get_password_hash

# Create test engine - use in-memory SQLite if DATABASE_URL is not set for PostgreSQL
TEST_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///:memory:")

if "sqlite" in TEST_DATABASE_URL:
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(TEST_DATABASE_URL)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db() -> Iterator[Session]:
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db: Session) -> Iterator[TestClient]:
    """Create a test client with database dependency override."""

    def override_get_db() -> Iterator[Session]:
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db: Session) -> User:
    """Create a test user in the database."""
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("TestPassword123!"),
        is_active=True,
        is_admin=False,
        language="en",
        theme="light",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def admin_user(db: Session) -> User:
    """Create an admin user in the database."""
    user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("AdminPassword123!"),
        is_active=True,
        is_admin=True,
        language="en",
        theme="light",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(client: TestClient, test_user: User) -> dict[str, str]:
    """Get authentication headers for a test user."""
    response = client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "TestPassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture(scope="function")
def admin_headers(client: TestClient, admin_user: User) -> dict[str, str]:
    """Get authentication headers for an admin user."""
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "AdminPassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}
