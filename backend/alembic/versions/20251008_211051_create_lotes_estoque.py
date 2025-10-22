"""create lotes_estoque table

Revision ID: 20251008_211051
Revises: 20251008_motivo
Create Date: 2025-01-08 21:10:51.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251008_211051'
down_revision = '20251008_motivo'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Criar tabela lotes_estoque
    op.create_table(
        'lotes_estoque',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('produto_id', sa.Integer(), nullable=False),
        sa.Column('movimento_entrada_id', sa.Integer(), nullable=False),
        sa.Column('fornecedor_id', sa.Integer(), nullable=True),
        sa.Column('quantidade_inicial', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('saldo_atual', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('preco_custo_unitario', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('preco_venda_unitario', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('margem_lucro', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('data_entrada', sa.DateTime(timezone=True), nullable=False),
        sa.Column('data_validade', sa.DateTime(timezone=True), nullable=True),
        sa.Column('numero_lote', sa.String(length=100), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['produto_id'], ['produtos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['movimento_entrada_id'], ['movimentos_estoque.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['fornecedor_id'], ['fornecedores.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Criar índices
    op.create_index(op.f('ix_lotes_estoque_id'), 'lotes_estoque', ['id'], unique=False)
    op.create_index(op.f('ix_lotes_estoque_produto_id'), 'lotes_estoque', ['produto_id'], unique=False)
    op.create_index(op.f('ix_lotes_estoque_data_entrada'), 'lotes_estoque', ['data_entrada'], unique=False)
    op.create_index(op.f('ix_lotes_estoque_ativo'), 'lotes_estoque', ['ativo'], unique=False)


def downgrade() -> None:
    # Remover índices
    op.drop_index(op.f('ix_lotes_estoque_ativo'), table_name='lotes_estoque')
    op.drop_index(op.f('ix_lotes_estoque_data_entrada'), table_name='lotes_estoque')
    op.drop_index(op.f('ix_lotes_estoque_produto_id'), table_name='lotes_estoque')
    op.drop_index(op.f('ix_lotes_estoque_id'), table_name='lotes_estoque')
    
    # Remover tabela
    op.drop_table('lotes_estoque')
