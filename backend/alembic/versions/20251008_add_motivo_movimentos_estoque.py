"""Add motivo column to movimentos_estoque

Revision ID: 20251008_add_motivo_movimentos
Revises: af8e4f151f4d
Create Date: 2025-10-08 20:19:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251008_add_motivo_movimentos'
down_revision = 'af8e4f151f4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add motivo column if not exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('movimentos_estoque')]
    if 'motivo' not in cols:
        op.add_column('movimentos_estoque', sa.Column('motivo', sa.String(length=100), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('movimentos_estoque')]
    if 'motivo' in cols:
        op.drop_column('movimentos_estoque', 'motivo')
