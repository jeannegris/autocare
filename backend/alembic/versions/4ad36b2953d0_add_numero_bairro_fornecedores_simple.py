"""add_numero_bairro_fornecedores_simple

Revision ID: 4ad36b2953d0
Revises: 3357143dfd09
Create Date: 2025-09-29 16:38:11.147885

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4ad36b2953d0'
down_revision = '3357143dfd09'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adicionar campos numero e bairro à tabela fornecedores
    op.add_column('fornecedores', sa.Column('numero', sa.String(length=20), nullable=True))
    op.add_column('fornecedores', sa.Column('bairro', sa.String(length=100), nullable=True))


def downgrade() -> None:
    # Remover campos numero e bairro da tabela fornecedores
    op.drop_column('fornecedores', 'bairro')
    op.drop_column('fornecedores', 'numero')