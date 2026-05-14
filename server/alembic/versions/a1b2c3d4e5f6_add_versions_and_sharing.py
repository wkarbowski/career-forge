"""Add document versions and share tokens

Revision ID: a1b2c3d4e5f6
Revises: b2d4e8f1a039
Create Date: 2026-02-01 12:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "b2d4e8f1a039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add document_versions table and share_token column."""
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    existing_tables = inspector.get_table_names()

    if "document_versions" not in existing_tables:
        op.create_table(
            "document_versions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("document_id", sa.Integer(), nullable=False),
            sa.Column("version_name", sa.String(length=255), nullable=False),
            sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_document_versions_id"), "document_versions", ["id"], unique=False)
        op.create_index(op.f("ix_document_versions_document_id"), "document_versions", ["document_id"], unique=False)

    existing_columns = [c["name"] for c in inspector.get_columns("documents")]
    if "share_token" not in existing_columns:
        with op.batch_alter_table("documents", schema=None) as batch_op:
            batch_op.add_column(sa.Column("share_token", sa.String(length=64), nullable=True))
            batch_op.create_index("ix_documents_share_token", ["share_token"], unique=True)


def downgrade() -> None:
    """Remove document_versions table and share_token column."""
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.drop_index("ix_documents_share_token")
        batch_op.drop_column("share_token")

    op.drop_index(op.f("ix_document_versions_document_id"), table_name="document_versions")
    op.drop_index(op.f("ix_document_versions_id"), table_name="document_versions")
    op.drop_table("document_versions")
