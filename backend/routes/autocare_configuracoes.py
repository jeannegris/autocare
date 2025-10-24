from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from db import get_db
from models.autocare_models import Configuracao, Produto
import hashlib
import os
import sys
import subprocess
from pathlib import Path
from decimal import Decimal

# Adicionar o diretório 'services' ao path para imports locais
base_dir = Path(__file__).parent.parent
services_dir = base_dir / 'services'
services_dir_str = str(services_dir)
if services_dir_str not in sys.path:
    sys.path.insert(0, services_dir_str)

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

class SystemInfoResponse(BaseModel):
    """Informações do sistema (disco e memória)"""
    disco: Dict[str, Any]
    memoria: Dict[str, Any]

class ServicesStatusResponse(BaseModel):
    """Status dos serviços da aplicação"""
    nginx: bool
    postgresql: bool
    fastapi: bool
    venv_ativo: bool

class PostgresInfoResponse(BaseModel):
    """Informações do banco de dados PostgreSQL"""
    status: str
    nome_instancia: Optional[str]
    tamanho: Optional[str]
    conexoes_ativas: Optional[int]
    versao: Optional[str]
    erro: Optional[str]

class BackupResponse(BaseModel):
    """Resposta da operação de backup"""
    sucesso: bool
    arquivo: Optional[str] = None
    tamanho_mb: Optional[float] = None
    mensagem: str
    erro: Optional[str] = None

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

# Novos endpoints de monitoramento

@router.get("/sistema/info", response_model=SystemInfoResponse)
def obter_info_sistema():
    """Retorna informações do sistema (disco e memória)"""
    try:
        from services.system_monitor import get_disk_info, get_memory_info
        
        return SystemInfoResponse(
            disco=get_disk_info(),
            memoria=get_memory_info()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter informações do sistema: {str(e)}"
        )

@router.get("/sistema/servicos", response_model=ServicesStatusResponse)
def obter_status_servicos():
    """Retorna status dos serviços (NGINX, PostgreSQL, FastAPI, venv)"""
    try:
        # Centralizar em services.system_monitor
        from services.system_monitor import get_services_status
        status_dict = get_services_status()
        return ServicesStatusResponse(**status_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter status dos serviços: {str(e)}"
        )

@router.post("/sistema/verificar-servicos", response_model=ServicesStatusResponse)
def verificar_e_iniciar_servicos():
    """Executa o script start_services.sh e retorna o status dos serviços"""
    try:
        # Executar script de inicialização
        script_path = Path(__file__).parent.parent.parent / 'start_services.sh'
        if script_path.exists():
            subprocess.run(['bash', str(script_path)], 
                         capture_output=True, 
                         text=True, 
                         timeout=30)
        
        # Retornar status atualizado centralizado
        from services.system_monitor import get_services_status
        status_dict = get_services_status()
        return ServicesStatusResponse(**status_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao verificar serviços: {str(e)}"
        )

@router.get("/postgres/info", response_model=PostgresInfoResponse)
def obter_info_postgres():
    """Retorna informações do banco de dados PostgreSQL"""
    try:
        from services.system_monitor import check_postgres_connection
        
        info = check_postgres_connection()
        return PostgresInfoResponse(**info)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter informações do PostgreSQL: {str(e)}"
        )

@router.post("/postgres/backup", response_model=BackupResponse)
def criar_backup_postgres(dados: ValidarSenhaRequest, db: Session = Depends(get_db)):
    """Cria backup do banco de dados PostgreSQL (requer senha do supervisor)"""
    
    # Validar senha do supervisor
    config_senha = db.query(Configuracao).filter(
        Configuracao.chave == "senha_supervisor"
    ).first()
    
    if not config_senha:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuração de senha não encontrada"
        )
    
    senha_hash = hash_senha(dados.senha)
    if senha_hash != config_senha.valor:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha do supervisor inválida"
        )
    
    try:
        from services.system_monitor import create_database_backup
        
        resultado = create_database_backup()
        return BackupResponse(**resultado)
    except Exception as e:
        return BackupResponse(
            sucesso=False,
            mensagem="Erro ao criar backup",
            erro=str(e)
        )
