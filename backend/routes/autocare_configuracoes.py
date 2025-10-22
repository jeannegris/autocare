from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from db import get_db
from models.autocare_models import Configuracao, Produto
import hashlib
import os
from decimal import Decimal

router = APIRouter(tags=["configuracoes"])

# Schema Pydantic
from pydantic import BaseModel, Field, validator

class ConfiguracaoBase(BaseModel):
    chave: str
    valor: str
    descricao: Optional[str] = None
    tipo: str = 'string'

class ConfiguracaoCreate(ConfiguracaoBase):
    pass

class ConfiguracaoUpdate(BaseModel):
    valor: str

class ConfiguracaoResponse(ConfiguracaoBase):
    id: int
    
    class Config:
        from_attributes = True

class ValidarSenhaRequest(BaseModel):
    senha: str

class ValidarSenhaResponse(BaseModel):
    valida: bool
    mensagem: str

class AplicarMargemRequest(BaseModel):
    margem_lucro: float = Field(..., gt=0, le=1000, description="Margem de lucro em percentual (0-1000)")
    senha_supervisor: str

class AplicarMargemResponse(BaseModel):
    success: bool
    produtos_atualizados: int
    mensagem: str

# Função auxiliar para hash de senha
def hash_senha(senha: str) -> str:
    """Hash SHA256 da senha"""
    return hashlib.sha256(senha.encode()).hexdigest()

# Função auxiliar para obter ou criar configuração
def get_or_create_config(db: Session, chave: str, valor_padrao: str, descricao: str, tipo: str = 'string') -> Configuracao:
    """Obtém ou cria uma configuração"""
    config = db.query(Configuracao).filter(Configuracao.chave == chave).first()
    if not config:
        config = Configuracao(
            chave=chave,
            valor=valor_padrao,
            descricao=descricao,
            tipo=tipo
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

# ENDPOINTS

@router.get("/", response_model=List[ConfiguracaoResponse])
def listar_configuracoes(db: Session = Depends(get_db)):
    """Lista todas as configurações"""
    # Garantir que configurações padrão existam
    get_or_create_config(
        db, 
        "senha_supervisor", 
        hash_senha("admin123"),
        "Senha do supervisor para operações críticas (hash SHA256)",
        "password"
    )
    get_or_create_config(
        db,
        "margem_lucro_padrao",
        "50",
        "Margem de lucro padrão para produtos (%)",
        "number"
    )
    get_or_create_config(
        db,
        "desconto_maximo_os",
        "15",
        "Desconto máximo permitido em OS sem senha supervisor (%)",
        "number"
    )
    get_or_create_config(
        db,
        "alerta_estoque_baixo",
        "quando_atingir_estoque_minimo",
        "Alerta de estoque baixo",
        "string"
    )
    
    return db.query(Configuracao).all()

@router.get("/{chave}", response_model=ConfiguracaoResponse)
def obter_configuracao(chave: str, db: Session = Depends(get_db)):
    """Obtém uma configuração específica"""
    config = db.query(Configuracao).filter(Configuracao.chave == chave).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuração '{chave}' não encontrada"
        )
    return config

@router.put("/{chave}", response_model=ConfiguracaoResponse)
def atualizar_configuracao(
    chave: str, 
    dados: ConfiguracaoUpdate, 
    db: Session = Depends(get_db)
):
    """Atualiza uma configuração"""
    config = db.query(Configuracao).filter(Configuracao.chave == chave).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuração '{chave}' não encontrada"
        )
    
    # Se for senha, fazer hash
    if config.tipo == 'password':
        config.valor = hash_senha(dados.valor)
    else:
        config.valor = dados.valor
    
    db.commit()
    db.refresh(config)
    return config

@router.post("/validar-senha", response_model=ValidarSenhaResponse)
def validar_senha_supervisor(
    dados: ValidarSenhaRequest,
    db: Session = Depends(get_db)
):
    """Valida a senha do supervisor"""
    config = db.query(Configuracao).filter(
        Configuracao.chave == "senha_supervisor"
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuração de senha não encontrada"
        )
    
    senha_hash = hash_senha(dados.senha)
    valida = senha_hash == config.valor
    
    return ValidarSenhaResponse(
        valida=valida,
        mensagem="Senha válida" if valida else "Senha inválida"
    )

@router.post("/aplicar-margem-lucro", response_model=AplicarMargemResponse)
def aplicar_margem_lucro(
    dados: AplicarMargemRequest,
    db: Session = Depends(get_db)
):
    """Aplica margem de lucro em todos os produtos do estoque"""
    
    # Validar senha do supervisor
    config_senha = db.query(Configuracao).filter(
        Configuracao.chave == "senha_supervisor"
    ).first()
    
    if not config_senha:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuração de senha não encontrada"
        )
    
    senha_hash = hash_senha(dados.senha_supervisor)
    if senha_hash != config_senha.valor:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha do supervisor inválida"
        )
    
    # Buscar todos os produtos ativos
    produtos = db.query(Produto).filter(Produto.ativo == True).all()
    
    if not produtos:
        return AplicarMargemResponse(
            success=True,
            produtos_atualizados=0,
            mensagem="Nenhum produto ativo encontrado"
        )
    
    # Aplicar margem de lucro
    produtos_atualizados = 0
    for produto in produtos:
        if produto.preco_custo and produto.preco_custo > 0:
            # Calcular preço de venda: custo + (custo * margem%)
            margem_decimal = Decimal(str(dados.margem_lucro)) / Decimal('100')
            produto.preco_venda = produto.preco_custo * (Decimal('1') + margem_decimal)
            produtos_atualizados += 1
    
    db.commit()
    
    # Atualizar margem padrão nas configurações
    config_margem = db.query(Configuracao).filter(
        Configuracao.chave == "margem_lucro_padrao"
    ).first()
    if config_margem:
        config_margem.valor = str(dados.margem_lucro)
        db.commit()
    
    return AplicarMargemResponse(
        success=True,
        produtos_atualizados=produtos_atualizados,
        mensagem=f"Margem de {dados.margem_lucro}% aplicada em {produtos_atualizados} produto(s)"
    )
