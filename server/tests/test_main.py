"""Tests for root/infrastructure endpoints and the public shared-document endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Document, User


class TestRootEndpoints:
    """Tests for GET / and GET /api/health."""

    def test_root_returns_service_info(self, client: TestClient) -> None:
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data

    def test_health_check_returns_healthy(self, client: TestClient) -> None:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "environment" in data


class TestSharedDocument:
    """Tests for GET /api/shared/{share_token} (public, no auth required)."""

    def test_view_shared_document_with_valid_token(
        self, client: TestClient, test_user: User, db: Session
    ) -> None:
        doc = Document(
            title="My Shared Resume",
            document_type="resume",
            data={"name": "Jane Doe"},
            owner_id=test_user.id,
            share_token="valid-share-token-abc123",
        )
        db.add(doc)
        db.commit()

        response = client.get("/api/shared/valid-share-token-abc123")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "My Shared Resume"
        assert data["document_type"] == "resume"
        assert data["data"] == {"name": "Jane Doe"}
        # Owner info must NOT be present in the public response
        assert "owner_id" not in data

    def test_view_shared_document_nonexistent_token_returns_404(
        self, client: TestClient
    ) -> None:
        response = client.get("/api/shared/no-such-token")
        assert response.status_code == 404

    def test_view_shared_document_after_token_revoked_returns_404(
        self, client: TestClient, test_user: User, db: Session
    ) -> None:
        doc = Document(
            title="Revoked Share",
            document_type="resume",
            data={},
            owner_id=test_user.id,
            share_token=None,  # revoked
        )
        db.add(doc)
        db.commit()

        response = client.get("/api/shared/no-such-token")
        assert response.status_code == 404

    def test_view_shared_document_does_not_require_authentication(
        self, client: TestClient, test_user: User, db: Session
    ) -> None:
        doc = Document(
            title="Public Doc",
            document_type="cover_letter",
            data={"body": "Hello"},
            owner_id=test_user.id,
            share_token="public-token-xyz",
        )
        db.add(doc)
        db.commit()

        # No auth headers — must still work
        response = client.get("/api/shared/public-token-xyz")
        assert response.status_code == 200
