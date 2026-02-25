"""Add valor_custo_pecas and valor_faturado fields to ordens_servico table

Revision ID: add_valor_faturado
Revises: (previous revision)
Create Date: 2025-02-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_valor_faturado'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to ordens_servico table
    op.add_column('ordens_servico', sa.Column('valor_custo_pecas', sa.Numeric(10, 2), server_default='0', nullable=False))
    op.add_column('ordens_servico', sa.Column('valor_faturado', sa.Numeric(10, 2), server_default='0', nullable=False))


def downgrade() -> None:
    # Remove columns from ordens_servico table
    op.drop_column('ordens_servico', 'valor_faturado')
    op.drop_column('ordens_servico', 'valor_custo_pecas')
