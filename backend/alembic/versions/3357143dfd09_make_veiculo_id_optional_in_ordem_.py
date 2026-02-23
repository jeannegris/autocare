"""make_veiculo_id_optional_in_ordem_servico

Revision ID: 3357143dfd09
Revises: 7f894655893d
Create Date: 2025-09-25 17:28:51.109622

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3357143dfd09'
down_revision = '7f894655893d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tornar veiculo_id opcional na tabela ordens_servico
    op.alter_column('ordens_servico', 'veiculo_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade() -> None:
    # Reverter veiculo_id para obrigatório
    op.alter_column('ordens_servico', 'veiculo_id',
                    existing_type=sa.Integer(),
                    nullable=False)