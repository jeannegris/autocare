"""Add payment methods and payment fees support to OS and create TaxaPagamento table

Revision ID: add_payment_methods
Revises: af8e4f151f4d
Create Date: 2026-03-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_payment_methods'
down_revision = 'af8e4f151f4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the TaxaPagamento table
    op.create_table(
        'taxas_pagamento',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tipo_pagamento', sa.String(length=50), nullable=False),
        sa.Column('percentual_taxa', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('descricao', sa.String(length=255), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_taxas_pagamento_tipo_pagamento'), 'taxas_pagamento', ['tipo_pagamento'], unique=True)
    
    # Add new columns to ordens_servico table
    op.add_column('ordens_servico', sa.Column('numero_parcelas', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('ordens_servico', sa.Column('taxa_pagamento_aplicada', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'))
    
    # Create indexes
    op.create_index(op.f('ix_ordens_servico_forma_pagamento'), 'ordens_servico', ['forma_pagamento'])


def downgrade() -> None:
    # Drop the indexes and columns from ordens_servico
    op.drop_index(op.f('ix_ordens_servico_forma_pagamento'), table_name='ordens_servico')
    op.drop_column('ordens_servico', 'taxa_pagamento_aplicada')
    op.drop_column('ordens_servico', 'numero_parcelas')
    
    # Drop the TaxaPagamento table
    op.drop_index(op.f('ix_taxas_pagamento_tipo_pagamento'), table_name='taxas_pagamento')
    op.drop_table('taxas_pagamento')
