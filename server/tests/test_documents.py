"""Tests for document endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Document, User


class TestDocumentCreation:
    """Test document creation."""

    def test_create_document_authenticated(self, client: TestClient, auth_headers: dict, test_user: User) -> None:
        """Test creating a document as authenticated user."""
        response = client.post(
            "/api/documents/",
            headers=auth_headers,
            json={
                "title": "Untitled Resume",
                "document_type": "resume",
                "data": {"name": "John Doe", "position": "Software Engineer"},
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Untitled Resume"
        assert data["document_type"] == "resume"
        assert data["owner_id"] == test_user.id

    def test_create_document_unauthenticated(self, client: TestClient) -> None:
        """Test creating a document without authentication fails."""
        response = client.post(
            "/api/documents/",
            json={
                "title": "Untitled Resume",
                "document_type": "resume",
                "data": {},
            },
        )
        assert response.status_code == 401


class TestDocumentRetrieval:
    """Test document retrieval."""

    def test_get_own_documents(
        self,
        client: TestClient,
        auth_headers: dict,
        test_user: User,
        db: Session,
    ) -> None:
        """Test getting list of own documents."""
        # Create some documents
        doc1 = Document(
            title="Resume 1",
            document_type="resume",
            data={"name": "Test"},
            owner_id=test_user.id,
        )
        doc2 = Document(
            title="Cover Letter 1",
            document_type="cover_letter",
            data={"name": "Test"},
            owner_id=test_user.id,
        )
        db.add_all([doc1, doc2])
        db.commit()

        response = client.get("/api/documents/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all(doc["owner_id"] == test_user.id for doc in data)

    def test_get_document_by_id(
        self,
        client: TestClient,
        auth_headers: dict,
        test_user: User,
        db: Session,
    ) -> None:
        """Test getting a specific document by ID."""
        doc = Document(
            title="Test Doc",
            document_type="resume",
            data={"name": "Test User"},
            owner_id=test_user.id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        response = client.get(f"/api/documents/{doc.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == doc.id
        assert data["title"] == "Test Doc"

    def test_get_nonexistent_document(self, client: TestClient, auth_headers: dict) -> None:
        """Test getting a non-existent document returns 404."""
        response = client.get("/api/documents/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_get_other_user_document(
        self,
        client: TestClient,
        auth_headers: dict,
        other_user: User,
        db: Session,
    ) -> None:
        """Test that users cannot access other users' documents."""
        # Create a document owned by another user.
        other_doc = Document(
            title="Other User Document",
            document_type="resume",
            data={"name": "Other User"},
            owner_id=other_user.id,
        )
        db.add(other_doc)
        db.commit()
        db.refresh(other_doc)

        # Try to access as regular user (auth_headers belongs to test_user)
        response = client.get(f"/api/documents/{other_doc.id}", headers=auth_headers)
        assert response.status_code == 404  # Should not find it


class TestDocumentUpdate:
    """Test document updates."""

    def test_update_own_document(
        self,
        client: TestClient,
        auth_headers: dict,
        test_user: User,
        db: Session,
    ) -> None:
        """Test updating own document."""
        doc = Document(
            title="Original Title",
            document_type="resume",
            data={"name": "Original"},
            owner_id=test_user.id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        response = client.put(
            f"/api/documents/{doc.id}",
            headers=auth_headers,
            json={
                "title": "Updated Title",
                "document_type": "resume",
                "data": {"name": "Updated"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["data"]["name"] == "Updated"

    def test_update_other_user_document(
        self,
        client: TestClient,
        auth_headers: dict,
        other_user: User,
        db: Session,
    ) -> None:
        """Test that users cannot update other users' documents."""
        other_doc = Document(
            title="Other User Document",
            document_type="resume",
            data={"name": "Other User"},
            owner_id=other_user.id,
        )
        db.add(other_doc)
        db.commit()
        db.refresh(other_doc)

        response = client.put(
            f"/api/documents/{other_doc.id}",
            headers=auth_headers,
            json={"title": "Hacked", "document_type": "resume", "data": {}},
        )
        assert response.status_code == 404


class TestDocumentDeletion:
    """Test document deletion."""

    def test_delete_own_document(
        self,
        client: TestClient,
        auth_headers: dict,
        test_user: User,
        db: Session,
    ) -> None:
        """Test deleting own document."""
        doc = Document(
            title="To Delete",
            document_type="resume",
            data={"name": "Test"},
            owner_id=test_user.id,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        response = client.delete(f"/api/documents/{doc.id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify document is deleted
        deleted_doc = db.query(Document).filter(Document.id == doc.id).first()
        assert deleted_doc is None

    def test_delete_other_user_document(
        self,
        client: TestClient,
        auth_headers: dict,
        other_user: User,
        db: Session,
    ) -> None:
        """Test that users cannot delete other users' documents."""
        other_doc = Document(
            title="Other User Document",
            document_type="resume",
            data={"name": "Other User"},
            owner_id=other_user.id,
        )
        db.add(other_doc)
        db.commit()
        db.refresh(other_doc)

        response = client.delete(f"/api/documents/{other_doc.id}", headers=auth_headers)
        assert response.status_code == 404

        # Verify document still exists
        still_exists = db.query(Document).filter(Document.id == other_doc.id).first()
        assert still_exists is not None
