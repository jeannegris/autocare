"""add motivo_cancelamento to ordens_servico

Revision ID: 20251008_motivo
Revises: 20251008_cons_movimentos
Create Date: 2025-10-08 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251008_motivo'
down_revision = '20251008_cons_movimentos'
branch_labels = None
depends_on = None


def upgrade():
    # Adicionar coluna motivo_cancelamento na tabela ordens_servico
    op.execute("""
        ALTER TABLE ordens_servico 
        ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT
    """)


def downgrade():
    # Remover coluna motivo_cancelamento
    op.execute("""
        ALTER TABLE ordens_servico 
        DROP COLUMN IF EXISTS motivo_cancelamento
    """)
