"""add enviar_relatorio_email to clientes

Revision ID: 20260415_enviar_relatorio
Revises: add_maquinas_table
Create Date: 2026-04-15 16:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260415_enviar_relatorio'
down_revision = '139464eb0876'
branch_labels = None
depends_on = None


def upgrade():
    # Adicionar coluna enviar_relatorio_email na tabela clientes com valor padrão True
    op.execute("""
        ALTER TABLE clientes 
        ADD COLUMN IF NOT EXISTS enviar_relatorio_email BOOLEAN DEFAULT TRUE
    """)


def downgrade():
    # Remover coluna enviar_relatorio_email
    op.execute("""
        ALTER TABLE clientes 
        DROP COLUMN IF EXISTS enviar_relatorio_email
    """)
