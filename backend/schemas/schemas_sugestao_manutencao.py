from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SugestaoManutencaoBase(BaseModel):
    nome_peca: str
    km_media_troca: str
    observacoes: Optional[str] = None
    intervalo_km_min: Optional[int] = None
    intervalo_km_max: Optional[int] = None
    tipo_servico: Optional[str] = None
    ativo: bool = True
    ordem_exibicao: Optional[int] = None

class SugestaoManutencaoCreate(SugestaoManutencaoBase):
    pass

class SugestaoManutencaoUpdate(BaseModel):
    nome_peca: Optional[str] = None
    km_media_troca: Optional[str] = None
    observacoes: Optional[str] = None
    intervalo_km_min: Optional[int] = None
    intervalo_km_max: Optional[int] = None
    tipo_servico: Optional[str] = None
    ativo: Optional[bool] = None
    ordem_exibicao: Optional[int] = None

class SugestaoManutencaoResponse(SugestaoManutencaoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
