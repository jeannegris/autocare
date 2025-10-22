"""add_sugestoes_manutencao_table

Revision ID: 260ed4139252
Revises: 32a20b8adc4d
Create Date: 2025-10-16 00:09:17.202390

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '260ed4139252'
down_revision = '32a20b8adc4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Criar tabela de sugestões de manutenção
    op.create_table(
        'sugestoes_manutencao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome_peca', sa.String(length=200), nullable=False),
        sa.Column('km_media_troca', sa.String(length=100), nullable=False),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('intervalo_km_min', sa.Integer(), nullable=True),
        sa.Column('intervalo_km_max', sa.Integer(), nullable=True),
        sa.Column('tipo_servico', sa.String(length=100), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('ordem_exibicao', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Criar índice para tipo_servico
    op.create_index('idx_sugestoes_tipo_servico', 'sugestoes_manutencao', ['tipo_servico'])
    
    # Inserir dados iniciais
    op.execute("""
        INSERT INTO sugestoes_manutencao (nome_peca, km_media_troca, observacoes, intervalo_km_min, intervalo_km_max, tipo_servico, ordem_exibicao) VALUES
        ('Óleo de motor (sintético)', '10.000 km ou 12 meses', 'Use sempre o grau e tipo especificado pelo fabricante. Troque também o filtro de óleo junto.', 10000, 10000, 'óleo', 1),
        ('Óleo de motor (semissintético)', '7.000 km ou 6 meses', 'Intervalo menor por menor estabilidade térmica.', 7000, 7000, 'óleo', 2),
        ('Filtro de óleo', 'A cada troca de óleo', 'Sempre trocado junto com o óleo.', 7000, 10000, 'filtro', 3),
        ('Filtro de ar do motor', '10.000 a 15.000 km', 'Inspecionar a cada revisão, especialmente em regiões com muita poeira.', 10000, 15000, 'filtro', 4),
        ('Filtro de combustível', '20.000 a 30.000 km', 'Essencial para proteger bicos injetores.', 20000, 30000, 'filtro', 5),
        ('Filtro de ar-condicionado (cabin filter)', '10.000 a 15.000 km', 'Troque se houver cheiro ruim ou ventilação fraca.', 10000, 15000, 'filtro', 6),
        ('Velas de ignição (comuns)', '20.000 a 30.000 km', 'Verifique folga e estado na revisão.', 20000, 30000, 'vela', 7),
        ('Velas de iridium / platina', '60.000 a 100.000 km', 'Duram bem mais, mas custam mais também.', 60000, 100000, 'vela', 8),
        ('Correia dentada', '50.000 a 70.000 km', 'Uma falha aqui = motor quebrado. Troque sempre com tensionador e rolamentos.', 50000, 70000, 'correia', 9),
        ('Correia auxiliar (poly-v)', '40.000 a 60.000 km', 'Inspecionar por trincas e desgaste.', 40000, 60000, 'correia', 10),
        ('Amortecedores', '50.000 a 80.000 km', 'Ou antes, se o carro balançar demais. Trocar em pares (dianteiros ou traseiros).', 50000, 80000, 'suspensão', 11),
        ('Pastilhas de freio', '20.000 a 40.000 km', 'Depende do estilo de condução e tipo de trânsito.', 20000, 40000, 'freio', 12),
        ('Discos de freio', '40.000 a 60.000 km', 'Trocar se houver desgaste excessivo ou empeno.', 40000, 60000, 'freio', 13),
        ('Fluido de freio (DOT 3/4/5.1)', '20.000 km ou 2 anos', 'Fluido higroscópico — absorve umidade e perde eficiência.', 20000, 20000, 'freio', 14),
        ('Fluido de arrefecimento (radiador)', '30.000 a 50.000 km ou 2 anos', 'Nunca use só água. Trocar com limpeza do sistema.', 30000, 50000, 'fluido', 15),
        ('Óleo da transmissão manual', '40.000 a 60.000 km', 'Alguns modelos dizem "lifetime", mas é mito — troque.', 40000, 60000, 'transmissão', 16),
        ('Óleo da transmissão automática / CVT', '40.000 a 80.000 km', 'Sempre use fluido especificado (ATF ou CVT).', 40000, 80000, 'transmissão', 17),
        ('Fluido de direção hidráulica', '40.000 a 60.000 km', 'Trocar ou completar conforme nível e cor.', 40000, 60000, 'direção', 18),
        ('Pneus', '40.000 a 60.000 km', 'Rodízio a cada 10.000 km. Verifique desgaste e pressão.', 40000, 60000, 'pneu', 19),
        ('Bateria', '2 a 4 anos', 'Inspecione polos e carga.', NULL, NULL, 'elétrica', 20),
        ('Palhetas do para-brisa', '6 a 12 meses', 'Trocar quando deixarem riscos ou ruído.', NULL, NULL, 'acessório', 21),
        ('Líquido do limpador de para-brisa', 'Sempre que necessário', 'Completar com mistura apropriada (não só água).', NULL, NULL, 'fluido', 22)
    """)


def downgrade() -> None:
    op.drop_index('idx_sugestoes_tipo_servico', table_name='sugestoes_manutencao')
    op.drop_table('sugestoes_manutencao')