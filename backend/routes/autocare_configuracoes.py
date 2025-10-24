from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from db import get_db
from models.autocare_models import Configuracao, Produto, Usuario
import hashlib
import os
import sys
import subprocess
import shutil
from pathlib import Path
from decimal import Decimal

# Adicionar o diretório 'services' ao path para imports locais
base_dir = Path(__file__).parent.parent
services_dir = base_dir / 'services'
services_dir_str = str(services_dir)
if services_dir_str not in sys.path:
    sys.path.insert(0, services_dir_str)

router = APIRouter(tags=["configuracoes"])
security = HTTPBearer(auto_error=False)

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
    hash: Optional[str] = None
    backup_log_id: Optional[int] = None
    mensagem: str
    erro: Optional[str] = None


class BackupLogResponse(BaseModel):
    """Resposta com informações de um log de backup"""
    id: int
    data_hora: Optional[str]
    tipo: Optional[str]
    tamanho_mb: Optional[float]
    status: Optional[str]
    hash_arquivo: Optional[str]
    caminho_arquivo: Optional[str]
    criado_por: Optional[str]
    observacoes: Optional[str]
    erro_detalhes: Optional[str]
    
    class Config:
        from_attributes = True


class RestaurarBackupRequest(BaseModel):
    """Request para restaurar backup"""
    senha: str
    confirmar: bool = True


class RestaurarBackupResponse(BaseModel):
    """Resposta da operação de restauração"""
    sucesso: bool
    mensagem: str
    erro: Optional[str] = None


class DeletarBackupResponse(BaseModel):
    """Resposta da operação de exclusão"""
    sucesso: bool
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

# ====== ENDPOINTS DE BACKUP (devem vir antes de /{chave} para evitar conflito de rota) ======

