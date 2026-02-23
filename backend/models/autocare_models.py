from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Numeric, Date, Float
from sqlalchemy.orm import relationship, foreign, synonym
from sqlalchemy.sql import func
from datetime import datetime
from db import Base

class Cliente(Base):
    __tablename__ = "clientes"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False, index=True)
    cpf_cnpj = Column(String(20), index=True)
    email = Column(String(255), index=True)
    telefone = Column(String(20))
    telefone2 = Column(String(20))
    whatsapp = Column(String(20))
    endereco = Column(String(500))
    numero = Column(String(20))
    complemento = Column(String(100))
    bairro = Column(String(100))
    cidade = Column(String(100))
    estado = Column(String(2))
    cep = Column(String(10))
    tipo = Column(String(2), nullable=False, default='PF')  # PF ou PJ
    data_nascimento = Column(Date)
    nome_fantasia = Column(String(255))
    razao_social = Column(String(255))
    contato_responsavel = Column(String(255))
    rg_ie = Column(String(20))
    observacoes = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    veiculos = relationship("Veiculo", back_populates="cliente")
    ordens_servico = relationship("OrdemServico", back_populates="cliente")

class Veiculo(Base):
    __tablename__ = "veiculos"
    
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    marca = Column(String(100), nullable=False)
    modelo = Column(String(100), nullable=False)
    ano = Column(Integer, nullable=False)
    cor = Column(String(50))
    placa = Column(String(10), unique=True, index=True)
    # Coluna no banco é 'chassis'
    chassis = Column(String(50), unique=True)
    renavam = Column(String(20))  # Adicionado
    # Coluna no banco é 'km_atual'
    km_atual = Column(Integer, default=0)
    combustivel = Column(String(20))  # GASOLINA, ETANOL, DIESEL, FLEX, GNV, ELETRICO, HIBRIDO
    observacoes = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    cliente = relationship("Cliente", back_populates="veiculos")
    ordens_servico = relationship("OrdemServico", back_populates="veiculo")
    alertas_km = relationship("AlertaKm", back_populates="veiculo")
    manutencoes_historico = relationship("ManutencaoHistorico", back_populates="veiculo")

class Fornecedor(Base):
    __tablename__ = "fornecedores"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False, index=True)
    razao_social = Column(String(255))
    cnpj = Column(String(20), unique=True, index=True)
    email = Column(String(255))
    telefone = Column(String(20))
    endereco = Column(String(500))
    cidade = Column(String(100))
    estado = Column(String(2))
    cep = Column(String(10))
    contato = Column(String(255))
    observacoes = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    produtos = relationship("Produto", back_populates="fornecedor")
    movimentos_estoque = relationship("MovimentoEstoque", back_populates="fornecedor")
    lotes = relationship("LoteEstoque", back_populates="fornecedor", foreign_keys="LoteEstoque.fornecedor_id")

class Categoria(Base):
    __tablename__ = "categorias"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False, unique=True, index=True)
    descricao = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos  
    # Relacionamentos (sem FK no DB: ligar por nome da categoria — leitura somente)
    produtos = relationship(
        "Produto",
        primaryjoin="Categoria.nome==foreign(Produto.categoria)",
        viewonly=True
    )

