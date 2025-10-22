"""criar_tabela_usuarios

Revision ID: 27f1b6baf96f
Revises: 0ae1eb323231
Create Date: 2025-10-22 11:57:32.526097

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '27f1b6baf96f'
down_revision = '0ae1eb323231'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Criar tabela usuarios
    op.create_table(
        'usuarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('senha_hash', sa.String(length=255), nullable=False),
        sa.Column('nome', sa.String(length=255), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=True),
        sa.Column('usar_2fa', sa.Boolean(), nullable=True),
        sa.Column('secret_2fa', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usuarios_id'), 'usuarios', ['id'], unique=False)
    op.create_index(op.f('ix_usuarios_username'), 'usuarios', ['username'], unique=True)
    op.create_index(op.f('ix_usuarios_email'), 'usuarios', ['email'], unique=True)


def downgrade() -> None:
    # Remover índices
    op.drop_index(op.f('ix_usuarios_email'), table_name='usuarios')
    op.drop_index(op.f('ix_usuarios_username'), table_name='usuarios')
    op.drop_index(op.f('ix_usuarios_id'), table_name='usuarios')
    # Remover tabela
    op.drop_table('usuarios')