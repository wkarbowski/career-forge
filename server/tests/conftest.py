"""Pytest configuration and fixtures for Career Forge tests.

Note: These tests are designed to work with PostgreSQL. For SQLite compatibility,
the JSONB column types need to be converted to JSON. See tests/README.md for setup instructions.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

# Set test environment variables BEFORE importing app modules
os.environ["PYTEST_CURRENT_TEST"] = "1"  # prevent main.py create_all at import time
os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-characters-long-for-testing")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("RATE_LIMIT_AUTH_PER_MINUTE", "1000")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "10000")
os.environ.setdefault("ACCOUNT_LOCKOUT_ATTEMPTS", "1000")
# Use PostgreSQL for tests (recommended) or override with SQLite if needed
os.environ.setdefault("DATABASE_URL", "postgresql://testuser:testpass@localhost:5433/testdb")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_password_hash
from app.database import Base, get_db
from app.main import app
from app.models import Document, User

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
        username="testuser",
        hashed_password=get_password_hash("TestPassword123!"),
        is_active=True,
        language="en",
        theme="light",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def other_user(db: Session) -> User:
    """Create a second user in the database."""
    user = User(
        email="other@example.com",
        username="otheruser",
        hashed_password=get_password_hash("OtherPassword123!"),
        is_active=True,
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
        "/api/auth/login/json",
        json={"email": "test@example.com", "password": "TestPassword123!"},
    )
    assert response.status_code == 200
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture(scope="function")
def test_document(db: Session, test_user: User) -> Document:
    """Create a single resume document owned by test_user."""
    doc = Document(
        title="Test Resume",
        document_type="resume",
        data={"name": "Test User", "position": "Developer"},
        owner_id=test_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
