from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime

class VeiculoBase(BaseModel):
    cliente_id: int
    marca: str
    modelo: str
    ano: int
    cor: Optional[str] = None
    placa: Optional[str] = None
    chassis: Optional[str] = None
    renavam: Optional[str] = None
    km_atual: int = 0
    combustivel: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool = True

    @validator('ano')
    def validate_ano(cls, v):
        if v < 1900 or v > 2030:
            raise ValueError('Ano deve estar entre 1900 e 2030')
        return v

    @validator('combustivel')
    def validate_combustivel(cls, v):
        if v and v not in ['GASOLINA', 'ETANOL', 'DIESEL', 'FLEX', 'GNV', 'ELETRICO', 'HIBRIDO']:
            raise ValueError('Tipo de combustível inválido')
        return v

class VeiculoCreate(VeiculoBase):
    pass

class VeiculoUpdate(BaseModel):
    cliente_id: Optional[int] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    ano: Optional[int] = None
    cor: Optional[str] = None
    placa: Optional[str] = None
    chassis: Optional[str] = None
    renavam: Optional[str] = None
    km_atual: Optional[int] = None
    combustivel: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None

class VeiculoResponse(VeiculoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Campos do frontend
    cliente_nome: Optional[str] = None
    cliente_telefone: Optional[str] = None
    total_servicos: Optional[int] = 0
    ultima_manutencao: Optional[str] = None
    proxima_manutencao: Optional[str] = None
    km_proxima_manutencao: Optional[int] = None
    status_manutencao: Optional[str] = 'EM_DIA'
    
    class Config:
        from_attributes = True

class VeiculoList(BaseModel):
    id: int
    cliente_id: int
    cliente_nome: Optional[str] = None
    cor: Optional[str] = None
    marca: str
    modelo: str
    ano: int
    placa: Optional[str] = None
    observacoes: Optional[str] = None
    km_atual: int
    combustivel: Optional[str] = None
    ativo: bool
    total_servicos: Optional[int] = 0
    
    class Config:
        from_attributes = True

class ManutencaoHistoricoBase(BaseModel):
    veiculo_id: int
    tipo: str
    descricao: str
    km_realizada: int
    data_realizada: str
    km_proxima: Optional[int] = None
    data_proxima: Optional[str] = None
    valor: Optional[float] = None
    observacoes: Optional[str] = None

class ManutencaoHistoricoCreate(ManutencaoHistoricoBase):
    pass

class ManutencaoHistoricoResponse(ManutencaoHistoricoBase):
    id: int
    
    @validator('data_realizada', 'data_proxima', pre=True)
    def convert_date_to_string(cls, v):
        if v is None:
            return None
        if hasattr(v, 'isoformat'):
            return v.isoformat()
        return str(v)
    
    class Config:
        from_attributes = True