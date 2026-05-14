"""Extended document tests.

Covers: duplication, default-document logic, version history,
share links, linked resumes (1:1 constraint), export/import,
document-type filtering, and profile-image upload/removal.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Document, DocumentVersion, User

# ---------------------------------------------------------------------------
# File-local fixture (complements conftest.test_document with cover-letter)
# ---------------------------------------------------------------------------


@pytest.fixture()
def test_cover_letter(db: Session, test_user: User, test_document: Document) -> Document:
    """Cover letter linked to test_document (a resume)."""
    cl = Document(
        title="Test Cover Letter",
        document_type="cover_letter",
        data={"body": "Dear Hiring Manager"},
        owner_id=test_user.id,
        linked_resume_id=test_document.id,
    )
    db.add(cl)
    db.commit()
    db.refresh(cl)
    return cl


# ---------------------------------------------------------------------------


class TestDocumentDuplicate:
    """Tests for POST /api/documents/{id}/duplicate."""

    def test_duplicate_creates_copy(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
    ) -> None:
        response = client.post(
            f"/api/documents/{test_document.id}/duplicate",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 201
        data = response.json()
        assert "Copy" in data["title"]
        assert data["document_type"] == test_document.document_type
        assert data["data"] == test_document.data
        assert data["id"] != test_document.id

    def test_duplicate_does_not_inherit_share_token(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        test_document.share_token = "some-token"
        db.commit()

        response = client.post(
            f"/api/documents/{test_document.id}/duplicate",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 201
        assert response.json()["share_token"] is None

    def test_duplicate_nonexistent_document_returns_404(self, client: TestClient, auth_headers: dict) -> None:
        response = client.post("/api/documents/99999/duplicate", headers=auth_headers, json={})
        assert response.status_code == 404

    def test_duplicate_unauthenticated_returns_401(self, client: TestClient, test_document: Document) -> None:
        response = client.post(f"/api/documents/{test_document.id}/duplicate", json={})
        assert response.status_code == 401


class TestDocumentDefault:
    """Tests for GET /api/documents/default/current and is_default logic."""

    def test_get_explicit_default_document(
        self, client: TestClient, auth_headers: dict, test_user: User, db: Session
    ) -> None:
        doc = Document(
            title="My Default",
            document_type="resume",
            data={},
            owner_id=test_user.id,
            is_default=True,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        response = client.get("/api/documents/default/current", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == doc.id

    def test_get_default_falls_back_to_most_recent(
        self, client: TestClient, auth_headers: dict, test_user: User, db: Session
    ) -> None:
        doc = Document(
            title="Recent Doc",
            document_type="resume",
            data={},
            owner_id=test_user.id,
            is_default=False,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        response = client.get("/api/documents/default/current", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == doc.id

    def test_get_default_no_documents_returns_404(self, client: TestClient, auth_headers: dict) -> None:
        response = client.get("/api/documents/default/current", headers=auth_headers)
        assert response.status_code == 404

    def test_set_default_unsets_other_defaults(
        self,
        client: TestClient,
        auth_headers: dict,
        test_user: User,
        db: Session,
    ) -> None:
        doc1 = Document(title="D1", document_type="resume", data={}, owner_id=test_user.id, is_default=True)
        doc2 = Document(title="D2", document_type="resume", data={}, owner_id=test_user.id, is_default=False)
        db.add_all([doc1, doc2])
        db.commit()
        db.refresh(doc1)
        db.refresh(doc2)

        response = client.put(
            f"/api/documents/{doc2.id}",
            headers=auth_headers,
            json={"is_default": True},
        )
        assert response.status_code == 200
        assert response.json()["is_default"] is True

        db.refresh(doc1)
        assert doc1.is_default is False


class TestDocumentVersions:
    """Tests for the /api/documents/{id}/versions sub-resource."""

    def test_create_version(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
    ) -> None:
        response = client.post(
            f"/api/documents/{test_document.id}/versions",
            headers=auth_headers,
            json={"version_name": "v1.0"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["version_name"] == "v1.0"
        assert "id" in data

    def test_list_versions(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        for i in range(3):
            db.add(
                DocumentVersion(
                    document_id=test_document.id,
                    version_name=f"v{i}",
                    data=test_document.data,
                )
            )
        db.commit()

        response = client.get(f"/api/documents/{test_document.id}/versions", headers=auth_headers)
        assert response.status_code == 200
        assert len(response.json()) == 3

    def test_get_version_detail(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        version = DocumentVersion(
            document_id=test_document.id,
            version_name="snapshot",
            data={"snapshot": True},
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        response = client.get(
            f"/api/documents/{test_document.id}/versions/{version.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["version_name"] == "snapshot"
        assert response.json()["data"] == {"snapshot": True}

    def test_restore_version(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        version = DocumentVersion(
            document_id=test_document.id,
            version_name="old-state",
            data={"restored": True},
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        response = client.post(
            f"/api/documents/{test_document.id}/versions/{version.id}/restore",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 200
        assert response.json()["data"] == {"restored": True}

    def test_delete_version(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        version = DocumentVersion(document_id=test_document.id, version_name="to-delete", data={})
        db.add(version)
        db.commit()
        db.refresh(version)

        response = client.delete(
            f"/api/documents/{test_document.id}/versions/{version.id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        assert db.query(DocumentVersion).filter(DocumentVersion.id == version.id).first() is None

    def test_get_nonexistent_version_returns_404(
        self, client: TestClient, auth_headers: dict, test_document: Document
    ) -> None:
        response = client.get(f"/api/documents/{test_document.id}/versions/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_create_version_on_other_users_doc_returns_404(
        self,
        client: TestClient,
        auth_headers: dict,
        other_user: User,
        db: Session,
    ) -> None:
        other_doc = Document(title="Other Doc", document_type="resume", data={}, owner_id=other_user.id)
        db.add(other_doc)
        db.commit()
        db.refresh(other_doc)

        response = client.post(
            f"/api/documents/{other_doc.id}/versions",
            headers=auth_headers,
            json={"version_name": "v1"},
        )
        assert response.status_code == 404

    def test_max_versions_per_document_enforced(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        # Insert 20 versions directly to avoid 20 round-trip HTTP calls
        for i in range(20):
            db.add(
                DocumentVersion(
                    document_id=test_document.id,
                    version_name=f"auto-{i}",
                    data=test_document.data,
                )
            )
        db.commit()

        response = client.post(
            f"/api/documents/{test_document.id}/versions",
            headers=auth_headers,
            json={"version_name": "overflow"},
        )
        assert response.status_code == 400
        assert "maximum" in response.json()["detail"].lower()


class TestDocumentSharing:
    """Tests for POST/DELETE /api/documents/{id}/share."""

    def test_create_share_link_returns_token(
        self, client: TestClient, auth_headers: dict, test_document: Document
    ) -> None:
        response = client.post(f"/api/documents/{test_document.id}/share", headers=auth_headers, json={})
        assert response.status_code == 200
        data = response.json()
        assert "share_token" in data
        assert "url" in data
        assert len(data["share_token"]) > 10

    def test_create_share_link_is_idempotent(
        self, client: TestClient, auth_headers: dict, test_document: Document
    ) -> None:
        r1 = client.post(f"/api/documents/{test_document.id}/share", headers=auth_headers, json={})
        r2 = client.post(f"/api/documents/{test_document.id}/share", headers=auth_headers, json={})
        assert r1.json()["share_token"] == r2.json()["share_token"]

    def test_revoke_share_link_clears_token(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        client.post(f"/api/documents/{test_document.id}/share", headers=auth_headers, json={})

        response = client.delete(f"/api/documents/{test_document.id}/share", headers=auth_headers)
        assert response.status_code == 204

        db.refresh(test_document)
        assert test_document.share_token is None

    def test_share_link_unauthenticated_returns_401(self, client: TestClient, test_document: Document) -> None:
        response = client.post(f"/api/documents/{test_document.id}/share", json={})
        assert response.status_code == 401


class TestDocumentLinkedResume:
    """Cover-letter → resume 1:1 linking constraint."""

    def test_create_cover_letter_with_linked_resume(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        test_user: User,
    ) -> None:
        response = client.post(
            "/api/documents/",
            headers=auth_headers,
            json={
                "title": "My CL",
                "document_type": "cover_letter",
                "data": {},
                "linked_resume_id": test_document.id,
            },
        )
        assert response.status_code == 201
        assert response.json()["linked_resume_id"] == test_document.id

    def test_linked_resume_not_found_returns_400(self, client: TestClient, auth_headers: dict) -> None:
        response = client.post(
            "/api/documents/",
            headers=auth_headers,
            json={
                "title": "CL",
                "document_type": "cover_letter",
                "data": {},
                "linked_resume_id": 99999,
            },
        )
        assert response.status_code == 400
        assert "linked resume" in response.json()["detail"].lower()

    def test_second_cover_letter_on_same_resume_returns_409(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
    ) -> None:
        # First cover letter — succeeds
        client.post(
            "/api/documents/",
            headers=auth_headers,
            json={
                "title": "CL 1",
                "document_type": "cover_letter",
                "data": {},
                "linked_resume_id": test_document.id,
            },
        )
        # Second — must be rejected (1:1 constraint)
        response = client.post(
            "/api/documents/",
            headers=auth_headers,
            json={
                "title": "CL 2",
                "document_type": "cover_letter",
                "data": {},
                "linked_resume_id": test_document.id,
            },
        )
        assert response.status_code == 409
        assert "already linked" in response.json()["detail"].lower()


class TestDocumentExport:
    """Tests for GET /api/documents/{id}/export."""

    def test_export_document_returns_all_fields(
        self, client: TestClient, auth_headers: dict, test_document: Document
    ) -> None:
        response = client.get(f"/api/documents/{test_document.id}/export", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == test_document.title
        assert data["document_type"] == test_document.document_type
        assert data["data"] == test_document.data
        assert "exported_at" in data

    def test_export_nonexistent_document_returns_404(self, client: TestClient, auth_headers: dict) -> None:
        response = client.get("/api/documents/99999/export", headers=auth_headers)
        assert response.status_code == 404


class TestDocumentImport:
    """Tests for POST /api/documents/import."""

    def test_import_document_creates_new_document(
        self, client: TestClient, auth_headers: dict, test_user: User
    ) -> None:
        response = client.post(
            "/api/documents/import",
            headers=auth_headers,
            json={
                "title": "Imported Resume",
                "document_type": "resume",
                "data": {"name": "Imported"},
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Imported Resume"
        assert data["owner_id"] == test_user.id

    def test_import_document_unauthenticated_returns_401(self, client: TestClient) -> None:
        response = client.post(
            "/api/documents/import",
            json={"title": "X", "document_type": "resume", "data": {}},
        )
        assert response.status_code == 401


class TestDocumentFilter:
    """Tests for GET /api/documents/?document_type= filtering."""

    def test_filter_returns_only_resumes(
        self, client: TestClient, auth_headers: dict, test_user: User, db: Session
    ) -> None:
        db.add_all(
            [
                Document(title="R", document_type="resume", data={}, owner_id=test_user.id),
                Document(
                    title="CL",
                    document_type="cover_letter",
                    data={},
                    owner_id=test_user.id,
                ),
            ]
        )
        db.commit()

        response = client.get("/api/documents/?document_type=resume", headers=auth_headers)
        assert response.status_code == 200
        results = response.json()
        assert len(results) >= 1
        assert all(d["document_type"] == "resume" for d in results)

    def test_filter_returns_only_cover_letters(
        self, client: TestClient, auth_headers: dict, test_user: User, db: Session
    ) -> None:
        db.add_all(
            [
                Document(title="R", document_type="resume", data={}, owner_id=test_user.id),
                Document(
                    title="CL",
                    document_type="cover_letter",
                    data={},
                    owner_id=test_user.id,
                ),
            ]
        )
        db.commit()

        response = client.get("/api/documents/?document_type=cover_letter", headers=auth_headers)
        assert response.status_code == 200
        results = response.json()
        assert len(results) >= 1
        assert all(d["document_type"] == "cover_letter" for d in results)

    def test_filter_invalid_type_returns_422(self, client: TestClient, auth_headers: dict) -> None:
        response = client.get("/api/documents/?document_type=invalid", headers=auth_headers)
        assert response.status_code == 422


class TestProfileImage:
    """Tests for POST /upload-image and DELETE /profile-image."""

    def test_upload_svg_is_rejected(self, client: TestClient, auth_headers: dict, test_document: Document) -> None:
        files = {"file": ("evil.svg", b"<svg></svg>", "image/svg+xml")}
        response = client.post(
            f"/api/documents/{test_document.id}/upload-image",
            headers=auth_headers,
            files=files,
        )
        assert response.status_code == 400

    def test_upload_oversized_image_returns_413(
        self, client: TestClient, auth_headers: dict, test_document: Document
    ) -> None:
        # 5 MB + 1 byte — must exceed the server-side limit
        large_data = b"x" * (5 * 1024 * 1024 + 1)
        files = {"file": ("big.jpg", large_data, "image/jpeg")}
        response = client.post(
            f"/api/documents/{test_document.id}/upload-image",
            headers=auth_headers,
            files=files,
        )
        assert response.status_code == 413

    def test_remove_profile_image_clears_field(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
        db: Session,
    ) -> None:
        # Pre-set a fake image name (file need not exist on disk)
        test_document.profile_image = "nonexistent_fake.jpg"
        db.commit()

        response = client.delete(
            f"/api/documents/{test_document.id}/profile-image",
            headers=auth_headers,
        )
        assert response.status_code == 204

        db.refresh(test_document)
        assert test_document.profile_image is None

    def test_upload_image_unauthenticated_returns_401(self, client: TestClient, test_document: Document) -> None:
        files = {"file": ("photo.jpg", b"data", "image/jpeg")}
        response = client.post(
            f"/api/documents/{test_document.id}/upload-image",
            files=files,
        )
        assert response.status_code == 401


class TestDocumentOwnershipGuards:
    """404 ownership guards on secondary endpoints not covered elsewhere."""

    def test_export_other_users_document_returns_404(
        self, client: TestClient, auth_headers: dict, other_user: User, db: Session
    ) -> None:
        other_doc = Document(title="Other Export", document_type="resume", data={}, owner_id=other_user.id)
        db.add(other_doc)
        db.commit()
        db.refresh(other_doc)

        response = client.get(f"/api/documents/{other_doc.id}/export", headers=auth_headers)
        assert response.status_code == 404

    def test_revoke_share_link_no_token_is_noop(
        self, client: TestClient, auth_headers: dict, test_document: Document
    ) -> None:
        """DELETE /share on a doc that has no token must still return 204."""
        assert test_document.share_token is None
        response = client.delete(f"/api/documents/{test_document.id}/share", headers=auth_headers)
        assert response.status_code == 204

    def test_revoke_share_link_other_user_returns_404(
        self, client: TestClient, auth_headers: dict, other_user: User, db: Session
    ) -> None:
        other_doc = Document(
            title="Other Shared",
            document_type="resume",
            data={},
            owner_id=other_user.id,
            share_token="other-share-token",
        )
        db.add(other_doc)
        db.commit()
        db.refresh(other_doc)

        response = client.delete(f"/api/documents/{other_doc.id}/share", headers=auth_headers)
        assert response.status_code == 404

    def test_remove_profile_image_other_user_returns_404(
        self, client: TestClient, auth_headers: dict, other_user: User, db: Session
    ) -> None:
        other_doc = Document(
            title="Other Doc",
            document_type="resume",
            data={},
            owner_id=other_user.id,
            profile_image="some.jpg",
        )
        db.add(other_doc)
        db.commit()
        db.refresh(other_doc)

        response = client.delete(f"/api/documents/{other_doc.id}/profile-image", headers=auth_headers)
        assert response.status_code == 404


class TestDocumentDataSanitization:
    """sanitize_document_data is called on create/update — verify XSS is stripped."""

    def test_create_strips_script_tag_from_data(self, client: TestClient, auth_headers: dict) -> None:
        response = client.post(
            "/api/documents/",
            headers=auth_headers,
            json={
                "title": "XSS Test",
                "document_type": "resume",
                "data": {"bio": "<script>alert(1)</script>Hello"},
            },
        )
        assert response.status_code == 201
        bio = response.json()["data"]["bio"]
        assert "<script>" not in bio
        assert "<script>" not in bio

    def test_update_strips_script_tag_from_data(
        self,
        client: TestClient,
        auth_headers: dict,
        test_document: Document,
    ) -> None:
        response = client.put(
            f"/api/documents/{test_document.id}",
            headers=auth_headers,
            json={"data": {"bio": "<img onerror=alert(1) src=x>"}},
        )
        assert response.status_code == 200
        bio = response.json()["data"]["bio"]
        assert "onerror" not in bio
