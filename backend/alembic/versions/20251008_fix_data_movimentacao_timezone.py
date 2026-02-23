"""fix data_movimentacao timezone

Revision ID: 20251008_fix_timezone
Revises: 
Create Date: 2025-10-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '20251008_fix_timezone'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Atualizar data_movimentacao com o valor atual do sistema (com timezone)
    # para registros que têm data_movimentacao NULL
    op.execute(text("""
        UPDATE movimentos_estoque 
        SET data_movimentacao = CURRENT_TIMESTAMP 
        WHERE data_movimentacao IS NULL
    """))


def downgrade():
    # Não há downgrade - seria perda de dados
    pass
