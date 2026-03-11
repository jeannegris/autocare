from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class TaxaPagamentoBase(BaseModel):
    tipo_pagamento: str = Field(..., description="Tipo de pagamento: DINHEIRO, PIX, DEBITO, CREDITO")
    percentual_taxa: Decimal = Field(default=Decimal('0.00'), ge=0, le=100, description="Percentual de taxa (0-100%)")
    descricao: Optional[str] = None
    ativo: bool = True

    @validator('tipo_pagamento')
    def validate_tipo_pagamento(cls, v):
        tipos_validos = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO']
        if v.upper() not in tipos_validos:
            raise ValueError(f'Tipo de pagamento deve ser um de: {", ".join(tipos_validos)}')
        return v.upper()


class TaxaPagamentoCreate(TaxaPagamentoBase):
    pass


class TaxaPagamentoUpdate(BaseModel):
    percentual_taxa: Optional[Decimal] = Field(None, ge=0, le=100, description="Percentual de taxa (0-100%)")
    descricao: Optional[str] = None
    ativo: Optional[bool] = None


class TaxaPagamentoResponse(TaxaPagamentoBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaxaPagamentoListResponse(BaseModel):
    """Resposta simplificada para listagem de taxas de pagamento"""
    id: int
    tipo_pagamento: str
    percentual_taxa: Decimal
    descricao: Optional[str]
    ativo: bool
    updated_at: datetime

    class Config:
        from_attributes = True