@router.get("/backups", response_model=List[BackupLogResponse])
def listar_backups(
    skip: int = 0,
    limit: int = 100,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lista todos os backups registrados com paginação e filtro por tipo"""
    from models.autocare_models import BackupLog
    
    query = db.query(BackupLog).order_by(BackupLog.data_hora.desc())
    
    if tipo:
        query = query.filter(BackupLog.tipo == tipo)
    
    backups = query.offset(skip).limit(limit).all()
    
    # Converter para dict com data_hora formatada
    result = []
    for backup in backups:
        backup_dict = {
            'id': backup.id,
            'data_hora': backup.data_hora.isoformat() if backup.data_hora else None,
            'tipo': backup.tipo,
            'tamanho_mb': backup.tamanho_mb,
            'status': backup.status,
            'hash_arquivo': backup.hash_arquivo,
            'caminho_arquivo': backup.caminho_arquivo,
            'criado_por': backup.criado_por,
            'observacoes': backup.observacoes,
            'erro_detalhes': backup.erro_detalhes
        }
        result.append(BackupLogResponse(**backup_dict))
    
    return result


@router.post("/backups/sincronizar")
def sincronizar_backups_orfaos(db: Session = Depends(get_db)):
    """
    Sincroniza backups órfãos - registra no BD arquivos de backup que existem no diretório
    mas não possuem registro no banco de dados
    """
    from models.autocare_models import BackupLog
    from pathlib import Path
    import os
    import hashlib
    import re
    from datetime import datetime
    
    # Determinar diretório de backups
    backup_dir = os.getenv('AUTOCARE_BACKUP_DIR') or '/var/backups/autocare'
    backup_path = Path(backup_dir)
    
    if not backup_path.exists():
        return {
            "sucesso": False,
            "mensagem": f"Diretório de backups não encontrado: {backup_dir}",
            "sincronizados": 0
        }
    
    # Buscar todos os registros de backup
    todos_backups = db.query(BackupLog).all()
    # Conjunto de caminhos já registrados (apenas não nulos)
    caminhos_registrados = {b.caminho_arquivo for b in todos_backups if b.caminho_arquivo}
    
    # Encontrar arquivos .sql no diretório
    arquivos_sql = list(backup_path.glob('*.sql'))
    sincronizados = []
    removidos = []

    # 1) Remover registros cujo arquivo não existe mais ou sem caminho definido
    caminhos_existentes = {str(p) for p in arquivos_sql}
    ids_para_remover = []
    print(f"[SYNC] Total de backups no BD: {len(todos_backups)}")
    print(f"[SYNC] Total de arquivos .sql no diretório: {len(arquivos_sql)}")
    print(f"[SYNC] Caminhos existentes: {caminhos_existentes}")
    
    for b in todos_backups:
        print(f"[SYNC] Verificando backup ID {b.id}: caminho={b.caminho_arquivo}")
        if not b.caminho_arquivo or b.caminho_arquivo not in caminhos_existentes:
            print(f"[SYNC] -> Marcado para remoção (arquivo não existe)")
            ids_para_remover.append(b.id)
    
    if ids_para_remover:
        print(f"[SYNC] Removendo {len(ids_para_remover)} registro(s) órfão(s): {ids_para_remover}")
        db.query(BackupLog).filter(BackupLog.id.in_(ids_para_remover)).delete(synchronize_session=False)
        removidos = ids_para_remover[:]
    
    for arquivo in arquivos_sql:
        caminho_completo = str(arquivo)
        
        # Pular se já está registrado
        if caminho_completo in caminhos_registrados:
            continue
        
        try:
            # Calcular tamanho
            tamanho_bytes = arquivo.stat().st_size
            tamanho_mb = tamanho_bytes / (1024 * 1024)
            
            # Calcular hash SHA256
            sha256_hash = hashlib.sha256()
            with open(arquivo, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            hash_arquivo = sha256_hash.hexdigest()
            
            # Extrair data do nome do arquivo (formato: autocare_backup_YYYYMMDD_HHMMSS.sql)
            match = re.search(r'(\d{8})_(\d{6})', arquivo.name)
            if match:
                data_str = match.group(1)
                hora_str = match.group(2)
                data_hora = datetime.strptime(f"{data_str}{hora_str}", "%Y%m%d%H%M%S")
            else:
                # Usar data de modificação do arquivo
                data_hora = datetime.fromtimestamp(arquivo.stat().st_mtime)
            
            # Determinar tipo (órfão = manual por padrão)
            tipo = 'manual'
            if 'diario' in arquivo.name.lower():
                tipo = 'diario'
            elif 'mensal' in arquivo.name.lower():
                tipo = 'mensal'
            
            # Criar registro no banco
            novo_backup = BackupLog(
                data_hora=data_hora,
                tipo=tipo,
                tamanho_mb=tamanho_mb,
                status='sucesso',
                hash_arquivo=hash_arquivo,
                caminho_arquivo=caminho_completo,
                criado_por='sistema',
                observacoes=f'Sincronizado automaticamente - backup órfão encontrado em {datetime.now().isoformat()}'
            )
            db.add(novo_backup)
            sincronizados.append(arquivo.name)
            
        except Exception as e:
            print(f"Erro ao sincronizar {arquivo.name}: {str(e)}")
            continue
    
    # Commit em lote para inclusões e remoções
    if sincronizados or removidos:
        db.commit()
    
    return {
        "sucesso": True,
        "mensagem": f"{len(sincronizados)} sincronizado(s), {len(removidos)} removido(s)",
        "sincronizados": sincronizados,
        "removidos": removidos,
        "total_arquivos": len(arquivos_sql),
        "total_registrados": len(caminhos_registrados) - len(removidos) + len(sincronizados)
    }


@router.post("/backups/{backup_id}/restaurar", response_model=RestaurarBackupResponse)
def restaurar_backup(
    backup_id: int,
    dados: RestaurarBackupRequest,
    db: Session = Depends(get_db)
):
    """Restaura um backup específico do banco de dados (requer senha do supervisor)"""
    from models.autocare_models import BackupLog
    from pathlib import Path
    import os
    from dotenv import load_dotenv
    
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
    
    # Buscar backup
    backup = db.query(BackupLog).filter(BackupLog.id == backup_id).first()
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup não encontrado"
        )
    
    if backup.status != 'sucesso':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Backup não pode ser restaurado. Status: {backup.status}"
        )
    
    if not backup.caminho_arquivo or not Path(backup.caminho_arquivo).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo de backup não encontrado no sistema"
        )
    
    if not dados.confirmar:
        return RestaurarBackupResponse(
            sucesso=False,
            mensagem="Restauração cancelada pelo usuário"
        )
    
    try:
        # Carregar variáveis de ambiente
        backend_dir = Path(__file__).parent.parent
        load_dotenv(backend_dir / '.env')
        load_dotenv(backend_dir.parent / '.env')
        
        # Parse DATABASE_URL
        database_url = os.getenv('DATABASE_URL', 'postgresql://autocare:autocare@localhost:5432/autocare')
        
        if database_url.startswith('postgresql://'):
            parts = database_url.replace('postgresql://', '').split('@')
            user_pass = parts[0].split(':')
            host_port_db = parts[1].split('/')
            host_port = host_port_db[0].split(':')
            
            user = user_pass[0]
            password = user_pass[1] if len(user_pass) > 1 else ''
            host = host_port[0]
            port = int(host_port[1]) if len(host_port) > 1 else 5432
            database = host_port_db[1]
        else:
            user = os.getenv('POSTGRES_USER', 'autocare')
            password = os.getenv('POSTGRES_PASSWORD', 'autocare')
            host = os.getenv('POSTGRES_SERVER', 'localhost')
            port = int(os.getenv('POSTGRES_PORT', '5432'))
            database = os.getenv('POSTGRES_DB', 'autocare')
        
        # IMPORTANTE: Tentar encerrar outras conexões ao banco antes de restaurar
        # Isso evita conflitos durante a restauração
        try:
            from sqlalchemy import create_engine, text
            admin_url = f'postgresql://{user}:{password}@{host}:{port}/postgres'
            admin_engine = create_engine(admin_url)
            
            with admin_engine.connect() as conn:
                # Encerrar todas as outras conexões ao banco de dados
                conn.execute(text(f"""
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = '{database}'
                    AND pid <> pg_backend_pid();
                """))
                conn.commit()
            
            admin_engine.dispose()
        except Exception as e:
            print(f"Aviso: Não foi possível encerrar conexões ativas: {str(e)}")
        
        # MODO MANUTENÇÃO: criar arquivo sentinela para bloquear novas requisições
        maintenance_flag = backend_dir / '.maintenance'
        try:
            maintenance_flag.write_text('maintenance-on')
        except Exception:
            # fallback em /tmp
            maintenance_flag = Path('/tmp/.autocare_maintenance')
            maintenance_flag.write_text('maintenance-on')

        # Localizar binário psql
        psql_bin = shutil.which('psql') or '/usr/bin/psql'

        # Comando psql para restaurar
        env = os.environ.copy()
        env['PGPASSWORD'] = password

        # 1) Encerrar conexões ativas (já feito acima via admin_engine), redundância segura
        # 2) Limpar o schema public para evitar conflitos (DROP SCHEMA CASCADE)
        try:
            drop_cmd = [
                psql_bin,
                '-h', host,
                '-p', str(port),
                '-U', user,
                '-d', database,
                '-v', 'ON_ERROR_STOP=1',
                '-c', "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO \"%s\";" % user
            ]
            drop_res = subprocess.run(drop_cmd, env=env, capture_output=True, text=True, timeout=120)
            if drop_res.returncode != 0:
                # Falhou na limpeza do schema: tentar fallback drop de objetos do schema public
                fallback_sql = (
                    "DO $$ DECLARE r RECORD; BEGIN "
                    "FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP "
                    "EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; "
                    "FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP "
                    "EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE'; END LOOP; "
                    "FOR r IN (SELECT routine_schema, routine_name, specific_name FROM information_schema.routines WHERE specific_schema = 'public') LOOP "
                    "EXECUTE 'DROP ROUTINE IF EXISTS public.' || quote_ident(r.routine_name) || '() CASCADE'; END LOOP; "
                    "FOR r IN (SELECT viewname FROM pg_views WHERE schemaname='public') LOOP "
                    "EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE'; END LOOP; "
                    "END $$;"
                )
                drop_cmd2 = [
                    psql_bin, '-h', host, '-p', str(port), '-U', user, '-d', database,
                    '-v', 'ON_ERROR_STOP=1', '-c', fallback_sql
                ]
                drop_res2 = subprocess.run(drop_cmd2, env=env, capture_output=True, text=True, timeout=180)
                if drop_res2.returncode != 0:
                    erro_msg = drop_res.stderr + "\n" + drop_res2.stderr if drop_res2.stderr else (drop_res.stderr or 'Falha ao limpar objetos do schema public')
                    return RestaurarBackupResponse(
                        sucesso=False,
                        mensagem='❌ Falha na restauração do backup',
                        erro=erro_msg[:500]
                    )
        except Exception as e:
            return RestaurarBackupResponse(
                sucesso=False,
                mensagem='❌ Falha na restauração do backup',
                erro=str(e)[:500]
            )

        cmd = [
            psql_bin,
            '-h', host,
            '-p', str(port),
            '-U', user,
            '-d', database,
            '-f', backup.caminho_arquivo,
            '-v', 'ON_ERROR_STOP=1',  # Para na primeira erro
            '-q'  # Modo silencioso
        ]
        
        # Executar restauração com timeout de 300 segundos (5 minutos)
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)

        if result.returncode == 0:
            # Sucesso na restauração: reconstruir tabela backup_logs para refletir arquivos reais
            try:
                from db import SessionLocal
                from models.autocare_models import BackupLog as BL
                import hashlib, re
                from datetime import datetime as dt

                sync_db = SessionLocal()
                try:
                    backup_dir = os.getenv('AUTOCARE_BACKUP_DIR') or '/var/backups/autocare'
                    bp = Path(backup_dir)
                    arquivos_sql = list(bp.glob('*.sql')) if bp.exists() else []
                    caminhos_existentes = {str(p) for p in arquivos_sql}

                    # Remover registros ausentes ou sem caminho
                    todos = sync_db.query(BL).all()
                    ids_remove = [b.id for b in todos if (not b.caminho_arquivo) or (b.caminho_arquivo not in caminhos_existentes)]
                    if ids_remove:
                        sync_db.query(BL).filter(BL.id.in_(ids_remove)).delete(synchronize_session=False)

                    # Mapear já registrados
                    registrados = {b.caminho_arquivo for b in todos if b.caminho_arquivo}
                    for arq in arquivos_sql:
                        caminho = str(arq)
                        if caminho in registrados:
                            continue
                        # calcular metadados
                        tamanho_mb = arq.stat().st_size / (1024*1024)
                        sha256_hash = hashlib.sha256()
                        with open(arq, 'rb') as f:
                            for bb in iter(lambda: f.read(4096), b""):
                                sha256_hash.update(bb)
                        hash_arquivo = sha256_hash.hexdigest()
                        m = re.search(r'(\d{8})_(\d{6})', arq.name)
                        if m:
                            dh = dt.strptime(m.group(1)+m.group(2), '%Y%m%d%H%M%S')
                        else:
                            dh = dt.fromtimestamp(arq.stat().st_mtime)
                        novo = BL(
                            data_hora=dh,
                            tipo='manual',
                            tamanho_mb=tamanho_mb,
                            status='sucesso',
                            hash_arquivo=hash_arquivo,
                            caminho_arquivo=caminho,
                            criado_por='sistema',
                            observacoes=f'Sincronizado automaticamente após restauração em {dt.now().isoformat()}'
                        )
                        sync_db.add(novo)
                    sync_db.commit()
                finally:
                    try:
                        sync_db.close()
                    except Exception:
                        pass
            except Exception:
                # Não falhar a resposta por causa da sincronização; já restaurou com sucesso
                pass

            return RestaurarBackupResponse(
                sucesso=True,
                mensagem=f"✅ Backup restaurado com sucesso! O banco de dados foi restaurado para o estado de {backup.data_hora.strftime('%d/%m/%Y às %H:%M:%S') if backup.data_hora else 'backup'}"
            )
        else:
            erro_msg = result.stderr if result.stderr else "Erro desconhecido durante a restauração"
            return RestaurarBackupResponse(
                sucesso=False,
                mensagem="❌ Falha na restauração do backup",
                erro=erro_msg[:500]  # Limitar tamanho do erro
            )
    
    except Exception as e:
        return RestaurarBackupResponse(
            sucesso=False,
            mensagem="Erro ao restaurar backup",
            erro=str(e)
        )
    finally:
        # Desativar modo manutenção (sempre tentar remover)
        try:
            if 'maintenance_flag' in locals() and maintenance_flag.exists():
                maintenance_flag.unlink(missing_ok=True)
        except Exception:
            pass


@router.delete("/backups/{backup_id}", response_model=DeletarBackupResponse)
def deletar_backup(
    backup_id: int,
    dados: ValidarSenhaRequest,
    db: Session = Depends(get_db)
):
    """Exclui um backup (arquivo e registro) - requer senha do supervisor"""
    from models.autocare_models import BackupLog
    
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
    
    # Buscar backup
    backup = db.query(BackupLog).filter(BackupLog.id == backup_id).first()
    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup não encontrado"
        )
    
    try:
        # Remover arquivo físico se existir
        if backup.caminho_arquivo and Path(backup.caminho_arquivo).exists():
            Path(backup.caminho_arquivo).unlink()
        
        # Remover registro do banco
        db.delete(backup)
        db.commit()
        
        return DeletarBackupResponse(
            sucesso=True,
            mensagem=f"Backup #{backup_id} excluído com sucesso"
        )
    
    except Exception as e:
        return DeletarBackupResponse(
            sucesso=False,
            mensagem=f"Erro ao excluir backup: {str(e)}"
        )

# ====== FIM DOS ENDPOINTS DE BACKUP ======

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

# Aliases legados para compatibilidade
@router.get("/servicos", response_model=ServicesStatusResponse)
def obter_status_servicos_legacy():
    """Alias legado para status dos serviços"""
    return obter_status_servicos()

@router.post("/servicos/verificar", response_model=ServicesStatusResponse)
def verificar_e_iniciar_servicos_legacy():
    """Alias legado para verificação/inicialização dos serviços"""
    return verificar_e_iniciar_servicos()

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
        
        resultado = create_database_backup(tipo='manual', criado_por='supervisor', db_session=db)
        return BackupResponse(**resultado)
    except Exception as e:
        return BackupResponse(
            sucesso=False,
            mensagem="Erro ao criar backup",
            erro=str(e)
        )


# Helper para obter usuário opcional (sem exigir autenticação)
def _get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials], db: Session) -> Optional[Usuario]:
    """Retorna usuário atual ou None se não autenticado"""
    if not credentials:
        return None
    try:
        from routes.autocare_auth import get_current_user
        from fastapi.security import HTTPBearer
        security_scheme = HTTPBearer()
        return get_current_user(credentials, db)
    except:
        return None


# ===== ENDPOINTS DE GESTÃO DE BACKUPS (schemas definidos no topo do arquivo) =====
