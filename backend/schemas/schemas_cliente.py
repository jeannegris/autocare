from pydantic import BaseModel, EmailStr, validator
from typing import Optional
from datetime import date, datetime

class ClienteBase(BaseModel):
    nome: str
    cpf_cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    telefone2: Optional[str] = None
    whatsapp: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    tipo: str = 'PF'  # PF ou PJ
    data_nascimento: Optional[date] = None
    nome_fantasia: Optional[str] = None
    razao_social: Optional[str] = None
    contato_responsavel: Optional[str] = None
    rg_ie: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool = True

    @validator('tipo')
    def validate_tipo(cls, v):
        if v not in ['PF', 'PJ']:
            raise ValueError('Tipo deve ser PF ou PJ')
        return v

class ClienteCreate(ClienteBase):
    pass

class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    telefone2: Optional[str] = None
    whatsapp: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    tipo: Optional[str] = None
    data_nascimento: Optional[date] = None
    nome_fantasia: Optional[str] = None
    razao_social: Optional[str] = None
    contato_responsavel: Optional[str] = None
    rg_ie: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None

class ClienteResponse(ClienteBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Campos calculados do frontend
    total_gasto: Optional[float] = 0
    total_servicos: Optional[int] = 0
    ultima_visita: Optional[str] = None
    veiculos_count: Optional[int] = 0
    
    class Config:
        from_attributes = True

class ClienteList(BaseModel):
    id: int
    nome: str
    cpf_cnpj: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    telefone2: Optional[str] = None
    whatsapp: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    rg_ie: Optional[str] = None
    observacoes: Optional[str] = None
    tipo: str
    nome_fantasia: Optional[str] = None
    razao_social: Optional[str] = None
    contato_responsavel: Optional[str] = None
    data_nascimento: Optional[date] = None
    ativo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    total_gasto: Optional[float] = 0
    total_servicos: Optional[int] = 0
    veiculos_count: Optional[int] = 0
    
    class Config:
        from_attributes = True