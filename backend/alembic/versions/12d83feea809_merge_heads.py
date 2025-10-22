"""merge_heads

Revision ID: 12d83feea809
Revises: 20251008_211051, 20251008_add_preco, 4ad36b2953d0
Create Date: 2025-10-15 22:39:00.343830

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '12d83feea809'
down_revision = ('20251008_211051', '20251008_add_preco', '4ad36b2953d0')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass