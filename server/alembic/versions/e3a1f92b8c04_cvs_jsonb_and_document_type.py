"""Convert cvs.data to JSONB and add document_type column

Revision ID: e3a1f92b8c04
Revises: 6104f6581867
Create Date: 2026-03-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e3a1f92b8c04'
down_revision: Union[str, Sequence[str], None] = '6104f6581867'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add document_type column with default so existing rows get 'resume'
    op.add_column('cvs', sa.Column(
        'document_type',
        sa.String(length=20),
        nullable=False,
        server_default='resume',
    ))

    # 2. Backfill document_type from the JSON blob for rows that already exist.
    #    Rows whose data contained "documentType": "cover-letter" become cover_letter;
    #    everything else stays resume.
    op.execute("""
        UPDATE cvs
        SET document_type = 'cover_letter'
        WHERE data::jsonb->>'documentType' = 'cover-letter'
    """)

    # 3. Convert data column from TEXT to JSONB.
    #    The USING cast is safe — all existing rows are valid JSON strings.
    op.execute("""
        ALTER TABLE cvs
        ALTER COLUMN data TYPE JSONB USING data::jsonb
    """)


def downgrade() -> None:
    # Revert JSONB → TEXT
    op.execute("""
        ALTER TABLE cvs
        ALTER COLUMN data TYPE TEXT USING data::text
    """)

    op.drop_column('cvs', 'document_type')
