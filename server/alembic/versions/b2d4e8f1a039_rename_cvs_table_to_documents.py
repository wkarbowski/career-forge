"""Rename cvs table to documents

Revision ID: b2d4e8f1a039
Revises: e3a1f92b8c04
Create Date: 2026-03-09 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b2d4e8f1a039'
down_revision = 'e3a1f92b8c04'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table('cvs', 'documents')


def downgrade() -> None:
    op.rename_table('documents', 'cvs')
