"""add_perfis_table

Revision ID: 20251022_perfis
Revises: 0ae1eb323231
Create Date: 2025-10-22 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime
import json


# revision identifiers, used by Alembic.
revision = '20251022_perfis'
down_revision = '0ae1eb323231'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Criar tabela perfis
    op.create_table(
        'perfis',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('permissoes', sa.Text(), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('editavel', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_perfis_id'), 'perfis', ['id'], unique=False)
    op.create_index(op.f('ix_perfis_nome'), 'perfis', ['nome'], unique=True)
    
    # Inserir perfis padrão
    perfis_table = sa.table('perfis',
        sa.column('id', sa.Integer),
        sa.column('nome', sa.String),
        sa.column('descricao', sa.String),
        sa.column('permissoes', sa.Text),
        sa.column('ativo', sa.Boolean),
        sa.column('editavel', sa.Boolean),
        sa.column('created_at', sa.DateTime)
    )
    
    # Perfil Administrador - todas as permissões
    permissoes_admin = json.dumps({
        "dashboard_gerencial": True,
        "dashboard_operacional": True,
        "clientes": True,
        "veiculos": True,
        "estoque": True,
        "ordens_servico": True,
        "fornecedores": True,
        "relatorios": True,
        "configuracoes": True,
        "usuarios": True,
        "perfis": True
    })
    
    # Perfil Supervisor - permissões intermediárias
    permissoes_supervisor = json.dumps({
        "dashboard_gerencial": True,
        "dashboard_operacional": False,
        "clientes": True,
        "veiculos": True,
        "estoque": True,
        "ordens_servico": True,
        "fornecedores": True,
        "relatorios": True,
        "configuracoes": False,
        "usuarios": False,
        "perfis": False
    })
    
    # Perfil Operador - permissões básicas
    permissoes_operador = json.dumps({
        "dashboard_gerencial": False,
        "dashboard_operacional": True,
        "clientes": False,
        "veiculos": False,
        "estoque": True,
        "ordens_servico": True,
        "fornecedores": False,
        "relatorios": False,
        "configuracoes": False,
        "usuarios": False,
        "perfis": False
    })
    
    op.bulk_insert(perfis_table, [
        {
            'id': 1,
            'nome': 'Administrador',
            'descricao': 'Acesso total ao sistema',
            'permissoes': permissoes_admin,
            'ativo': True,
            'editavel': False,
            'created_at': datetime.now()
        },
        {
            'id': 2,
            'nome': 'Supervisor',
            'descricao': 'Acesso intermediário ao sistema',
            'permissoes': permissoes_supervisor,
            'ativo': True,
            'editavel': True,
            'created_at': datetime.now()
        },
        {
            'id': 3,
            'nome': 'Operador',
            'descricao': 'Acesso básico ao sistema',
            'permissoes': permissoes_operador,
            'ativo': True,
            'editavel': True,
            'created_at': datetime.now()
        }
    ])
    
    # Adicionar coluna perfil_id na tabela usuarios
    op.add_column('usuarios', sa.Column('perfil_id', sa.Integer(), nullable=True))
    
    # Definir perfil_id = 3 (Operador) para todos os usuários existentes
    op.execute('UPDATE usuarios SET perfil_id = 3 WHERE perfil_id IS NULL')
    
    # Tornar a coluna NOT NULL após preencher os valores
    op.alter_column('usuarios', 'perfil_id', nullable=False, server_default='3')
    
    # Criar foreign key
    op.create_foreign_key('fk_usuarios_perfil_id', 'usuarios', 'perfis', ['perfil_id'], ['id'])


def downgrade() -> None:
    # Remover foreign key
    op.drop_constraint('fk_usuarios_perfil_id', 'usuarios', type_='foreignkey')
    
    # Remover coluna perfil_id
    op.drop_column('usuarios', 'perfil_id')
    
    # Remover tabela perfis
    op.drop_index(op.f('ix_perfis_nome'), table_name='perfis')
    op.drop_index(op.f('ix_perfis_id'), table_name='perfis')
    op.drop_table('perfis')
