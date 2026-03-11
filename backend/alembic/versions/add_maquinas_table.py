"""Add Maquina table and maquina_id to OrdemServico

Revision ID: add_maquinas_table
Revises: add_payment_methods
Create Date: 2026-03-11 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_maquinas_table'
down_revision = 'add_payment_methods'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the Maquina table
    op.create_table(
        'maquinas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('descricao', sa.String(length=255), nullable=True),
        sa.Column('taxa_dinheiro', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('taxa_pix', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.50'),
        sa.Column('taxa_debito', sa.Numeric(precision=5, scale=2), nullable=False, server_default='2.60'),
        sa.Column('taxa_credito', sa.Numeric(precision=5, scale=2), nullable=False, server_default='3.20'),
        sa.Column('eh_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_maquinas_nome'), 'maquinas', ['nome'], unique=True)
    
    # Add maquina_id column to ordens_servico
    op.add_column('ordens_servico', sa.Column('maquina_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'ordens_servico', 'maquinas', ['maquina_id'], ['id'])
    
    # Insert default machine
    op.execute("""
        INSERT INTO maquinas (nome, descricao, taxa_dinheiro, taxa_pix, taxa_debito, taxa_credito, eh_default, ativo)
        VALUES ('Máquina Padrão', 'Máquina padrão do sistema', 0.00, 0.50, 2.60, 3.20, true, true)
    """)


def downgrade() -> None:
    # Drop foreign key
    op.drop_constraint(None, 'ordens_servico', type_='foreignkey')
    
    # Drop maquina_id column
    op.drop_column('ordens_servico', 'maquina_id')
    
    # Drop table
    op.drop_index(op.f('ix_maquinas_nome'), table_name='maquinas')
    op.drop_table('maquinas')
