"""Consolidate movimentos_estoque columns (short revision id)

Revision ID: 20251008_cons_movimentos
Revises: 20251008_add_motivo_movimentos
Create Date: 2025-10-08 20:35:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251008_cons_movimentos'
down_revision = '20251008_add_motivo_movimentos'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('movimentos_estoque')]

    # Add columns expected by the model if missing
    if 'fornecedor_id' not in cols:
        op.add_column('movimentos_estoque', sa.Column('fornecedor_id', sa.Integer(), nullable=True))
    if 'preco_unitario' not in cols:
        op.add_column('movimentos_estoque', sa.Column('preco_unitario', sa.Numeric(10,2), nullable=True))
    if 'valor_total' not in cols:
        op.add_column('movimentos_estoque', sa.Column('valor_total', sa.Numeric(10,2), nullable=True))
    if 'usuario_id' not in cols:
        op.add_column('movimentos_estoque', sa.Column('usuario_id', sa.Integer(), nullable=True))
    if 'usuario_nome' not in cols:
        op.add_column('movimentos_estoque', sa.Column('usuario_nome', sa.String(length=255), nullable=True))
    if 'ordem_servico_id' not in cols:
        op.add_column('movimentos_estoque', sa.Column('ordem_servico_id', sa.Integer(), nullable=True))
    if 'motivo' not in cols:
        op.add_column('movimentos_estoque', sa.Column('motivo', sa.String(length=100), nullable=True))
    if 'data_movimentacao' not in cols:
        op.add_column('movimentos_estoque', sa.Column('data_movimentacao', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('movimentos_estoque')]

    for c in ['fornecedor_id','preco_unitario','valor_total','usuario_id','usuario_nome','ordem_servico_id','motivo','data_movimentacao']:
        if c in cols:
            op.drop_column('movimentos_estoque', c)
