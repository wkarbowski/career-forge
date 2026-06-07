#!/usr/bin/env python3
"""Seed the database with the same demo documents shown in docs/images."""

from __future__ import annotations

import sys
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.insert_demo_documents import (
    COVER_LETTER_DATA,
    DEMO_COVER_LETTER_TITLE,
    DEMO_EMAIL,
    DEMO_RESUME_TITLE,
    RESUME_DATA,
)
from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import Document, DocumentVersion, User

DEMO_PASSWORD = "DemoPass123!"  # noqa: S105 - public demo account password


def create_demo_user(db: Session) -> User:
    """Create or return the demo user account."""
    existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if existing:
        print(f"✓ Demo user already exists: {existing.email}")
        return existing

    user = User(
        email=DEMO_EMAIL,
        username="demo_user",
        hashed_password=get_password_hash(DEMO_PASSWORD),
        is_active=True,
        theme="dark",
        language="en",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"✓ Created demo user: {user.email}")
    print(f"  Password: {DEMO_PASSWORD}")
    return user


def clear_demo_documents(db: Session, user: User) -> None:
    """Remove existing demo-user documents so the seeded data matches the screenshots."""
    documents = db.query(Document).filter(Document.owner_id == user.id).all()
    for document in documents:
        db.delete(document)
    db.commit()


def create_demo_documents(db: Session, user: User) -> tuple[Document, Document]:
    """Create the resume and cover letter used in the documentation screenshots."""
    resume = Document(
        title=DEMO_RESUME_TITLE,
        document_type="resume",
        data=deepcopy(RESUME_DATA),
        owner_id=user.id,
        is_default=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(resume)
    db.flush()

    cover_letter = Document(
        title=DEMO_COVER_LETTER_TITLE,
        document_type="cover_letter",
        data=deepcopy(COVER_LETTER_DATA),
        owner_id=user.id,
        linked_resume_id=resume.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    db.add(cover_letter)
    db.commit()
    db.refresh(resume)
    db.refresh(cover_letter)
    print(f"✓ Created resume: {resume.title}")
    print(f"✓ Created cover letter: {cover_letter.title}")
    return resume, cover_letter


def create_document_versions(db: Session, document: Document) -> None:
    """Create version snapshots for the screenshot demo resume."""
    versions = ["Initial Draft", "Screenshot Demo"]
    for version_name in versions:
        db.add(
            DocumentVersion(
                document_id=document.id,
                version_name=version_name,
                data=deepcopy(document.data),
                created_at=datetime.now(UTC),
            )
        )

    db.commit()
    print(f"✓ Created {len(versions)} version snapshots for: {document.title}")


def main() -> None:
    """Seed screenshot-matching demo data."""
    print("\nSeeding Career Forge with screenshot demo data...\n")

    db = SessionLocal()
    try:
        user = create_demo_user(db)
        clear_demo_documents(db, user)
        resume, _cover_letter = create_demo_documents(db, user)
        create_document_versions(db, resume)

        print("\nDemo data created successfully!")
        print("\nSummary:")
        print(f"   User: {DEMO_EMAIL} (Password: {DEMO_PASSWORD})")
        print(f"   Resume: {DEMO_RESUME_TITLE}")
        print(f"   Cover Letter: {DEMO_COVER_LETTER_TITLE}")
        print("   Linked pair: yes")
        print()

    except Exception as e:
        print(f"\nError: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
