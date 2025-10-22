"""merge_perfis_and_usuarios

Revision ID: 5fa3d6772ab3
Revises: 20251022_perfis, 27f1b6baf96f
Create Date: 2025-10-22 16:02:14.238129

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5fa3d6772ab3'
down_revision = ('20251022_perfis', '27f1b6baf96f')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass