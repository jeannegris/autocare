"""add preco custo venda margem to movimentos estoque

Revision ID: 20251008_add_preco
Revises: 20251008_fix_timezone
Create Date: 2025-10-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251008_add_preco'
down_revision = '20251008_fix_timezone'
branch_labels = None
depends_on = None


def upgrade():
    # Adicionar novas colunas
    op.add_column('movimentos_estoque', sa.Column('preco_custo', sa.Numeric(10, 2), nullable=True))
    op.add_column('movimentos_estoque', sa.Column('preco_venda', sa.Numeric(10, 2), nullable=True))
    op.add_column('movimentos_estoque', sa.Column('margem_lucro', sa.Numeric(10, 2), nullable=True))
    
    # Copiar valores de preco_unitario para preco_custo (para manter compatibilidade com dados existentes)
    op.execute("""
        UPDATE movimentos_estoque 
        SET preco_custo = preco_unitario 
        WHERE preco_unitario IS NOT NULL
    """)


def downgrade():
    # Remover colunas adicionadas
    op.drop_column('movimentos_estoque', 'margem_lucro')
    op.drop_column('movimentos_estoque', 'preco_venda')
    op.drop_column('movimentos_estoque', 'preco_custo')
