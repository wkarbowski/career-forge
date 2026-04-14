"""add linked_resume_id column to documents

Revision ID: f7a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect


# revision identifiers, used by Alembic.
revision: str = 'f7a2b3c4d5e6'
down_revision: str = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    existing_columns = [c['name'] for c in inspector.get_columns('documents')]

    if 'linked_resume_id' not in existing_columns:
        op.add_column('documents', sa.Column('linked_resume_id', sa.Integer(), nullable=True))
        op.create_index('ix_documents_linked_resume_id', 'documents', ['linked_resume_id'], unique=True)
        op.create_foreign_key(
            'fk_documents_linked_resume_id',
            'documents', 'documents',
            ['linked_resume_id'], ['id'],
            ondelete='SET NULL'
        )

        # Backfill: migrate existing links from JSONB data blob to the new column
        op.execute("""
            UPDATE documents
            SET linked_resume_id = (data->'coverLetterData'->>'linkedResumeId')::int
            WHERE document_type = 'cover_letter'
              AND data->'coverLetterData'->>'linkedResumeId' IS NOT NULL
              AND (data->'coverLetterData'->>'linkedResumeId') ~ '^[0-9]+$'
        """)


def downgrade() -> None:
    op.drop_constraint('fk_documents_linked_resume_id', 'documents', type_='foreignkey')
    op.drop_index('ix_documents_linked_resume_id', table_name='documents')
    op.drop_column('documents', 'linked_resume_id')