class Produto(Base):
    __tablename__ = "produtos"
    
    id = Column(Integer, primary_key=True, index=True)
    # Colunas mapeadas de acordo com o esquema atual do banco
    codigo = Column(String(50), unique=True, index=True)
    nome = Column(String(255), nullable=False, index=True)
    descricao = Column(Text)
    # DB usa campo 'categoria' (string). Não há categoria_id FK na tabela produtos no esquema atual.
    categoria = Column(String(100))  # Para facilitar consultas
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"))
    preco_custo = Column(Numeric(10, 2), default=0)
    preco_venda = Column(Numeric(10, 2), default=0)
    quantidade_atual = Column(Integer, default=0)
    quantidade_minima = Column(Integer, default=0)
    unidade = Column(String(10))  # UN, PC, KG, LT, MT, M2, M3
    localizacao = Column(String(100))  # Estante/Prateleira
    # campo 'status' não existe no DB atual: manter compatibilidade via property
    # (não mapeado como coluna para evitar SELECT de coluna inexistente)
    @property
    def status(self):
        # Calcular status baseado no estoque atual vs estoque mínimo
        if self.quantidade_atual == 0:
            return 'SEM_ESTOQUE'
        elif self.quantidade_atual <= self.quantidade_minima:
            return 'BAIXO_ESTOQUE'
        else:
            return 'DISPONIVEL'
    # campos inexistentes no esquema atual: expor via properties para compatibilidade
    @property
    def data_ultima_movimentacao(self):
        """Retorna a data da última movimentação de estoque deste produto"""
        if self.movimentos_estoque:
            # Ordenar por data decrescente e pegar o primeiro
            movimentos_ordenados = sorted(
                self.movimentos_estoque, 
                key=lambda m: m.data_movimentacao if m.data_movimentacao else datetime.min,
                reverse=True
            )
            return movimentos_ordenados[0].data_movimentacao if movimentos_ordenados else None
        return None

    @property
    def tipo_ultima_movimentacao(self):
        """Retorna o tipo da última movimentação de estoque deste produto"""
        if self.movimentos_estoque:
            # Ordenar por data decrescente e pegar o primeiro
            movimentos_ordenados = sorted(
                self.movimentos_estoque, 
                key=lambda m: m.data_movimentacao if m.data_movimentacao else datetime.min,
                reverse=True
            )
            return movimentos_ordenados[0].tipo if movimentos_ordenados else None
        return None
    
    # Colunas que existem no DB (além das já definidas)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)  # Se a tabela categorias existir
    status = Column(String(20), nullable=True)  # Status do produto
    data_ultima_movimentacao = Column(DateTime(timezone=True), nullable=True)  # Cache da última movimentação
    tipo_ultima_movimentacao = Column(String(10), nullable=True)  # Cache do tipo da última movimentação
    
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relacionamentos mínimos (somente os que existem no DB)
    fornecedor = relationship("Fornecedor", back_populates="produtos")
    movimentos_estoque = relationship("MovimentoEstoque", back_populates="produto")
    itens_ordem = relationship("ItemOrdem", back_populates="produto")
    lotes = relationship("LoteEstoque", back_populates="produto", foreign_keys="LoteEstoque.produto_id")

class OrdemServico(Base):
    __tablename__ = "ordens_servico"
    
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), unique=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    veiculo_id = Column(Integer, ForeignKey("veiculos.id"), nullable=True)
    # Novos campos para o tipo de ordem
    tipo_ordem = Column(String(20), nullable=False, default="SERVICO")  # VENDA, SERVICO, VENDA_SERVICO
    # Campo para descrição detalhada do serviço (quando tipo for SERVICO ou VENDA_SERVICO)
    descricao_servico = Column(Text)
    # Campos antigos mantidos para compatibilidade
    descricao_problema = Column(Text)  # Removido nullable=False para compatibilidade
    observacoes = Column(Text)
    status = Column(String(30), default="PENDENTE")  # PENDENTE, EM_ANDAMENTO, AGUARDANDO_PECA, AGUARDANDO_APROVACAO, CONCLUIDA, CANCELADA
    prioridade = Column(String(20), default="MEDIA")  # BAIXA, MEDIA, ALTA, URGENTE
    # Colunas no banco possuem nomes diferentes (legado)
    # data_abertura no banco é do tipo DATE (legado)
    data_abertura = Column(Date, server_default=func.now())
    # alias sem duplicar a coluna
    data_ordem = Column(DateTime(timezone=True))  # Campo que existe no banco
    data_prevista = Column(DateTime(timezone=True))
    data_conclusao = Column(DateTime(timezone=True))
    # NOTA: km_entrada não existe no banco atual
    # km_veiculo = Column('km_entrada', Integer)
    km_veiculo = Column(Integer)
    # Valores separados por tipo
    valor_servico = Column(Numeric(10, 2), default=0)
    valor_mao_obra = Column(Numeric(10, 2), default=0)  # Campo legado mantido
    valor_pecas = Column(Numeric(10, 2), default=0)
    valor_subtotal = Column(Numeric(10, 2), default=0)
    # desconto armazenado no DB como 'desconto' (campo legado) e 'valor_desconto' (novo)
    desconto = Column(Numeric(10, 2), default=0)  # Campo legado
    valor_desconto = Column(Numeric(10, 2), default=0)
    percentual_desconto = Column(Numeric(5, 2), default=0)
    tipo_desconto = Column(String(20), default='TOTAL')
    valor_total = Column(Numeric(10, 2), default=0)
    funcionario_responsavel = Column(String(255))
    # tempo_* podem não existir no esquema
    tempo_estimado_horas = Column(Numeric(5, 2))
    tempo_gasto_horas = Column(Numeric(5, 2))
    aprovado_cliente = Column(Boolean, default=False)
    forma_pagamento = Column(String(50))
    motivo_cancelamento = Column(Text)  # Motivo do cancelamento (quando status = CANCELADA)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    cliente = relationship("Cliente", back_populates="ordens_servico")
    veiculo = relationship("Veiculo", back_populates="ordens_servico")
    itens = relationship("ItemOrdem", back_populates="ordem")

