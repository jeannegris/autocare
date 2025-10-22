from pydantic import BaseModel, field_validator
from typing import Optional, Dict
from datetime import datetime
import json

# Schema para as permissões
class Permissoes(BaseModel):
    dashboard: bool = False
    clientes: bool = False
    veiculos: bool = False
    estoque: bool = False
    ordens_servico: bool = False
    fornecedores: bool = False
    relatorios: bool = False
    configuracoes: bool = False
    usuarios: bool = False
    perfis: bool = False

# Schemas para CRUD de Perfis
class PerfilBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    permissoes: Permissoes
    ativo: Optional[bool] = True

class PerfilCreate(PerfilBase):
    pass

class PerfilUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    permissoes: Optional[Permissoes] = None
    ativo: Optional[bool] = None

class PerfilResponse(PerfilBase):
    id: int
    editavel: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
    
    @classmethod
    def model_validate(cls, obj):
        """Converte permissoes de string JSON para dict"""
        if hasattr(obj, 'permissoes') and isinstance(obj.permissoes, str):
            obj.permissoes = json.loads(obj.permissoes)
        return super().model_validate(obj)

class PerfilListResponse(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    ativo: bool
    editavel: bool
    
    class Config:
        from_attributes = True
