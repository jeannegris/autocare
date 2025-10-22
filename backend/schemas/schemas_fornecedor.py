from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import datetime

class FornecedorBase(BaseModel):
    nome: str
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    contato: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool = True

class FornecedorCreate(FornecedorBase):
    pass

class FornecedorUpdate(BaseModel):
    nome: Optional[str] = None
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    contato: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None

class FornecedorResponse(FornecedorBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class FornecedorList(BaseModel):
    id: int
    nome: str
    cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    contato: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool
    class Config:
        from_attributes = True