class ItemOrdem(Base):
    __tablename__ = "itens_ordem"
    
    id = Column(Integer, primary_key=True, index=True)
    ordem_id = Column(Integer, ForeignKey("ordens_servico.id"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id"))  # Para produtos/peças
    descricao = Column(String(255), nullable=False)
    quantidade = Column(Numeric(10, 3), default=1)
    valor_unitario = Column(Numeric(10, 2), default=0)
    valor_total = Column(Numeric(10, 2), default=0)
    tipo = Column(String(20), nullable=False)  # PRODUTO, SERVICO
    desconto_item = Column(Numeric(10, 2), default=0)      # Desconto específico do item
    observacoes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos
    ordem = relationship("OrdemServico", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_ordem")

class MovimentoEstoque(Base):
    __tablename__ = "movimentos_estoque"
    
    id = Column(Integer, primary_key=True, index=True)
    # Coluna no banco é 'item_id' que referencia produtos
    item_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    tipo = Column(String(20), nullable=False)  # ENTRADA ou SAIDA
    quantidade = Column(Integer, nullable=False)
    preco_unitario = Column(Numeric(10, 2), nullable=True)  # Mantido para compatibilidade (será igual a preco_custo)
    preco_custo = Column(Numeric(10, 2), nullable=True)  # Preço de custo unitário
    preco_venda = Column(Numeric(10, 2), nullable=True)  # Preço de venda unitário
    margem_lucro = Column(Numeric(10, 2), nullable=True)  # Margem de lucro em percentual
    valor_total = Column(Numeric(10, 2), nullable=True)
    motivo = Column(String(100), nullable=True)
    observacoes = Column(Text, nullable=True)
    usuario_id = Column(Integer, nullable=True)  # ID do usuário que fez a movimentação
    usuario_nome = Column(String(255), nullable=True)  # Nome do usuário
    ordem_servico_id = Column(Integer, ForeignKey("ordens_servico.id"), nullable=True)  # Link com OS se aplicável
    data_movimentacao = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos
    produto = relationship("Produto", back_populates="movimentos_estoque")
    fornecedor = relationship("Fornecedor", back_populates="movimentos_estoque")
    ordem_servico = relationship("OrdemServico")

class LoteEstoque(Base):
    __tablename__ = "lotes_estoque"
    
    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
    movimento_entrada_id = Column(Integer, ForeignKey("movimentos_estoque.id"), nullable=False)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"), nullable=True)
    
    # Informações do lote
    quantidade_inicial = Column(Integer, nullable=False)  # Quantidade original do lote
    saldo_atual = Column(Integer, nullable=False)  # Quantidade disponível no lote
    preco_custo_unitario = Column(Numeric(10, 2), nullable=False)  # Custo unitário deste lote
    preco_venda_unitario = Column(Numeric(10, 2), nullable=True)  # Preço de venda deste lote
    margem_lucro = Column(Numeric(10, 2), nullable=True)  # Margem de lucro em %
    
    # Controle
    data_entrada = Column(DateTime(timezone=True), nullable=False)  # Data de entrada do lote
    data_validade = Column(Date, nullable=True)  # Validade do lote (opcional)
    numero_lote = Column(String(50), nullable=True)  # Número do lote do fornecedor (opcional)
    ativo = Column(Boolean, default=True)  # Se o lote ainda está ativo
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    produto = relationship("Produto", back_populates="lotes")
    movimento_entrada = relationship("MovimentoEstoque", foreign_keys=[movimento_entrada_id])
    fornecedor = relationship("Fornecedor")

class AlertaKm(Base):
    __tablename__ = "alertas_km"
    
    id = Column(Integer, primary_key=True, index=True)
    veiculo_id = Column(Integer, ForeignKey("veiculos.id"), nullable=False)
    tipo_servico = Column(String(100), nullable=False)  # Troca de óleo, Pastilha, etc.
    km_proximo_servico = Column(Integer, nullable=False)
    km_intervalo = Column(Integer, default=10000)  # Intervalo padrão
    descricao = Column(Text)
    ativo = Column(Boolean, default=True)
    notificado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    veiculo = relationship("Veiculo", back_populates="alertas_km")

# Novo modelo para histórico de manutenções
class ManutencaoHistorico(Base):
    __tablename__ = "manutencoes_historico"
    
    id = Column(Integer, primary_key=True, index=True)
    veiculo_id = Column(Integer, ForeignKey("veiculos.id"), nullable=False)
    tipo = Column(String(100), nullable=False)
    descricao = Column(Text)
    km_realizada = Column(Integer, nullable=False)
    data_realizada = Column(Date, nullable=False)
    km_proxima = Column(Integer)
    data_proxima = Column(Date)
    valor = Column(Numeric(10, 2))
    observacoes = Column(Text)
    ordem_servico_id = Column(Integer, ForeignKey("ordens_servico.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relacionamentos
    veiculo = relationship("Veiculo")
    ordem_servico = relationship("OrdemServico")

# Modelo para dados do Dashboard
class DashboardStats(Base):
    __tablename__ = "dashboard_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    data_referencia = Column(Date, nullable=False)
    total_clientes = Column(Integer, default=0)
    total_veiculos = Column(Integer, default=0)
    total_pecas_estoque = Column(Integer, default=0)
    ordens_abertas = Column(Integer, default=0)
    ordens_hoje = Column(Integer, default=0)
    receita_mensal = Column(Numeric(12, 2), default=0)
    receita_diaria = Column(Numeric(10, 2), default=0)
    crescimento_mensal = Column(Numeric(5, 2), default=0)
    servicos_realizados = Column(Integer, default=0)
    pecas_vendidas = Column(Integer, default=0)
    alertas_estoque = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Configuracao(Base):
    __tablename__ = "configuracoes"
    
    id = Column(Integer, primary_key=True, index=True)
    chave = Column(String(100), unique=True, nullable=False, index=True)
    valor = Column(Text, nullable=False)
    descricao = Column(Text)
    tipo = Column(String(50), default='string')  # string, number, boolean, password
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SugestaoManutencao(Base):
    __tablename__ = "sugestoes_manutencao"
    
    id = Column(Integer, primary_key=True, index=True)
    nome_peca = Column(String(200), nullable=False)
    km_media_troca = Column(String(100), nullable=False)
    observacoes = Column(Text)
    intervalo_km_min = Column(Integer)
    intervalo_km_max = Column(Integer)
    tipo_servico = Column(String(100), index=True)
    ativo = Column(Boolean, default=True)
    ordem_exibicao = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Perfil(Base):
    __tablename__ = "perfis"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), unique=True, nullable=False, index=True)
    descricao = Column(Text)
    permissoes = Column(Text, nullable=False)  # JSON string com as permissões
    ativo = Column(Boolean, default=True)
    editavel = Column(Boolean, default=True)  # False para Administrador
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    usuarios = relationship("Usuario", back_populates="perfil")

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    senha_hash = Column(String(255), nullable=False)
    nome = Column(String(255), nullable=False)
    ativo = Column(Boolean, default=True)
    usar_2fa = Column(Boolean, default=False)
    secret_2fa = Column(String(32), nullable=True)  # Secret para TOTP (pyotp)
    perfil_id = Column(Integer, ForeignKey("perfis.id"), nullable=False, default=3)  # Padrão: Operador
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
        
    # Relacionamentos
    perfil = relationship("Perfil", back_populates="usuarios")


class BackupLog(Base):
    """Registro de auditoria de backups do banco de dados"""
    __tablename__ = "backup_logs"

    id = Column(Integer, primary_key=True, index=True)
    data_hora = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    tipo = Column(String(20), nullable=False, index=True)  # 'manual', 'diario', 'mensal'
    tamanho_mb = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default='sucesso')  # 'sucesso', 'erro', 'em_progresso'
    hash_arquivo = Column(String(64), nullable=True)  # SHA256
    caminho_arquivo = Column(Text, nullable=True)
    criado_por = Column(String(100), nullable=True)  # username ou 'sistema'
    observacoes = Column(Text, nullable=True)
    erro_detalhes = Column(Text, nullable=True)

    def __repr__(self):
        return f"<BackupLog(id={self.id}, tipo={self.tipo}, data_hora={self.data_hora}, status={self.status})>"
