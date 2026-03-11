from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MaquinaBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100, description="Nome da máquina/equipamento")
    descricao: Optional[str] = None
    taxa_dinheiro: Decimal = Field(default=Decimal('0.00'), ge=0, le=100)
    taxa_pix: Decimal = Field(default=Decimal('0.50'), ge=0, le=100)
    taxa_debito: Decimal = Field(default=Decimal('2.60'), ge=0, le=100)
    taxa_credito: Decimal = Field(default=Decimal('3.20'), ge=0, le=100)
    eh_default: bool = False
    ativo: bool = True


class MaquinaCreate(MaquinaBase):
    pass


class MaquinaUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    descricao: Optional[str] = None
    taxa_dinheiro: Optional[Decimal] = Field(None, ge=0, le=100)
    taxa_pix: Optional[Decimal] = Field(None, ge=0, le=100)
    taxa_debito: Optional[Decimal] = Field(None, ge=0, le=100)
    taxa_credito: Optional[Decimal] = Field(None, ge=0, le=100)
    eh_default: Optional[bool] = None
    ativo: Optional[bool] = None


class MaquinaResponse(MaquinaBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaquinaListResponse(BaseModel):
    """Resposta simplificada para listagem de máquinas"""
    id: int
    nome: str
    descricao: Optional[str]
    taxa_dinheiro: Decimal
    taxa_pix: Decimal
    taxa_debito: Decimal
    taxa_credito: Decimal
    eh_default: bool
    ativo: bool
    updated_at: datetime

    class Config:
        from_attributes = True
