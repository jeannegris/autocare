from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class ItemCompraFornecedorBase(BaseModel):
    """Schema base para item de compra de fornecedor"""
    produto_id: int
    quantidade: int = Field(gt=0)
    preco_custo_unitario: Decimal = Field(ge=0)
    preco_venda_unitario: Optional[Decimal] = Field(None, ge=0)
    margem_lucro: Optional[Decimal] = Field(None, ge=0)


class ItemCompraFornecedorResponse(ItemCompraFornecedorBase):
    """Response com cálculos adicionais"""
    id: int
    frete_unitario_rateado: Decimal = Decimal('0.00')
    preco_custo_total: Decimal  # Custo unitário com frete
    valor_total: Decimal  # quantidade * preco_venda_unitario
    produto_nome: Optional[str] = None  # Nome do produto para exibição


class CompraFornecedorBase(BaseModel):
    """Schema base para compra de fornecedor"""
    numero_nota: Optional[str] = None
    fornecedor_id: int
    valor_frete: Decimal = Field(Decimal('0.00'), ge=0)
    observacoes: Optional[str] = None


class CompraFornecedorCreate(CompraFornecedorBase):
    """Schema para criar compra de fornecedor"""
    itens: List[ItemCompraFornecedorBase] = Field(min_items=1)


class CompraFornecedorUpdate(BaseModel):
    """Schema para atualizar compra de fornecedor"""
    numero_nota: Optional[str] = None
    valor_frete: Optional[Decimal] = None
    observacoes: Optional[str] = None
    itens: Optional[List[ItemCompraFornecedorBase]] = None


class CompraFornecedorResponse(CompraFornecedorBase):
    """Response completo de compra de fornecedor"""
    id: int
    data_compra: datetime
    valor_total_itens: Decimal
    valor_total: Decimal
    itens: List[ItemCompraFornecedorResponse]
    usuario_nome: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompraFornecedorList(BaseModel):
    """Schema para listagem de compras"""
    id: int
    numero_nota: Optional[str]
    fornecedor_id: int
    fornecedor_nome: Optional[str] = None
    data_compra: datetime
    valor_total_itens: Decimal
    valor_frete: Decimal
    valor_total: Decimal
    quantidade_itens: int = 0
    usuario_nome: Optional[str] = None

    class Config:
        from_attributes = True
