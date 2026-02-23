from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal

class ProdutoBase(BaseModel):
    codigo: str
    nome: str
    descricao: Optional[str] = None
    categoria: Optional[str] = None  # Nome da categoria (string, não FK)
    fornecedor_id: Optional[int] = None
    preco_custo: Decimal = Decimal('0.00')
    preco_venda: Decimal = Decimal('0.00')
    quantidade_atual: int = 0
    quantidade_minima: int = 0
    unidade: str = "UN"  # UN, PC, KG, LT, MT, M2, M3
    localizacao: Optional[str] = None
    ativo: bool = True

    @validator('preco_custo', 'preco_venda')
    def validate_precos(cls, v):
        if v < 0:
            raise ValueError('Preço não pode ser negativo')
        return v

    @validator('quantidade_atual', 'quantidade_minima')
    def validate_estoque(cls, v):
        if v < 0:
            raise ValueError('Estoque não pode ser negativo')
        return v

    @validator('unidade')
    def validate_unidade(cls, v):
        if v not in ['UN', 'PC', 'KG', 'LT', 'MT', 'M2', 'M3']:
            raise ValueError('Unidade inválida')
        return v

class ProdutoCreate(ProdutoBase):
    pass

class ProdutoUpdate(BaseModel):
    codigo: Optional[str] = None
    nome: Optional[str] = None
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    fornecedor_id: Optional[int] = None
    preco_custo: Optional[Decimal] = None
    preco_venda: Optional[Decimal] = None
    quantidade_atual: Optional[int] = None
    quantidade_minima: Optional[int] = None
    unidade: Optional[str] = None
    localizacao: Optional[str] = None
    ativo: Optional[bool] = None

class ProdutoResponse(ProdutoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    data_ultima_movimentacao: Optional[datetime] = None
    tipo_ultima_movimentacao: Optional[str] = None
    fornecedor_nome: Optional[str] = None
    status: Optional[str] = None  # Status calculado: DISPONIVEL, BAIXO_ESTOQUE, SEM_ESTOQUE
    
    class Config:
        from_attributes = True

class ItemEstoque(ProdutoResponse):
    """Alias para compatibilidade com o frontend"""
    pass

class ProdutoList(BaseModel):
    id: int
    codigo: str
    nome: str
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    unidade: Optional[str] = None
    fornecedor_id: Optional[int] = None
    fornecedor_nome: Optional[str] = None
    preco_custo: Decimal
    preco_venda: Decimal
    quantidade_atual: int
    quantidade_minima: int
    localizacao: Optional[str] = None
    ativo: bool
    status: Optional[str] = None  # Status calculado: DISPONIVEL, BAIXO_ESTOQUE, SEM_ESTOQUE
    class Config:
        from_attributes = True

class CategoriaBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    ativo: bool = True

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None

class CategoriaResponse(CategoriaBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class MovimentacaoEstoqueBase(BaseModel):
    item_id: int  # Renomeado de produto_id
    fornecedor_id: Optional[int] = None
    tipo: str  # ENTRADA ou SAIDA
    quantidade: Decimal
    preco_unitario: Optional[Decimal] = None  # Mantido para compatibilidade
    preco_custo: Optional[Decimal] = None  # Preço de custo unitário
    preco_venda: Optional[Decimal] = None  # Preço de venda unitário
    margem_lucro: Optional[Decimal] = None  # Margem de lucro em percentual
    valor_total: Optional[Decimal] = None
    motivo: str
    observacoes: Optional[str] = None
    usuario_id: Optional[int] = None
    usuario_nome: Optional[str] = None
    ordem_servico_id: Optional[int] = None

    @validator('tipo')
    def validate_tipo(cls, v):
        if v not in ['ENTRADA', 'SAIDA']:
            raise ValueError('Tipo deve ser "ENTRADA" ou "SAIDA"')
        return v

    @validator('quantidade')
    def validate_quantidade(cls, v):
        if v <= 0:
            raise ValueError('Quantidade deve ser maior que zero')
        return v

class MovimentacaoEstoqueCreate(MovimentacaoEstoqueBase):
    pass

class MovimentacaoEstoqueResponse(MovimentacaoEstoqueBase):
    id: int
    data_movimentacao: Optional[datetime] = None
    created_at: Optional[datetime] = None
    fornecedor_nome: Optional[str] = None
    
    class Config:
        from_attributes = True

class MovimentacaoFormData(BaseModel):
    """Schema para o formulário do frontend"""
    tipo: str  # ENTRADA ou SAIDA
    quantidade: int
    preco_unitario: Optional[float] = None
    motivo: str
    observacoes: Optional[str] = None
    fornecedor_id: Optional[int] = None

# =============================================================================
# SCHEMAS PARA LOTES DE ESTOQUE
# =============================================================================

class LoteEstoqueBase(BaseModel):
    produto_id: int
    movimento_entrada_id: int
    fornecedor_id: Optional[int] = None
    quantidade_inicial: Decimal
    saldo_atual: Decimal
    preco_custo_unitario: Decimal
    preco_venda_unitario: Optional[Decimal] = None
    margem_lucro: Optional[Decimal] = None
    data_entrada: datetime
    data_validade: Optional[datetime] = None
    numero_lote: Optional[str] = None
    ativo: bool = True

class LoteEstoqueResponse(LoteEstoqueBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    produto_nome: Optional[str] = None
    fornecedor_nome: Optional[str] = None
    
    class Config:
        from_attributes = True

class LoteEstoqueList(BaseModel):
    """Lista resumida de lotes para exibição"""
    id: int
    numero_lote: Optional[str] = None
    quantidade_inicial: Decimal
    saldo_atual: Decimal
    preco_custo_unitario: Decimal
    preco_venda_unitario: Optional[Decimal] = None
    data_entrada: datetime
    data_validade: Optional[datetime] = None
    fornecedor_nome: Optional[str] = None
    ativo: bool
    
    class Config:
        from_attributes = True
