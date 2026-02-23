from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db import Base

class Cliente(Base):
    __tablename__ = "clientes"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255))
    telefone = Column(String(20))
    endereco = Column(String(500))
    cpf_cnpj = Column(String(20))
    tipo = Column(String(20), default='Pessoa Física')
    cep = Column(String(10))
    cidade = Column(String(100))
    estado = Column(String(2))
    bairro = Column(String(100))
    numero = Column(String(20))
    complemento = Column(String(200))
    data_nascimento = Column(Date)
    contato_emergencia = Column(String(100))
    telefone_emergencia = Column(String(20))
    observacoes = Column(Text)
    data_cadastro = Column(Date)
    status = Column(String(20))
    limite_credito = Column(Numeric(10,2))
    desconto_padrao = Column(Numeric(5,2))
    rg = Column(String(20))
    profissao = Column(String(100))
    renda = Column(Numeric(10,2))
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
    
    # Relacionamentos
    veiculos = relationship("Veiculo", back_populates="cliente")
    ordens_servico = relationship("OrdemServico", back_populates="cliente")

class Veiculo(Base):
    __tablename__ = "veiculos"
    
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    placa = Column(String(10), nullable=False)
    marca = Column(String(100), nullable=False)
    modelo = Column(String(100), nullable=False)
    ano = Column(Integer)
    km = Column(Integer, default=0)
    cor = Column(String(50))
    chassi = Column(String(50))
    renavam = Column(String(20))
    combustivel = Column(String(20))
    motor = Column(String(50))
    observacoes = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
    
    # Relacionamentos
    cliente = relationship("Cliente", back_populates="veiculos")
    ordens_servico = relationship("OrdemServico", back_populates="veiculo")

class Fornecedor(Base):
    __tablename__ = "fornecedores"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    razao_social = Column(String(255))
    contato = Column(String(255))
    telefone = Column(String(20))
    email = Column(String(255))
    endereco = Column(String(500))
    cnpj = Column(String(20))
    inscricao_estadual = Column(String(20))
    cep = Column(String(10))
    cidade = Column(String(100))
    estado = Column(String(2))
    bairro = Column(String(100))
    numero = Column(String(20))
    complemento = Column(String(200))
    banco = Column(String(50))
    agencia = Column(String(10))
    conta = Column(String(20))
    observacoes = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))

    # Relacionamentos
    produtos = relationship("Produto", back_populates="fornecedor")

class Produto(Base):
    __tablename__ = "produtos"
    
    id = Column(Integer, primary_key=True, index=True)
    codigo_barras = Column(String(50))
    nome = Column(String(255), nullable=False)
    descricao = Column(Text)
    categoria = Column(String(100))
    preco_custo = Column(Numeric(10,2), default=0)
    preco_venda = Column(Numeric(10,2), default=0)
    quantidade_estoque = Column(Integer, default=0)
    estoque_minimo = Column(Integer, default=0)
    fornecedor_id = Column(Integer, ForeignKey("fornecedores.id"))
    unidade = Column(String(10), default='UN')
    peso = Column(Numeric(8,3))
    dimensoes = Column(String(50))
    ncm = Column(String(20))
    cest = Column(String(20))
    origem = Column(String(10))
    marca = Column(String(100))
    modelo = Column(String(100))
    localizacao = Column(String(50))
    validade = Column(Date)
    lote = Column(String(50))
    aplicacao = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
    
    # Relacionamentos
    fornecedor = relationship("Fornecedor", back_populates="produtos")

class OrdemServico(Base):
    __tablename__ = "ordens_servico"
    
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    veiculo_id = Column(Integer, ForeignKey("veiculos.id"))
    data_abertura = Column(Date)
    data_entrega = Column(Date)
    data_prevista_entrega = Column(Date)
    status = Column(String(50), default='Aberta')
    descricao_problema = Column(Text)
    descricao_servico = Column(Text)
    valor_mao_obra = Column(Numeric(10,2), default=0)
    valor_pecas = Column(Numeric(10,2), default=0)
    valor_total = Column(Numeric(10,2), default=0)
    desconto = Column(Numeric(10,2), default=0)
    valor_final = Column(Numeric(10,2), default=0)
    forma_pagamento = Column(String(50))
    observacoes = Column(Text)
    tecnico_responsavel = Column(String(100))
    km_entrada = Column(Integer)
    km_saida = Column(Integer)
    garantia_dias = Column(Integer, default=90)
    prioridade = Column(String(20), default='Normal')
    origem = Column(String(50), default='Balcão')
    tipo_servico = Column(String(50))
    aprovado = Column(Boolean, default=False)
    data_aprovacao = Column(DateTime(timezone=True))
    usuario_aprovacao = Column(String(100))
    cancelado = Column(Boolean, default=False)
    motivo_cancelamento = Column(Text)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))
    
    # Relacionamentos
    cliente = relationship("Cliente", back_populates="ordens_servico")
    veiculo = relationship("Veiculo", back_populates="ordens_servico")

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    nome = Column(String(255), nullable=False)
    role = Column(String(20), default='user')
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))