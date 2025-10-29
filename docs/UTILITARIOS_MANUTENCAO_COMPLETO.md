# Utilitários de Manutenção – Documentação Completa de Implementação

> **Objetivo**: Documentação técnica detalhada para replicar os utilitários de manutenção (Banco de Dados, Servidor e Serviços) em outra aplicação.

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Banco de Dados - Schema e Modelos](#banco-de-dados---schema-e-modelos)
3. [Backend - Estrutura e Implementação](#backend---estrutura-e-implementação)
4. [Frontend - Interface e Fluxos](#frontend---interface-e-fluxos)
5. [Tarefas Agendadas (Celery)](#tarefas-agendadas-celery)
6. [Guia de Implantação Passo a Passo](#guia-de-implantação-passo-a-passo)
7. [Casos de Uso e Fluxos Completos](#casos-de-uso-e-fluxos-completos)
8. [Troubleshooting e Boas Práticas](#troubleshooting-e-boas-práticas)

---

## Visão Geral da Arquitetura

### Stack Tecnológico

**Backend**:
- FastAPI (rotas e API REST)
- SQLAlchemy (ORM)
- psutil (métricas de sistema)
- psycopg2 (conexão PostgreSQL)
- subprocess (chamadas pg_dump/psql/systemctl)
- Celery + Redis (tarefas agendadas)
- python-dotenv (variáveis de ambiente)

**Frontend**:
- React 18 + TypeScript
- TanStack Query (gerenciamento de estado servidor)
- Tailwind CSS (estilização)
- lucide-react (ícones)
- sonner (notificações toast)

**Infraestrutura**:
- PostgreSQL (banco de dados)
- NGINX (proxy reverso)
- Redis (broker Celery)
- Systemd (gerenciamento de serviços)

### Arquitetura de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Card BD     │  │ Card Servidor│  │ Card Serviços│      │
│  │  - Backups   │  │  - Disco     │  │  - NGINX     │      │
│  │  - Restaurar │  │  - Memória   │  │  - PostgreSQL│      │
│  │  - Excluir   │  │  - Swap      │  │  - FastAPI   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        autocare_configuracoes.py (Router)            │   │
│  │  - Endpoints de Backup/Restauração/Exclusão         │   │
│  │  - Endpoints de Métricas do Sistema                 │   │
│  │  - Endpoints de Status de Serviços                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↕                                  │
│  ┌────────────────────┐  ┌───────────────────────────┐      │
│  │ system_monitor.py  │  │   celery_tasks.py         │      │
│  │ - get_disk_info()  │  │   - backup_diario_task    │      │
│  │ - get_memory_info()│  │   - backup_mensal_task    │      │
│  │ - get_services()   │  │   - (outros alertas)      │      │
│  │ - pg_dump/psql     │  └───────────────────────────┘      │
│  └────────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                BANCO DE DADOS (PostgreSQL)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tabela: backup_logs                                 │   │
│  │  - Auditoria de backups                              │   │
│  │  - Metadados (hash, tamanho, status)                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tabela: configuracoes                               │   │
│  │  - senha_supervisor (hash SHA256)                    │   │
│  │  - margem_lucro_padrao, desconto_maximo_os, etc     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Componentes e Responsabilidades

| Arquivo | Responsabilidade | Dependências |
|---------|------------------|--------------|
| `backend/routes/autocare_configuracoes.py` | Endpoints REST, validação de senha supervisor, orquestração | FastAPI, SQLAlchemy, system_monitor |
| `backend/services/system_monitor.py` | Coleta de métricas, execução pg_dump/psql, detecção de serviços | psutil, subprocess, psycopg2 |
| `backend/services/celery_tasks.py` | Backups agendados (diário/mensal), limpeza de backups antigos | Celery, Redis, system_monitor |
| `backend/models/autocare_models.py` | Modelo `BackupLog` para auditoria | SQLAlchemy |
| `frontend/src/pages/Configuracoes.tsx` | Interface dos 3 cards, modais, overlays | React, TanStack Query, Tailwind |

---

## Banco de Dados - Schema e Modelos

### 1. Tabela `backup_logs`

**Propósito**: Auditoria completa de todas as operações de backup do banco de dados.

**Script de Criação SQL**:

```sql
CREATE TABLE backup_logs (
    id SERIAL PRIMARY KEY,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    tipo VARCHAR(20) NOT NULL,  -- 'manual', 'diario', 'mensal'
    tamanho_mb DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL DEFAULT 'sucesso',  -- 'sucesso', 'erro', 'em_progresso'
    hash_arquivo VARCHAR(64),  -- SHA256 do arquivo
    caminho_arquivo TEXT,
    criado_por VARCHAR(100),  -- username ou 'sistema'
    observacoes TEXT,
    erro_detalhes TEXT
);

CREATE INDEX idx_backup_logs_data_hora ON backup_logs(data_hora DESC);
CREATE INDEX idx_backup_logs_tipo ON backup_logs(tipo);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
```

**Modelo SQLAlchemy** (`backend/models/autocare_models.py`):

```python
from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from sqlalchemy.sql import func
from db import Base

class BackupLog(Base):
    """Registro de auditoria de backups do banco de dados"""
    __tablename__ = "backup_logs"

    id = Column(Integer, primary_key=True, index=True)
    data_hora = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    tipo = Column(String(20), nullable=False, index=True)  # 'manual', 'diario', 'mensal'
    tamanho_mb = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default='sucesso')  # 'sucesso', 'erro', 'em_progresso'
    hash_arquivo = Column(String(64), nullable=True)  # SHA256
    caminho_arquivo = Column(Text, nullable=True)
    criado_por = Column(String(100), nullable=True)  # username ou 'sistema'
    observacoes = Column(Text, nullable=True)
    erro_detalhes = Column(Text, nullable=True)

    def __repr__(self):
        return f"<BackupLog(id={self.id}, tipo={self.tipo}, data_hora={self.data_hora}, status={self.status})>"
```

**Campos e Significados**:

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | Integer | Sim | Identificador único |
| `data_hora` | DateTime(tz) | Sim | Timestamp da criação do backup |
| `tipo` | String(20) | Sim | Tipo: 'manual', 'diario', 'mensal' |
| `tamanho_mb` | Float | Não | Tamanho do arquivo em MB |
| `status` | String(20) | Sim | Status: 'sucesso', 'erro', 'em_progresso' |
| `hash_arquivo` | String(64) | Não | Hash SHA256 para verificação de integridade |
| `caminho_arquivo` | Text | Não | Caminho completo do arquivo .sql |
| `criado_por` | String(100) | Não | Username do criador ou 'sistema' |
| `observacoes` | Text | Não | Notas adicionais |
| `erro_detalhes` | Text | Não | Detalhes técnicos em caso de erro |

**Ciclo de Vida de um Registro**:

```
1. Criação: status='em_progresso', caminho_arquivo=None
2. Durante pg_dump: arquivo sendo gerado
3. Sucesso: status='sucesso', tamanho_mb preenchido, hash_arquivo calculado
4. Erro: status='erro', erro_detalhes preenchido
```

### 2. Tabela `configuracoes`

**Propósito**: Armazenar configurações da aplicação, incluindo senha do supervisor.

**Script de Criação SQL**:

```sql
CREATE TABLE configuracoes (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao TEXT,
    tipo VARCHAR(50) DEFAULT 'string',  -- 'string', 'number', 'boolean', 'password'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_configuracoes_chave ON configuracoes(chave);
```

**Configurações Padrão Criadas Automaticamente**:

```python
# Em autocare_configuracoes.py - função get_or_create_config()
{
    "senha_supervisor": {
        "valor": hash_sha256("admin123"),  # Mudar em produção!
        "descricao": "Senha do supervisor para operações críticas (hash SHA256)",
        "tipo": "password"
    },
    "margem_lucro_padrao": {
        "valor": "50",
        "descricao": "Margem de lucro padrão para produtos (%)",
        "tipo": "number"
    },
    "desconto_maximo_os": {
        "valor": "15",
        "descricao": "Desconto máximo permitido em OS sem senha supervisor (%)",
        "tipo": "number"
    },
    "alerta_estoque_baixo": {
        "valor": "quando_atingir_estoque_minimo",
        "descricao": "Alerta de estoque baixo",
        "tipo": "string"
    }
}
```

**Modelo SQLAlchemy**:

```python
class Configuracao(Base):
    __tablename__ = "configuracoes"
    
    id = Column(Integer, primary_key=True, index=True)
    chave = Column(String(100), unique=True, nullable=False, index=True)
    valor = Column(Text, nullable=False)
    descricao = Column(Text)
    tipo = Column(String(50), default='string')  # string, number, boolean, password
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### 3. Migração Alembic

**Criar Migração** (se usando Alembic):

```bash
# Gerar arquivo de migração
alembic revision -m "add_backup_logs_and_configuracoes"
```

**Exemplo de Arquivo de Migração**:

```python
"""add_backup_logs_and_configuracoes

Revision ID: abc123def456
Revises: previous_revision
Create Date: 2025-10-29 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'abc123def456'
down_revision = 'previous_revision'
branch_labels = None
depends_on = None

def upgrade():
    # Criar tabela backup_logs
    op.create_table(
        'backup_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('data_hora', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('tamanho_mb', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('hash_arquivo', sa.String(length=64), nullable=True),
        sa.Column('caminho_arquivo', sa.Text(), nullable=True),
        sa.Column('criado_por', sa.String(length=100), nullable=True),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('erro_detalhes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_backup_logs_data_hora', 'backup_logs', ['data_hora'], unique=False)
    op.create_index('idx_backup_logs_tipo', 'backup_logs', ['tipo'], unique=False)
    
    # Criar tabela configuracoes
    op.create_table(
        'configuracoes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('chave', sa.String(length=100), nullable=False),
        sa.Column('valor', sa.Text(), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('tipo', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chave')
    )
    op.create_index('idx_configuracoes_chave', 'configuracoes', ['chave'], unique=False)

def downgrade():
    op.drop_index('idx_configuracoes_chave', table_name='configuracoes')
    op.drop_table('configuracoes')
    op.drop_index('idx_backup_logs_tipo', table_name='backup_logs')
    op.drop_index('idx_backup_logs_data_hora', table_name='backup_logs')
    op.drop_table('backup_logs')
```

**Aplicar Migração**:

```bash
alembic upgrade head
```

---

## Backend - Estrutura e Implementação

---

## Backend - Estrutura e Implementação

### 1. Dependências Necessárias

**requirements.txt**:

```txt
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.9
alembic>=1.12.0
python-dotenv>=1.0.0
psutil>=5.9.6
celery>=5.3.4
redis>=5.0.1
pydantic>=2.0.0
```

**Instalar**:

```bash
pip install -r requirements.txt
```

### 2. Variáveis de Ambiente

**Arquivo `.env`** (backend):

```bash
# Banco de Dados
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_banco

# Alternativas (se DATABASE_URL não estiver definido)
POSTGRES_USER=autocare
POSTGRES_PASSWORD=senha_segura
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_DB=autocare

# Diretório de Backups (opcional, usa fallback se não definido)
AUTOCARE_BACKUP_DIR=/var/backups/autocare

# Celery
REDIS_URL=redis://localhost:6379/0

# Aplicação
SECRET_KEY=chave_secreta_aqui
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### 3. Services - system_monitor.py

**Localização**: `backend/services/system_monitor.py`

**Propósito**: Módulo central para coleta de métricas do sistema e operações com PostgreSQL.

#### 3.1. Função: get_disk_info()

```python
import psutil

def get_disk_info():
    """Retorna informações de uso de disco"""
    try:
        disk = psutil.disk_usage('/')
        return {
            'total_gb': round(disk.total / (1024**3), 2),
            'usado_gb': round(disk.used / (1024**3), 2),
            'livre_gb': round(disk.free / (1024**3), 2),
            'percentual_usado': round(disk.percent, 1)
        }
    except Exception:
        # Fallback seguro para ambientes limitados
        return {
            'total_gb': 0,
            'usado_gb': 0,
            'livre_gb': 0,
            'percentual_usado': 0
        }
```

**Retorno Exemplo**:
```json
{
  "total_gb": 250.5,
  "usado_gb": 180.3,
  "livre_gb": 70.2,
  "percentual_usado": 72.0
}
```

#### 3.2. Função: get_memory_info()

```python
def get_memory_info():
    """Retorna informações de uso de memória RAM e Swap"""
    try:
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        return {
            'memoria_total_gb': round(memory.total / (1024**3), 2),
            'memoria_usada_gb': round(memory.used / (1024**3), 2),
            'memoria_livre_gb': round(memory.available / (1024**3), 2),
            'memoria_percentual': round(memory.percent, 1),
            'swap_total_gb': round(swap.total / (1024**3), 2),
            'swap_usada_gb': round(swap.used / (1024**3), 2),
            'swap_livre_gb': round(swap.free / (1024**3), 2),
            'swap_percentual': round(swap.percent, 1)
        }
    except Exception:
        return {
            'memoria_total_gb': 0,
            'memoria_usada_gb': 0,
            'memoria_livre_gb': 0,
            'memoria_percentual': 0,
            'swap_total_gb': 0,
            'swap_usada_gb': 0,
            'swap_livre_gb': 0,
            'swap_percentual': 0
        }
```

#### 3.3. Função: get_services_status()

```python
import subprocess

def _any_process_matches(names):
    """Helper para detectar processos por nome ou cmdline"""
    try:
        for proc in psutil.process_iter(['name', 'cmdline']):
            name = (proc.info.get('name') or '').lower()
            cmdline = ' '.join(proc.info.get('cmdline') or []).lower()
            for n in names:
                nl = n.lower()
                if nl in name or nl in cmdline:
                    return True
    except Exception:
        pass
    return False

def get_services_status():
    """Retorna status dos serviços necessários para a aplicação"""
    services = {}

    # 1. Verificar NGINX (systemctl + fallback por processo)
    nginx_active = False
    try:
        result = subprocess.run(
            ['systemctl', 'is-active', 'nginx'],
            capture_output=True,
            text=True,
            timeout=5
        )
        nginx_active = result.stdout.strip() == 'active'
    except Exception:
        pass
    if not nginx_active:
        nginx_active = _any_process_matches(['nginx'])
    services['nginx'] = bool(nginx_active)

    # 2. Verificar PostgreSQL (systemctl + fallback por processo)
    pg_active = False
    try:
        result = subprocess.run(
            ['systemctl', 'is-active', 'postgresql'],
            capture_output=True,
            text=True,
            timeout=5
        )
        pg_active = result.stdout.strip() == 'active'
    except Exception:
        pass
    if not pg_active:
        pg_active = _any_process_matches(['postgres', 'postgresql'])
    services['postgresql'] = bool(pg_active)

    # 3. Verificar processo do Uvicorn/FastAPI
    fastapi_active = False
    try:
        for proc in psutil.process_iter(['name', 'cmdline']):
            name = (proc.info.get('name') or '').lower()
            cmdline = ' '.join(proc.info.get('cmdline') or []).lower()
            if 'uvicorn' in name or 'uvicorn' in cmdline:
                if 'server:app' in cmdline or ':app' in cmdline or 'backend/server.py' in cmdline:
                    fastapi_active = True
                    break
    except Exception:
        pass
    services['fastapi'] = bool(fastapi_active)

    # 4. Verificar se está em ambiente virtual Python
    try:
        import sys as _sys
        venv_ativo = hasattr(_sys, 'real_prefix') or (
            hasattr(_sys, 'base_prefix') and _sys.base_prefix != _sys.prefix
        )
    except Exception:
        venv_ativo = bool(os.environ.get('VIRTUAL_ENV'))
    services['venv_ativo'] = venv_ativo

    return services
```

**Retorno Exemplo**:
```json
{
  "nginx": true,
  "postgresql": true,
  "fastapi": true,
  "venv_ativo": true
}
```

#### 3.4. Função: check_postgres_connection()

```python
import psycopg2
from urllib.parse import urlparse, unquote
from pathlib import Path
from dotenv import load_dotenv

def check_postgres_connection():
    """Verifica conexão com PostgreSQL e retorna informações básicas"""
    try:
        # Carregar variáveis de ambiente
        backend_dir = Path(__file__).parent.parent
        load_dotenv(backend_dir / '.env')
        load_dotenv(backend_dir.parent / '.env')

        # Obter DATABASE_URL e normalizar driver se necessário
        database_url = os.getenv('DATABASE_URL', 'postgresql://autocare:autocare@localhost:5432/autocare')
        if database_url.startswith('postgresql+psycopg2://'):
            database_url = 'postgresql://' + database_url.split('postgresql+psycopg2://', 1)[1]

        conn = None
        # Tentar conectar diretamente via DSN/URI
        try:
            conn = psycopg2.connect(database_url)
        except Exception:
            # Fallback: fazer parse via urlparse
            parsed = urlparse(database_url)
            user = unquote(parsed.username or os.getenv('POSTGRES_USER', 'autocare'))
            password = unquote(parsed.password or os.getenv('POSTGRES_PASSWORD', 'autocare'))
            host = parsed.hostname or os.getenv('POSTGRES_SERVER', 'localhost')
            port = int(parsed.port or os.getenv('POSTGRES_PORT', '5432'))
            database = (parsed.path or '/autocare').lstrip('/') or os.getenv('POSTGRES_DB', 'autocare')
            conn = psycopg2.connect(host=host, port=port, dbname=database, user=user, password=password)

        cursor = conn.cursor()

        # Nome da instância/database
        cursor.execute("SELECT current_database();")
        db_name = cursor.fetchone()[0]

        # Tamanho do banco
        cursor.execute("SELECT pg_size_pretty(pg_database_size(current_database()));")
        db_size = cursor.fetchone()[0]

        # Número de conexões ativas
        cursor.execute("""
            SELECT count(*) FROM pg_stat_activity 
            WHERE state = 'active';
        """)
        active_connections = cursor.fetchone()[0]

        # Versão do PostgreSQL
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0].split(',')[0]

        cursor.close()
        conn.close()

        return {
            'status': 'online',
            'nome_instancia': db_name,
            'tamanho': db_size,
            'conexoes_ativas': active_connections,
            'versao': version,
            'erro': None
        }
    except Exception as e:
        return {
            'status': 'offline',
            'nome_instancia': None,
            'tamanho': None,
            'conexoes_ativas': None,
            'versao': None,
            'erro': str(e)
        }
```

#### 3.5. Função: create_database_backup()

**Função Completa com Estratégia de Diretório e Logging**:

```python
import hashlib
import shutil
from datetime import datetime

def create_database_backup(tipo='manual', criado_por='sistema', db_session=None):
    """
    Cria backup do banco de dados PostgreSQL.
    
    Estratégia de Diretório (tentados em ordem):
      1) AUTOCARE_BACKUP_DIR (se definido)
      2) /var/backups/autocare (com chmod 777)
      3) ~/autocare_backups
      4) ./backups
      5) /tmp/autocare_backups
    
    Args:
        tipo: 'manual', 'diario' ou 'mensal'
        criado_por: username ou 'sistema'
        db_session: sessão do BD para registro de log (se None, cria uma nova)
    
    Returns:
        dict: {sucesso, arquivo, tamanho_mb, hash, backup_log_id, mensagem, erro}
    """
    from models.autocare_models import BackupLog
    from db import SessionLocal
    
    # Criar sessão se não fornecida
    close_session = False
    if db_session is None:
        db_session = SessionLocal()
        close_session = True
    
    # Criar registro de log inicial
    backup_log = BackupLog(
        tipo=tipo,
        status='em_progresso',
        criado_por=criado_por
    )
    db_session.add(backup_log)
    db_session.commit()
    db_session.refresh(backup_log)
    
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

        # Resolver diretório de backup com estratégia de queda
        env_backup_dir = os.getenv('AUTOCARE_BACKUP_DIR')
        
        def test_write_permission(dir_path):
            """Testa se consegue escrever no diretório"""
            try:
                test_file = dir_path / '.test_write'
                test_file.write_text('test')
                test_file.unlink()
                return True
            except Exception:
                return False
        
        # Tentar diretórios em ordem de preferência
        backup_dir = None
        candidates = []
        
        if env_backup_dir:
            candidates.append(Path(env_backup_dir))
        else:
            candidates.extend([
                Path('/var/backups/autocare'),
                Path.home() / 'autocare_backups',
                Path.cwd() / 'backups',
                Path('/tmp/autocare_backups')
            ])
        
        for candidate in candidates:
            try:
                # Criar diretório se não existir
                candidate.mkdir(parents=True, exist_ok=True)
                
                # Para /var/backups/autocare, garantir permissões 777
                if str(candidate) == '/var/backups/autocare':
                    try:
                        import stat
                        candidate.chmod(stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
                    except Exception:
                        try:
                            subprocess.run(
                                ['sudo', 'chmod', '777', str(candidate)],
                                check=True,
                                capture_output=True
                            )
                        except Exception:
                            pass
                
                if test_write_permission(candidate):
                    backup_dir = candidate
                    break
            except Exception:
                continue
        
        if not backup_dir:
            raise Exception("Nenhum diretório de backup com permissão de escrita disponível")

        # Nome do arquivo de backup com timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = backup_dir / f'autocare_backup_{timestamp}.sql'

        # Localizar binário pg_dump
        pg_dump_bin = shutil.which('pg_dump') or '/usr/bin/pg_dump'
        
        # Comando pg_dump
        env = os.environ.copy()
        env['PGPASSWORD'] = password

        cmd = [
            pg_dump_bin,
            '-h', host,
            '-p', str(port),
            '-U', user,
            '-d', database,
            '-F', 'p',  # Plain text format
            '--clean',  # Adiciona comandos DROP antes dos CREATE
            '--if-exists',  # Usa DROP IF EXISTS (mais seguro)
            '-f', str(backup_file)
        ]

        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)

        if result.returncode == 0:
            # Verificar tamanho do arquivo de backup
            file_size = backup_file.stat().st_size / (1024 * 1024)  # MB
            
            # Calcular hash SHA256
            sha256_hash = hashlib.sha256()
            with open(backup_file, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            file_hash = sha256_hash.hexdigest()
            
            # Atualizar registro de log com sucesso
            backup_log.status = 'sucesso'
            backup_log.tamanho_mb = round(file_size, 2)
            backup_log.hash_arquivo = file_hash
            backup_log.caminho_arquivo = str(backup_file)
            db_session.commit()
            
            if close_session:
                db_session.close()
            
            return {
                'sucesso': True,
                'arquivo': str(backup_file),
                'tamanho_mb': round(file_size, 2),
                'hash': file_hash,
                'backup_log_id': backup_log.id,
                'mensagem': f'Backup criado com sucesso: {backup_file}'
            }
        else:
            # Atualizar registro com erro
            backup_log.status = 'erro'
            backup_log.erro_detalhes = result.stderr
            db_session.commit()
            
            if close_session:
                db_session.close()
            
            return {
                'sucesso': False,
                'erro': result.stderr,
                'backup_log_id': backup_log.id,
                'mensagem': f'Erro ao criar backup do banco de dados (pg_dump exit {result.returncode})'
            }
    except Exception as e:
        # Atualizar registro com erro de exceção
        try:
            backup_log.status = 'erro'
            backup_log.erro_detalhes = str(e)
            db_session.commit()
            backup_log_id = backup_log.id
        except:
            backup_log_id = None
        
        if close_session:
            try:
                db_session.close()
            except:
                pass
        
        return {
            'sucesso': False,
            'erro': str(e),
            'backup_log_id': backup_log_id,
            'mensagem': 'Erro ao criar backup do banco de dados'
        }
```

**Diagrama de Fluxo - create_database_backup()**:

```
Início
  ↓
Criar registro BackupLog (status='em_progresso')
  ↓
Carregar env (DATABASE_URL)
  ↓
Parse credenciais do banco
  ↓
Resolver diretório de backup:
  1. AUTOCARE_BACKUP_DIR?
  2. /var/backups/autocare (chmod 777)?
  3. ~/autocare_backups?
  4. ./backups?
  5. /tmp/autocare_backups?
  ↓
Testar permissão de escrita em cada um
  ↓
Gerar nome do arquivo: autocare_backup_YYYYMMDD_HHMMSS.sql
  ↓
Executar pg_dump com flags --clean --if-exists
  ↓
Sucesso? ───┐
  ↓  Não     │ Sim
  │          ↓
  │      Calcular tamanho (MB)
  │          ↓
  │      Calcular hash SHA256
  │          ↓
  │      Atualizar log (status='sucesso')
  │          ↓
  │      Retornar {sucesso: true, ...}
  │
  ↓ (Erro)
Atualizar log (status='erro', erro_detalhes)
  ↓
Retornar {sucesso: false, erro: ...}
  ↓
Fim
```

### 4. Routes - autocare_configuracoes.py

**Localização**: `backend/routes/autocare_configuracoes.py`

#### 4.1. Schemas Pydantic

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ValidarSenhaRequest(BaseModel):
    senha: str

class ValidarSenhaResponse(BaseModel):
    valida: bool
    mensagem: str

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

class VerificarServicosLogsResponse(BaseModel):
    """Resposta com logs da execução do script de verificação"""
    sucesso: bool
    logs: str
    mensagem: str
```

#### 4.2. Helper - Hash de Senha

```python
import hashlib

def hash_senha(senha: str) -> str:
    """Hash SHA256 da senha"""
    return hashlib.sha256(senha.encode()).hexdigest()
```

#### 4.3. Endpoints - Banco de Dados

**4.3.1. POST /configuracoes/postgres/backup - Criar Backup**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db import get_db

router = APIRouter(tags=["configuracoes"])

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
```

**4.3.2. GET /configuracoes/backups - Listar Backups**

```python
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
```

**4.3.3. POST /configuracoes/backups/sincronizar - Sincronizar Órfãos**

```python
@router.post("/backups/sincronizar")
def sincronizar_backups_orfaos(db: Session = Depends(get_db)):
    """
    Sincroniza backups órfãos - registra no BD arquivos de backup que existem no diretório
    mas não possuem registro no banco de dados
    """
    from models.autocare_models import BackupLog
    from pathlib import Path
    import os, hashlib, re
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
    caminhos_registrados = {b.caminho_arquivo for b in todos_backups if b.caminho_arquivo}
    
    # Encontrar arquivos .sql no diretório
    arquivos_sql = list(backup_path.glob('*.sql'))
    sincronizados = []
    removidos = []

    # Remover registros cujo arquivo não existe mais
    caminhos_existentes = {str(p) for p in arquivos_sql}
    ids_para_remover = []
    
    for b in todos_backups:
        if not b.caminho_arquivo or b.caminho_arquivo not in caminhos_existentes:
            ids_para_remover.append(b.id)
    
    if ids_para_remover:
        db.query(BackupLog).filter(BackupLog.id.in_(ids_para_remover)).delete(synchronize_session=False)
        removidos = ids_para_remover[:]
    
    # Adicionar registros para arquivos sem registro
    for arquivo in arquivos_sql:
        caminho_completo = str(arquivo)
        
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
            
            # Extrair data do nome do arquivo
            match = re.search(r'(\d{8})_(\d{6})', arquivo.name)
            if match:
                data_str = match.group(1)
                hora_str = match.group(2)
                data_hora = datetime.strptime(f"{data_str}{hora_str}", "%Y%m%d%H%M%S")
            else:
                data_hora = datetime.fromtimestamp(arquivo.stat().st_mtime)
            
            # Determinar tipo
            tipo = 'manual'
            if 'diario' in arquivo.name.lower():
                tipo = 'diario'
            elif 'mensal' in arquivo.name.lower():
                tipo = 'mensal'
            
            # Criar registro
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
```

**4.3.4. POST /configuracoes/backups/{backup_id}/restaurar - Restaurar Backup**

```python
@router.post("/backups/{backup_id}/restaurar", response_model=RestaurarBackupResponse)
def restaurar_backup(
    backup_id: int,
    dados: RestaurarBackupRequest,
    db: Session = Depends(get_db)
):
    """
    Restaura um backup específico do banco de dados (requer senha do supervisor)
    
    ATENÇÃO: Esta operação:
    - Encerra todas as conexões ativas ao banco
    - Remove o schema public e recria do zero
    - Pode levar vários minutos dependendo do tamanho do banco
    - Coloca o sistema em modo manutenção durante a execução
    """
    from models.autocare_models import BackupLog
    from pathlib import Path
    from dotenv import load_dotenv
    
    # 1. Validar senha do supervisor
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
    
    # 2. Buscar backup
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
        # 3. Carregar variáveis de ambiente
        backend_dir = Path(__file__).parent.parent
        load_dotenv(backend_dir / '.env')
        load_dotenv(backend_dir.parent / '.env')
        
        # 4. Parse DATABASE_URL
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
        
        # 5. Encerrar conexões ativas
        try:
            from sqlalchemy import create_engine, text
            admin_url = f'postgresql://{user}:{password}@{host}:{port}/postgres'
            admin_engine = create_engine(admin_url)
            
            with admin_engine.connect() as conn:
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
        
        # 6. Ativar modo manutenção
        maintenance_flag = backend_dir / '.maintenance'
        try:
            maintenance_flag.write_text('maintenance-on')
        except Exception:
            maintenance_flag = Path('/tmp/.autocare_maintenance')
            maintenance_flag.write_text('maintenance-on')

        # 7. Localizar binário psql
        psql_bin = shutil.which('psql') or '/usr/bin/psql'
        env = os.environ.copy()
        env['PGPASSWORD'] = password

        # 8. Limpar schema public
        try:
            drop_cmd = [
                psql_bin,
                '-h', host,
                '-p', str(port),
                '-U', user,
                '-d', database,
                '-v', 'ON_ERROR_STOP=1',
                '-c', f"DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO {user};"
            ]
            drop_res = subprocess.run(drop_cmd, env=env, capture_output=True, text=True, timeout=120)
            
            if drop_res.returncode != 0:
                return RestaurarBackupResponse(
                    sucesso=False,
                    mensagem='❌ Falha na restauração do backup',
                    erro=drop_res.stderr[:500]
                )
        except Exception as e:
            return RestaurarBackupResponse(
                sucesso=False,
                mensagem='❌ Falha na restauração do backup',
                erro=str(e)[:500]
            )

        # 9. Executar restauração
        cmd = [
            psql_bin,
            '-h', host,
            '-p', str(port),
            '-U', user,
            '-d', database,
            '-f', backup.caminho_arquivo,
            '-v', 'ON_ERROR_STOP=1',
            '-q'
        ]
        
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)

        if result.returncode == 0:
            # 10. Sincronizar backup_logs após restauração bem-sucedida
            try:
                sincronizar_backups_orfaos(db)
            except Exception:
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
                erro=erro_msg[:500]
            )
    
    except Exception as e:
        return RestaurarBackupResponse(
            sucesso=False,
            mensagem="Erro ao restaurar backup",
            erro=str(e)
        )
    finally:
        # 11. Desativar modo manutenção (sempre)
        try:
            if 'maintenance_flag' in locals() and maintenance_flag.exists():
                maintenance_flag.unlink(missing_ok=True)
        except Exception:
            pass
```

**Diagrama de Fluxo - restaurar_backup()**:

```
Início
  ↓
Validar senha supervisor → [Inválida] → 401 Unauthorized
  ↓ [Válida]
Buscar backup no BD → [Não encontrado] → 404 Not Found
  ↓ [Encontrado]
Validar status='sucesso' → [Outro status] → 400 Bad Request
  ↓ [sucesso]
Validar arquivo existe → [Não existe] → 404 Not Found
  ↓ [Existe]
Usuário confirmou? → [Não] → Retorna {sucesso: false, mensagem: "cancelada"}
  ↓ [Sim]
Parse DATABASE_URL e credenciais
  ↓
Encerrar conexões ativas (pg_terminate_backend)
  ↓
Criar arquivo sentinela .maintenance
  ↓
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  ↓ [Erro] → Retorna {sucesso: false, erro}
  ↓ [Sucesso]
Executar psql -f <backup.sql> com ON_ERROR_STOP=1
  ↓
Sucesso? ───┐
  ↓  Não     │ Sim
  │          ↓
  │      Sincronizar backup_logs (reconciliar arquivos)
  │          ↓
  │      Retornar {sucesso: true, mensagem: "✅ ..."}
  │
  ↓ (Erro)
Retornar {sucesso: false, erro: <stderr>}
  ↓
[Finally] Remover arquivo .maintenance
  ↓
Fim
```

**4.3.5. DELETE /configuracoes/backups/{backup_id} - Excluir Backup**

```python
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
```

#### 4.4. Endpoints - Servidor e Serviços

**4.4.1. GET /configuracoes/sistema/info - Info do Sistema**

```python
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
```

**4.4.2. GET /configuracoes/sistema/servicos - Status Serviços**

```python
@router.get("/sistema/servicos", response_model=ServicesStatusResponse)
def obter_status_servicos():
    """Retorna status dos serviços (NGINX, PostgreSQL, FastAPI, venv)"""
    try:
        from services.system_monitor import get_services_status
        status_dict = get_services_status()
        return ServicesStatusResponse(**status_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao obter status dos serviços: {str(e)}"
        )
```

**4.4.3. POST /configuracoes/sistema/verificar-servicos-logs - Verificar com Logs**

```python
@router.post("/sistema/verificar-servicos-logs", response_model=VerificarServicosLogsResponse)
def verificar_servicos_com_logs():
    """Executa o script start_services.sh e retorna os logs da execução"""
    try:
        script_path = Path(__file__).parent.parent.parent / 'start_services.sh'
        if not script_path.exists():
            return VerificarServicosLogsResponse(
                sucesso=False,
                logs="",
                mensagem=f"Script não encontrado: {script_path}"
            )
        
        # Executar script e capturar saída
        bash_bin = '/bin/bash'
        result = subprocess.run(
            [bash_bin, str(script_path)],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        # Combinar stdout e stderr
        logs_output = result.stdout
        if result.stderr:
            logs_output += "\n\n=== STDERR ===\n" + result.stderr
        
        # Ler logs do backend (últimas 100 linhas)
        logs_dir = Path(__file__).parent.parent / 'logs'
        log_file = logs_dir / 'backend.log'
        
        if log_file.exists() and log_file.stat().st_size > 0:
            try:
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    recent_logs = ''.join(lines[-100:])
                    logs_output += f"\n\n=== LOG FILE: {log_file.name} (últimas 100 linhas) ===\n" + recent_logs
            except Exception as e:
                logs_output += f"\n\n=== Erro ao ler {log_file.name}: {str(e)} ===\n"
        
        return VerificarServicosLogsResponse(
            sucesso=result.returncode == 0,
            logs=logs_output,
            mensagem="Script executado com sucesso" if result.returncode == 0 else "Script executado com erros"
        )
    except subprocess.TimeoutExpired:
        return VerificarServicosLogsResponse(
            sucesso=False,
            logs="",
            mensagem="Timeout: script demorou mais de 60 segundos"
        )
    except Exception as e:
        return VerificarServicosLogsResponse(
            sucesso=False,
            logs="",
            mensagem=f"Erro ao executar script: {str(e)}"
        )
```

**4.4.4. GET /configuracoes/postgres/info - Info PostgreSQL**

```python
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
```

#### 4.5. Endpoints - Configurações e Senha Supervisor

**4.5.1. POST /configuracoes/validar-senha - Validar Senha**

```python
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
```

**4.5.2. PUT /configuracoes/{chave} - Atualizar Configuração**

```python
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
```

### 5. Celery Tasks - celery_tasks.py

**Localização**: `backend/services/celery_tasks.py`

#### 5.1. Configuração do Celery

```python
from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta
from pathlib import Path
from config import REDIS_URL
from db import SessionLocal

# Configurar Celery
celery_app = Celery(
    "autocare_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['services.celery_tasks']
)

# Configuração do Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Sao_Paulo',
    enable_utc=True,
    beat_schedule={
        'backup-mensal': {
            'task': 'services.celery_tasks.backup_mensal_task',
            # Dia 28-31 às 22:00 (último dia do mês)
            'schedule': crontab(hour=22, minute=0, day_of_month='28-31'),
        },
        # Opcional: adicionar backup diário
        # 'backup-diario': {
        #     'task': 'services.celery_tasks.backup_diario_task',
        #     'schedule': crontab(hour=2, minute=0),  # 02:00 todos os dias
        # },
    },
)
```

#### 5.2. Task: Backup Diário

```python
@celery_app.task
def backup_diario_task():
    """
    Backup diário do banco de dados.
    Mantém apenas os últimos 7 backups diários.
    """
    from services.system_monitor import create_database_backup
    from models.autocare_models import BackupLog
    
    db = SessionLocal()
    try:
        print("🔄 Iniciando backup diário automático...")
        resultado = create_database_backup(
            tipo='diario',
            criado_por='sistema',
            db_session=db
        )
        
        if resultado.get('sucesso'):
            print(f"✅ Backup diário criado: {resultado.get('arquivo')}")
            print(f"   Hash: {resultado.get('hash')}")
            print(f"   Tamanho: {resultado.get('tamanho_mb')} MB")
            
            # Limpar backups antigos (manter apenas 7 dias)
            data_limite = datetime.now() - timedelta(days=7)
            backups_antigos = db.query(BackupLog).filter(
                BackupLog.tipo == 'diario',
                BackupLog.data_hora < data_limite,
                BackupLog.status == 'sucesso'
            ).all()
            
            removidos = 0
            for backup in backups_antigos:
                try:
                    # Remover arquivo físico
                    if backup.caminho_arquivo and Path(backup.caminho_arquivo).exists():
                        Path(backup.caminho_arquivo).unlink()
                        print(f"🗑️  Backup antigo removido: {backup.caminho_arquivo}")
                    
                    # Remover registro do banco
                    db.delete(backup)
                    removidos += 1
                except Exception as e:
                    print(f"⚠️  Erro ao remover backup {backup.id}: {str(e)}")
            
            if removidos > 0:
                db.commit()
                print(f"🧹 {removidos} backup(s) antigo(s) removido(s)")
            
            return f"Backup diário concluído. {removidos} backup(s) antigo(s) removido(s)."
        else:
            erro = resultado.get('erro', 'Erro desconhecido')
            print(f"❌ Erro no backup diário: {erro}")
            return f"Erro no backup diário: {erro}"
    
    except Exception as e:
        print(f"❌ Erro crítico no backup diário: {str(e)}")
        return f"Erro crítico: {str(e)}"
    
    finally:
        db.close()
```

#### 5.3. Task: Backup Mensal

```python
@celery_app.task
def backup_mensal_task():
    """
    Backup mensal do banco de dados.
    Executado no dia 31 de cada mês às 22:00 (ou último dia do mês).
    Backups mensais não são removidos automaticamente.
    """
    from services.system_monitor import create_database_backup
    
    db = SessionLocal()
    try:
        hoje = datetime.now()
        
        # Verificar se é o último dia do mês
        amanha = hoje + timedelta(days=1)
        if amanha.month != hoje.month or hoje.day == 31:
            print("🔄 Iniciando backup mensal automático...")
            resultado = create_database_backup(
                tipo='mensal',
                criado_por='sistema',
                db_session=db
            )
            
            if resultado.get('sucesso'):
                print(f"✅ Backup mensal criado: {resultado.get('arquivo')}")
                print(f"   Hash: {resultado.get('hash')}")
                print(f"   Tamanho: {resultado.get('tamanho_mb')} MB")
                return f"Backup mensal concluído: {resultado.get('arquivo')}"
            else:
                erro = resultado.get('erro', 'Erro desconhecido')
                print(f"❌ Erro no backup mensal: {erro}")
                return f"Erro no backup mensal: {erro}"
        else:
            print("ℹ️  Não é o último dia do mês, backup mensal não executado.")
            return "Não é o último dia do mês"
    
    except Exception as e:
        print(f"❌ Erro crítico no backup mensal: {str(e)}")
        return f"Erro crítico: {str(e)}"
    
    finally:
        db.close()
```

#### 5.4. Executar Worker e Beat

**Comando para iniciar Worker + Beat**:

```bash
# Worker e Beat juntos
celery -A services.celery_tasks worker --beat --loglevel=info

# Ou separadamente:
# Worker
celery -A services.celery_tasks worker --loglevel=info

# Beat (agendador)
celery -A services.celery_tasks beat --loglevel=info
```

**Systemd Service (opcional)** - `/etc/systemd/system/celery-autocare.service`:

```ini
[Unit]
Description=Celery Service Autocare
After=network.target redis.service postgresql.service

[Service]
Type=forking
User=autocare
Group=autocare
WorkingDirectory=/home/autocare/backend
Environment="PATH=/home/autocare/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/home/autocare/venv/bin/celery -A services.celery_tasks worker --beat --loglevel=info --detach --logfile=/var/log/celery-autocare.log --pidfile=/var/run/celery-autocare.pid
ExecStop=/home/autocare/venv/bin/celery -A services.celery_tasks control shutdown
Restart=always

[Install]
WantedBy=multi-user.target
```

**Habilitar e iniciar**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable celery-autocare
sudo systemctl start celery-autocare
sudo systemctl status celery-autocare
```

---

## Frontend - Interface e Fluxos

---

## Frontend - Interface e Fluxos

### 1. Dependências Necessárias

**package.json**:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.0.0",
    "lucide-react": "^0.290.0",
    "sonner": "^1.2.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

### 2. API Client - apiFetch

**lib/api.ts**:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
    throw new Error(error.detail || error.message || 'Erro na requisição');
  }
  
  return response.json();
}
```

### 3. TypeScript Interfaces

**types/maintenance.ts**:

```typescript
export interface SystemInfo {
  disco: {
    total_gb: number;
    usado_gb: number;
    livre_gb: number;
    percentual_usado: number;
  };
  memoria: {
    memoria_total_gb: number;
    memoria_usada_gb: number;
    memoria_livre_gb: number;
    memoria_percentual: number;
    swap_total_gb: number;
    swap_usada_gb: number;
    swap_livre_gb: number;
    swap_percentual: number;
  };
}

export interface ServicesStatus {
  nginx: boolean;
  postgresql: boolean;
  fastapi: boolean;
  venv_ativo: boolean;
}

export interface PostgresInfo {
  status: string;
  nome_instancia: string | null;
  tamanho: string | null;
  conexoes_ativas: number | null;
  versao: string | null;
  erro: string | null;
}

export interface BackupLog {
  id: number;
  data_hora: string;
  tipo: string;
  tamanho_mb: number | null;
  status: string;
  hash_arquivo: string | null;
  caminho_arquivo: string | null;
  criado_por: string | null;
  observacoes: string | null;
  erro_detalhes: string | null;
}
```

### 4. Componente Principal - Configuracoes.tsx

**Estrutura Geral**:

```typescript
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import {
  Settings, Save, Database, Server, Activity, HardDrive,
  Cpu, RefreshCw, AlertTriangle, X, CheckCircle, Trash2
} from 'lucide-react';
import type { SystemInfo, ServicesStatus, PostgresInfo, BackupLog } from '../types/maintenance';

export default function Configuracoes() {
  const queryClient = useQueryClient();
  
  // Estados para modais
  const [mostrarModalBackup, setMostrarModalBackup] = useState(false);
  const [mostrarModalBackupsExistentes, setMostrarModalBackupsExistentes] = useState(false);
  const [backupParaRestaurar, setBackupParaRestaurar] = useState<BackupLog | null>(null);
  const [backupParaDeletar, setBackupParaDeletar] = useState<BackupLog | null>(null);
  const [overlayPosRestore, setOverlayPosRestore] = useState(false);
  const [overlayErroRestore, setOverlayErroRestore] = useState<string | null>(null);
  const [mostrarModalLogsServicos, setMostrarModalLogsServicos] = useState(false);
  const [logsServicos, setLogsServicos] = useState('');
  
  // Estados para senhas
  const [senhaBackup, setSenhaBackup] = useState('');
  const [senhaRestaurar, setSenhaRestaurar] = useState('');
  const [senhaDeletar, setSenhaDeletar] = useState('');
  
  // ... (queries e mutations)
  
  return (
    <div className="space-y-6">
      <h1 className="flex items-center text-3xl font-bold text-gray-900">
        <Settings className="w-8 h-8 mr-3 text-blue-600" />
        Configurações
      </h1>
      
      {/* Grid com 3 cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Banco de Dados */}
        <CardBancoDados />
        
        {/* Card 2: Servidor */}
        <CardServidor />
        
        {/* Card 3: Serviços */}
        <CardServicos />
      </div>
      
      {/* Modais e Overlays */}
      {mostrarModalBackup && <ModalCriarBackup />}
      {mostrarModalBackupsExistentes && <ModalListarBackups />}
      {backupParaRestaurar && <ModalRestaurarBackup />}
      {backupParaDeletar && <ModalDeletarBackup />}
      {overlayPosRestore && <OverlayRestauracaoSucesso />}
      {overlayErroRestore && <OverlayRestauracaoErro />}
      {mostrarModalLogsServicos && <ModalLogsServicos />}
    </div>
  );
}
```

#### 4.1. Card Banco de Dados

```typescript
function CardBancoDados() {
  // Query: informações do PostgreSQL
  const { data: postgresInfo, isLoading: isLoadingPostgres } = useQuery<PostgresInfo>({
    queryKey: ['postgres-info'],
    queryFn: async () => {
      return await apiFetch('/configuracoes/postgres/info');
    }
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="flex items-center mb-4 text-xl font-semibold text-gray-800">
        <Database className="w-5 h-5 mr-2 text-blue-600" />
        Banco de Dados
      </h2>
      
      {isLoadingPostgres ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando...</p>
        </div>
      ) : postgresInfo ? (
        <div className="space-y-3">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              postgresInfo.status === 'online' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {postgresInfo.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          
          {postgresInfo.status === 'online' ? (
            <>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Instância:</span>
                <span className="text-sm font-medium">{postgresInfo.nome_instancia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tamanho:</span>
                <span className="text-sm font-medium">{postgresInfo.tamanho}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Conexões Ativas:</span>
                <span className="text-sm font-medium">{postgresInfo.conexoes_ativas}</span>
              </div>
              
              {/* Botões de Ação */}
              <div className="pt-3 border-t">
                <p className="mb-2 text-xs text-gray-500">
                  Backup será salvo em: <strong>/var/backups/autocare/</strong>
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => setMostrarModalBackup(true)}
                    disabled={mutationBackup.isPending}
                    className="flex items-center justify-center w-full px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {mutationBackup.isPending ? 'Criando...' : 'Criar Backup'}
                  </button>
                  <button
                    onClick={() => {
                      setMostrarModalBackupsExistentes(true);
                      refetchBackups();
                    }}
                    className="flex items-center justify-center w-full px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Backups Existentes
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-red-600">
              <p>Erro: {postgresInfo.erro}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nenhuma informação disponível</p>
      )}
    </div>
  );
}
```

#### 4.2. Card Servidor

```typescript
function CardServidor() {
  const { data: systemInfo, isLoading, refetch, isFetching } = useQuery<SystemInfo>({
    queryKey: ['system-info'],
    queryFn: async () => {
      try {
        return await apiFetch('/configuracoes/sistema/info');
      } catch (err) {
        // Fallback: retornar estrutura vazia
        return {
          disco: { total_gb: 0, usado_gb: 0, livre_gb: 0, percentual_usado: 0 },
          memoria: {
            memoria_total_gb: 0, memoria_usada_gb: 0, memoria_livre_gb: 0,
            memoria_percentual: 0, swap_total_gb: 0, swap_usada_gb: 0,
            swap_livre_gb: 0, swap_percentual: 0
          }
        } as SystemInfo;
      }
    }
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center text-xl font-semibold text-gray-800">
          <Server className="w-5 h-5 mr-2 text-green-600" />
          Servidor
        </h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1 text-gray-400 transition-colors rounded hover:text-green-600 hover:bg-green-50 disabled:cursor-not-allowed"
          title="Atualizar informações do servidor"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 mx-auto border-b-2 border-green-600 rounded-full animate-spin"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando...</p>
        </div>
      ) : systemInfo ? (
        <div className="space-y-4">
          {/* Disco */}
          <div>
            <div className="flex items-center mb-2">
              <HardDrive className="w-4 h-4 mr-2 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Disco</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">{systemInfo.disco.total_gb} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Usado:</span>
                <span className="font-medium text-orange-600">{systemInfo.disco.usado_gb} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Livre:</span>
                <span className="font-medium text-green-600">{systemInfo.disco.livre_gb} GB</span>
              </div>
              {/* Barra de Progresso */}
              <div className="w-full h-2 mt-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-blue-600 rounded-full" 
                  style={{ width: `${systemInfo.disco.percentual_usado}%` }}
                ></div>
              </div>
              <div className="text-center text-gray-600">
                {systemInfo.disco.percentual_usado}% usado
              </div>
            </div>
          </div>

          {/* Memória */}
          <div className="pt-3 border-t">
            <div className="flex items-center mb-2">
              <Cpu className="w-4 h-4 mr-2 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Memória</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">{systemInfo.memoria.memoria_total_gb} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Usada:</span>
                <span className="font-medium text-orange-600">{systemInfo.memoria.memoria_usada_gb} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Livre:</span>
                <span className="font-medium text-green-600">{systemInfo.memoria.memoria_livre_gb} GB</span>
              </div>
              {/* Barra de Progresso */}
              <div className="w-full h-2 mt-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-green-600 rounded-full" 
                  style={{ width: `${systemInfo.memoria.memoria_percentual}%` }}
                ></div>
              </div>
              <div className="text-center text-gray-600">
                {systemInfo.memoria.memoria_percentual}% usado
              </div>
            </div>
          </div>

          {/* Swap (se existir) */}
          {systemInfo.memoria.swap_total_gb > 0 && (
            <div className="pt-3 border-t">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Swap Total:</span>
                  <span className="font-medium">{systemInfo.memoria.swap_total_gb} GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Swap Usada:</span>
                  <span className="font-medium">
                    {systemInfo.memoria.swap_usada_gb} GB ({systemInfo.memoria.swap_percentual}%)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nenhuma informação disponível</p>
      )}
    </div>
  );
}
```

#### 4.3. Card Serviços

```typescript
function CardServicos() {
  const { data: servicesStatus, isLoading, refetch } = useQuery<ServicesStatus>({
    queryKey: ['services-status'],
    queryFn: async () => {
      try {
        return await apiFetch('/configuracoes/sistema/servicos');
      } catch (err: any) {
        // Fallback: tentar alias legado
        if (err.status === 404) {
          try {
            return await apiFetch('/configuracoes/servicos');
          } catch (err2) {
            // Último recurso: retornar offline
            return {
              nginx: false,
              postgresql: false,
              fastapi: false,
              venv_ativo: false
            } as ServicesStatus;
          }
        }
        throw err;
      }
    }
  });

  // Mutation: verificar serviços com logs
  const mutationVerificarServicos = useMutation({
    mutationFn: async () => {
      return await apiFetch('/configuracoes/sistema/verificar-servicos-logs', {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      setLogsServicos(data.logs || 'Nenhum log disponível');
      setMostrarModalLogsServicos(true);
      
      if (data.sucesso) {
        toast.success(data.mensagem || 'Serviços verificados com sucesso!');
      } else {
        toast.error(data.mensagem || 'Verificação concluída com avisos');
      }
      
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao verificar serviços');
      setLogsServicos('Erro ao executar verificação: ' + (error.message || 'Erro desconhecido'));
      setMostrarModalLogsServicos(true);
    }
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="flex items-center mb-4 text-xl font-semibold text-gray-800">
        <Activity className="w-5 h-5 mr-2 text-purple-600" />
        Serviços
      </h2>
      
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 mx-auto border-b-2 border-purple-600 rounded-full animate-spin"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando...</p>
        </div>
      ) : servicesStatus ? (
        <div className="space-y-3">
          {/* NGINX */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-gray-700">NGINX</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              servicesStatus.nginx 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {servicesStatus.nginx ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          
          {/* PostgreSQL */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-gray-700">PostgreSQL</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              servicesStatus.postgresql 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {servicesStatus.postgresql ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          
          {/* FastAPI/Uvicorn */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-gray-700">FastAPI/Uvicorn</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              servicesStatus.fastapi 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {servicesStatus.fastapi ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          
          {/* Venv Python */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-gray-700">Venv Python</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              servicesStatus.venv_ativo 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {servicesStatus.venv_ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          
          {/* Botão Verificar */}
          <div className="pt-3">
            <button
              onClick={() => mutationVerificarServicos.mutate()}
              disabled={mutationVerificarServicos.isPending}
              className="flex items-center justify-center w-full px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${mutationVerificarServicos.isPending ? 'animate-spin' : ''}`} />
              {mutationVerificarServicos.isPending ? 'Verificando...' : 'Verificar Status'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Nenhuma informação disponível</p>
      )}
    </div>
  );
}
```

#### 4.4. Modais e Mutations

**Modal Criar Backup**:

```typescript
// Query: listar backups
const { data: backups, refetch: refetchBackups } = useQuery<BackupLog[]>({
  queryKey: ['backups'],
  queryFn: async () => {
    return await apiFetch('/configuracoes/backups');
  },
  enabled: false
});

// Mutation: criar backup
const mutationBackup = useMutation({
  mutationFn: async (senha: string) => {
    return await apiFetch('/configuracoes/postgres/backup', {
      method: 'POST',
      body: JSON.stringify({ senha })
    });
  },
  onSuccess: (data: any) => {
    if (data.sucesso) {
      const tamanho = data.tamanho_mb ? ` - ${data.tamanho_mb} MB` : '';
      toast.success(`Backup criado com sucesso!${tamanho}`, { duration: 5000 });
      setMostrarModalBackup(false);
      setSenhaBackup('');
      refetchBackups();
    } else {
      toast.error(data.mensagem || data.erro || 'Erro ao criar backup');
    }
  },
  onError: (error: any) => {
    toast.error(error.message || 'Erro ao criar backup');
  }
});

// Componente Modal
{mostrarModalBackup && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
      <button
        onClick={() => {
          setMostrarModalBackup(false);
          setSenhaBackup('');
        }}
        className="absolute text-gray-500 top-4 right-4 hover:text-gray-700"
      >
        <X className="w-5 h-5" />
      </button>
      <h2 className="flex items-center mb-4 text-xl font-semibold text-blue-600">
        <Database className="w-5 h-5 mr-2" />
        Criar Backup do Banco de Dados
      </h2>
      <p className="mb-4 text-gray-700">
        Esta ação irá criar um backup completo do banco de dados PostgreSQL.
        O arquivo será salvo em: <strong>/var/backups/autocare/</strong>
      </p>
      <p className="mb-4 text-sm text-gray-600">
        Digite a senha do supervisor para confirmar:
      </p>
      <input
        type="password"
        value={senhaBackup}
        onChange={(e) => setSenhaBackup(e.target.value)}
        className="w-full px-3 py-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Senha do supervisor"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && senhaBackup) {
            mutationBackup.mutate(senhaBackup);
          }
        }}
      />
      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setMostrarModalBackup(false);
            setSenhaBackup('');
          }}
          className="px-4 py-2 text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400"
        >
          Cancelar
        </button>
        <button
          onClick={() => mutationBackup.mutate(senhaBackup)}
          disabled={mutationBackup.isPending || !senhaBackup}
          className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {mutationBackup.isPending ? (
            <>
              <div className="w-4 h-4 mr-2 border-b-2 border-white rounded-full animate-spin"></div>
              Criando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Criar Backup
            </>
          )}
        </button>
      </div>
    </div>
  </div>
)}
```

**Mutation: Restaurar Backup**:

```typescript
const mutationRestaurar = useMutation({
  mutationFn: async ({ backupId, senha }: { backupId: number; senha: string }) => {
    return await apiFetch(`/configuracoes/backups/${backupId}/restaurar`, {
      method: 'POST',
      body: JSON.stringify({ senha, confirmar: true })
    });
  },
  onSuccess: async (data: any) => {
    if (data.sucesso) {
      // Sincronizar órfãos automaticamente
      try {
        await apiFetch('/configuracoes/backups/sincronizar', { method: 'POST' });
      } catch (_) {}
      
      toast.success(data.mensagem, { duration: 4000 });
      
      // Exigir confirmação do usuário para finalizar e recarregar a aplicação
      setOverlayPosRestore(true);
      try {
        localStorage.setItem('autocare_last_restore', String(Date.now()));
      } catch (_) {}
      
      setBackupParaRestaurar(null);
      setSenhaRestaurar('');
      refetchBackups();
    } else {
      const errorMsg = data.erro ? `${data.mensagem}\n\nDetalhes: ${data.erro}` : data.mensagem;
      toast.error(errorMsg, { duration: 10000 });
      setOverlayErroRestore(errorMsg);
      setBackupParaRestaurar(null);
      setSenhaRestaurar('');
    }
  },
  onError: (error: any) => {
    const msg = error.message || 'Erro ao restaurar backup';
    toast.error(msg, { duration: 5000 });
    setOverlayErroRestore(msg);
    setBackupParaRestaurar(null);
    setSenhaRestaurar('');
  }
});
```

**Overlay Pós-Restauração (Sucesso)**:

```typescript
{overlayPosRestore && (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
    <div className="w-full max-w-md p-6 mx-4 text-center bg-white rounded-lg shadow-2xl">
      <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full">
        <CheckCircle className="w-6 h-6 text-green-600" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-800">Restauração concluída</h3>
      <p className="mb-2 text-sm text-gray-600">
        Atualizando a aplicação para refletir os novos dados...
      </p>
      <div className="w-full h-2 mb-1 overflow-hidden bg-gray-200 rounded-full">
        <div className="w-full h-2 bg-green-600 rounded-full animate-pulse"></div>
      </div>
      <p className="mt-2 text-xs text-gray-500">Clique em OK para continuar.</p>
      <div className="mt-4">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}
```

---

## Tarefas Agendadas (Celery)

### Configuração do Redis

**Instalar Redis**:

```bash
# Ubuntu/Debian
sudo apt install redis-server

# Verificar se está rodando
sudo systemctl status redis
```

**Testar conexão**:

```bash
redis-cli ping
# Resposta esperada: PONG
```

### Configurar Celery no Projeto

**config.py**:

```python
import os
from dotenv import load_dotenv

load_dotenv()

# Redis
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Database
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://autocare:autocare@localhost:5432/autocare')
```

### Monitorar Tarefas

**Flower (Web UI para Celery)**:

```bash
# Instalar
pip install flower

# Executar
celery -A services.celery_tasks flower

# Acessar: http://localhost:5555
```

---

## Guia de Implantação Passo a Passo

---

## Guia de Implantação Passo a Passo

### 1. Preparar o Ambiente

**1.1. Instalar Dependências do Sistema**:

```bash
# PostgreSQL client (pg_dump e psql)
sudo apt install postgresql-client

# Python 3.10+
sudo apt install python3 python3-pip python3-venv

# Redis
sudo apt install redis-server

# NGINX (opcional, se não estiver instalado)
sudo apt install nginx
```

**1.2. Criar Diretório de Backups**:

```bash
sudo mkdir -p /var/backups/autocare
sudo chmod 777 /var/backups/autocare
# Ou definir owner específico:
# sudo chown usuario:grupo /var/backups/autocare
```

### 2. Configurar Backend

**2.1. Criar Virtual Environment**:

```bash
cd /caminho/do/projeto/backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows
```

**2.2. Instalar Dependências Python**:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**2.3. Configurar .env**:

```bash
# Copiar template
cp .env.example .env

# Editar com suas credenciais
nano .env
```

Conteúdo do `.env`:

```bash
DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/seu_banco
AUTOCARE_BACKUP_DIR=/var/backups/autocare
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=sua_chave_secreta_aqui_gere_com_openssl_rand_hex_32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### 3. Configurar Banco de Dados

**3.1. Criar Database**:

```sql
-- Conectar ao PostgreSQL como superuser
sudo -u postgres psql

-- Criar usuário e database
CREATE USER autocare WITH PASSWORD 'senha_forte_aqui';
CREATE DATABASE autocare OWNER autocare;
GRANT ALL PRIVILEGES ON DATABASE autocare TO autocare;
\q
```

**3.2. Executar Migrações**:

```bash
# Dentro do diretório backend com venv ativado
alembic upgrade head
```

**3.3. Verificar Tabelas Criadas**:

```bash
psql -U autocare -d autocare -c "\dt"
# Deve listar: backup_logs, configuracoes, ... (outras tabelas)
```

### 4. Configurar Celery (Tarefas Agendadas)

**4.1. Criar Arquivo de Serviço Systemd**:

```bash
sudo nano /etc/systemd/system/celery-autocare.service
```

Conteúdo:

```ini
[Unit]
Description=Celery Service Autocare
After=network.target redis.service postgresql.service

[Service]
Type=forking
User=seu_usuario
Group=seu_grupo
WorkingDirectory=/caminho/do/projeto/backend
Environment="PATH=/caminho/do/projeto/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/caminho/do/projeto/backend/venv/bin/celery -A services.celery_tasks worker --beat --loglevel=info --detach --logfile=/var/log/celery-autocare.log --pidfile=/var/run/celery-autocare.pid
ExecStop=/caminho/do/projeto/backend/venv/bin/celery -A services.celery_tasks control shutdown
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**4.2. Habilitar e Iniciar Celery**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable celery-autocare
sudo systemctl start celery-autocare
sudo systemctl status celery-autocare
```

**4.3. Verificar Logs**:

```bash
sudo tail -f /var/log/celery-autocare.log
```

### 5. Configurar FastAPI (Backend)

**5.1. Criar Arquivo de Serviço Systemd**:

```bash
sudo nano /etc/systemd/system/autocare-backend.service
```

Conteúdo:

```ini
[Unit]
Description=Autocare FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=seu_usuario
Group=seu_grupo
WorkingDirectory=/caminho/do/projeto/backend
Environment="PATH=/caminho/do/projeto/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/caminho/do/projeto/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**5.2. Habilitar e Iniciar Backend**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable autocare-backend
sudo systemctl start autocare-backend
sudo systemctl status autocare-backend
```

### 6. Configurar Frontend

**6.1. Instalar Dependências**:

```bash
cd /caminho/do/projeto/frontend
npm install
```

**6.2. Configurar Variáveis de Ambiente**:

```bash
# Criar .env.production
nano .env.production
```

Conteúdo:

```bash
VITE_API_URL=/api
```

**6.3. Build de Produção**:

```bash
npm run build
# Gera pasta dist/
```

### 7. Configurar NGINX

**7.1. Criar Arquivo de Configuração**:

```bash
sudo nano /etc/nginx/sites-available/autocare
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name seu_dominio.com;

    # Frontend (React)
    root /caminho/do/projeto/frontend/dist;
    index index.html;

    # Servir arquivos estáticos do frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para Backend (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout para restauração de backup (pode demorar)
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

**7.2. Habilitar Site e Reiniciar NGINX**:

```bash
sudo ln -s /etc/nginx/sites-available/autocare /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl restart nginx
sudo systemctl status nginx
```

### 8. Teste Completo

**8.1. Verificar Serviços**:

```bash
# PostgreSQL
sudo systemctl status postgresql

# Redis
sudo systemctl status redis

# Backend
sudo systemctl status autocare-backend

# Celery
sudo systemctl status celery-autocare

# NGINX
sudo systemctl status nginx
```

**8.2. Acessar Aplicação**:

```
http://seu_dominio.com
# Ou
http://localhost
```

**8.3. Testar Funcionalidades**:

1. **Login**: Fazer login com usuário admin
2. **Acessar Configurações**: Menu lateral > Configurações
3. **Testar Banco de Dados**:
   - Ver status do PostgreSQL (deve estar Online)
   - Criar backup manual (senha padrão: `admin123`)
   - Listar backups existentes
4. **Testar Servidor**:
   - Ver métricas de disco e memória
   - Clicar em refresh
5. **Testar Serviços**:
   - Ver status (todos devem estar Ativos)
   - Clicar em "Verificar Status" e ver logs

### 9. Alterar Senha Padrão do Supervisor

```bash
# Via interface web:
# Configurações > Senha do Supervisor
# Senha atual: admin123
# Nova senha: <sua_senha_forte>

# Ou via API:
curl -X PUT http://localhost/api/configuracoes/senha_supervisor \
  -H "Content-Type: application/json" \
  -d '{"valor": "sua_nova_senha_forte"}'
```

### 10. Configurar SSL/HTTPS (Opcional mas Recomendado)

**10.1. Instalar Certbot**:

```bash
sudo apt install certbot python3-certbot-nginx
```

**10.2. Obter Certificado**:

```bash
sudo certbot --nginx -d seu_dominio.com
```

**10.3. Testar Renovação Automática**:

```bash
sudo certbot renew --dry-run
```

---

## Casos de Uso e Fluxos Completos

### Caso de Uso 1: Criar Backup Manual

**Fluxo do Usuário**:

1. Acessa Configurações
2. No card "Banco de Dados", clica em "Criar Backup"
3. Modal solicita senha do supervisor
4. Digita senha e confirma
5. Backend valida senha (hash SHA256)
6. Sistema cria registro no BD (status='em_progresso')
7. Executa pg_dump com flags --clean e --if-exists
8. Calcula tamanho e hash SHA256 do arquivo
9. Atualiza registro (status='sucesso')
10. Usuário recebe notificação toast com sucesso e tamanho do backup

**Endpoints Envolvidos**:
- POST `/configuracoes/postgres/backup`

**Tempo Estimado**: 10s - 5min (dependendo do tamanho do banco)

**Arquivo Gerado**: `/var/backups/autocare/autocare_backup_YYYYMMDD_HHMMSS.sql`

### Caso de Uso 2: Restaurar Backup

**Fluxo do Usuário**:

1. Acessa Configurações > Banco de Dados > Backups Existentes
2. Lista mostra todos os backups com metadados
3. Seleciona backup e clica em "Restaurar"
4. Modal exibe alertas (⚠️ ATENÇÃO: substituir TODOS os dados)
5. Digita senha do supervisor e confirma
6. Sistema valida senha e arquivo
7. Encerra todas as conexões ativas ao banco
8. Cria arquivo `.maintenance` (modo manutenção)
9. Executa DROP SCHEMA public CASCADE; CREATE SCHEMA public;
10. Executa psql -f <backup.sql>
11. Remove arquivo `.maintenance`
12. Sincroniza backup_logs com arquivos físicos
13. Overlay solicita confirmação para reload da aplicação
14. Usuário confirma e página recarrega

**Endpoints Envolvidos**:
- GET `/configuracoes/backups`
- POST `/configuracoes/backups/{id}/restaurar`
- POST `/configuracoes/backups/sincronizar`

**Tempo Estimado**: 30s - 10min (dependendo do tamanho do banco)

**Impacto**: 
- ⚠️ **CRÍTICO**: Todos os dados atuais são substituídos
- ⚠️ Usuários são desconectados
- ⚠️ Sistema fica indisponível durante a restauração

### Caso de Uso 3: Excluir Backup

**Fluxo do Usuário**:

1. Acessa Configurações > Banco de Dados > Backups Existentes
2. Seleciona backup e clica em "Excluir"
3. Modal solicita confirmação e senha do supervisor
4. Digita senha e confirma
5. Sistema valida senha
6. Remove arquivo físico do disco
7. Remove registro do banco de dados
8. Usuário recebe notificação de sucesso

**Endpoints Envolvidos**:
- DELETE `/configuracoes/backups/{id}`

**Tempo Estimado**: < 5s

### Caso de Uso 4: Sincronizar Backups Órfãos

**Fluxo Automático**:

1. Sistema lista arquivos `.sql` no diretório de backups
2. Compara com registros no banco de dados
3. **Adiciona** registros para arquivos sem entrada no BD:
   - Calcula tamanho e hash
   - Extrai data do nome do arquivo
   - Determina tipo (manual/diario/mensal)
4. **Remove** registros do BD cujos arquivos não existem mais
5. Retorna quantidade sincronizada e removida

**Endpoints Envolvidos**:
- POST `/configuracoes/backups/sincronizar`

**Quando Executar**:
- Manualmente pelo botão "Sincronizar Órfãos"
- Automaticamente após restauração bem-sucedida
- Após mover/copiar arquivos de backup manualmente

### Caso de Uso 5: Backup Automático Mensal (Celery)

**Fluxo Automático**:

1. Celery Beat agenda para dia 28-31 às 22:00
2. Task verifica se é último dia do mês
3. Se sim, executa `create_database_backup(tipo='mensal')`
4. Backup é criado e registrado no BD
5. **NÃO** remove backups antigos (manter histórico)
6. Log é gravado em `/var/log/celery-autocare.log`

**Configuração Beat**:
```python
'backup-mensal': {
    'task': 'services.celery_tasks.backup_mensal_task',
    'schedule': crontab(hour=22, minute=0, day_of_month='28-31'),
}
```

**Monitorar**:
```bash
sudo tail -f /var/log/celery-autocare.log | grep backup
```

### Caso de Uso 6: Backup Automático Diário (Opcional)

**Fluxo Automático**:

1. Celery Beat agenda para 02:00 diariamente
2. Task executa `create_database_backup(tipo='diario')`
3. Backup é criado e registrado no BD
4. **Remove** backups diários com mais de 7 dias:
   - Lista backups tipo='diario' com data < hoje - 7 dias
   - Remove arquivo físico
   - Remove registro do BD
5. Log de remoção é gravado

**Adicionar ao Beat Schedule**:
```python
'backup-diario': {
    'task': 'services.celery_tasks.backup_diario_task',
    'schedule': crontab(hour=2, minute=0),  # 02:00 todos os dias
}
```

**Retenção**: 7 dias (configurável em `backup_diario_task`)

---

## Troubleshooting e Boas Práticas

### Problemas Comuns e Soluções

#### 1. "Erro ao criar backup: pg_dump: command not found"

**Causa**: Cliente PostgreSQL não instalado

**Solução**:
```bash
sudo apt install postgresql-client
# Verificar
which pg_dump
pg_dump --version
```

#### 2. "Nenhum diretório de backup com permissão de escrita disponível"

**Causa**: Todos os diretórios candidatos sem permissão de escrita

**Solução**:
```bash
# Criar e dar permissão
sudo mkdir -p /var/backups/autocare
sudo chmod 777 /var/backups/autocare

# Ou definir no .env
echo "AUTOCARE_BACKUP_DIR=/home/usuario/backups" >> backend/.env
mkdir -p /home/usuario/backups
```

#### 3. "Senha do supervisor inválida"

**Causa**: Senha incorreta ou hash não corresponde

**Solução**:
```bash
# Verificar hash atual no banco
psql -U autocare -d autocare -c "SELECT chave, valor FROM configuracoes WHERE chave='senha_supervisor';"

# Resetar para padrão (admin123)
# Hash SHA256 de "admin123": 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
psql -U autocare -d autocare -c "UPDATE configuracoes SET valor='240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' WHERE chave='senha_supervisor';"
```

#### 4. "Erro ao restaurar: Database is being accessed by other users"

**Causa**: Conexões ativas não foram encerradas

**Solução**: O código já tenta encerrar conexões, mas se persistir:

```sql
-- Executar manualmente antes de restaurar
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'autocare'
AND pid <> pg_backend_pid();
```

#### 5. "Celery worker não inicia"

**Causa**: Redis não está rodando ou configuração incorreta

**Solução**:
```bash
# Verificar Redis
sudo systemctl status redis
redis-cli ping  # Deve retornar PONG

# Verificar REDIS_URL no .env
cat backend/.env | grep REDIS_URL

# Testar manualmente
cd backend
source venv/bin/activate
celery -A services.celery_tasks worker --loglevel=debug
```

#### 6. "Frontend não carrega após restauração"

**Causa**: Cache do navegador ou sessão expirada

**Solução**:
```javascript
// O overlay força reload, mas se não funcionar:
// 1. Limpar cache do navegador (Ctrl+Shift+Del)
// 2. Hard refresh (Ctrl+Shift+R)
// 3. Fechar e reabrir navegador
```

#### 7. "Disco cheio durante backup"

**Causa**: Espaço insuficiente no diretório de backups

**Solução**:
```bash
# Verificar espaço
df -h /var/backups/autocare

# Remover backups antigos manualmente
cd /var/backups/autocare
ls -lh
# Deletar backups antigos e sincronizar
# Via interface: Backups Existentes > Sincronizar Órfãos
```

### Boas Práticas

#### Segurança

1. **Alterar Senha Padrão**: Logo após implantação, mudar senha do supervisor
2. **Permissões de Arquivo**: Backups devem ter permissão 600 ou 640
   ```bash
   chmod 640 /var/backups/autocare/*.sql
   ```
3. **SSL/HTTPS**: Sempre usar HTTPS em produção (senhas trafegam na rede)
4. **Backup Offsite**: Copiar backups para storage externo (S3, NAS, etc.)
5. **Validação de Hash**: Verificar integridade com hash SHA256 antes de restaurar

#### Monitoramento

1. **Logs do Celery**: Monitorar logs para falhas em backups automáticos
   ```bash
   sudo tail -f /var/log/celery-autocare.log
   ```
2. **Alertas**: Configurar alertas para backups falhados (e-mail, Slack, etc.)
3. **Espaço em Disco**: Monitorar uso do diretório de backups
   ```bash
   du -sh /var/backups/autocare
   ```
4. **Flower**: Usar Flower para monitoramento visual do Celery

#### Retenção de Backups

**Estratégia Recomendada**:

- **Diários**: Manter 7 dias (automatizado)
- **Mensais**: Manter 12 meses (manual)
- **Anuais**: Manter indefinidamente (manual)

**Implementar Limpeza Manual**:

```python
# Adicionar task para limpar backups mensais antigos
@celery_app.task
def limpar_backups_mensais_antigos():
    """Remove backups mensais com mais de 12 meses"""
    from datetime import timedelta
    db = SessionLocal()
    try:
        data_limite = datetime.now() - timedelta(days=365)
        backups_antigos = db.query(BackupLog).filter(
            BackupLog.tipo == 'mensal',
            BackupLog.data_hora < data_limite,
            BackupLog.status == 'sucesso'
        ).all()
        
        removidos = 0
        for backup in backups_antigos:
            try:
                if backup.caminho_arquivo and Path(backup.caminho_arquivo).exists():
                    Path(backup.caminho_arquivo).unlink()
                db.delete(backup)
                removidos += 1
            except Exception as e:
                print(f"Erro ao remover backup {backup.id}: {str(e)}")
        
        if removidos > 0:
            db.commit()
        
        return f"{removidos} backup(s) mensal(is) antigo(s) removido(s)"
    finally:
        db.close()
```

#### Testes de Restauração

**Recomendação**: Testar restauração mensalmente em ambiente de staging

```bash
# Roteiro de teste:
1. Backup do banco de produção
2. Restaurar em staging
3. Verificar integridade dos dados
4. Testar funcionalidades críticas
5. Documentar tempo de restauração
6. Validar se aplicação funciona corretamente
```

#### Documentação

Manter documentado:
- Localização física dos backups
- Senha do supervisor (em cofre seguro)
- Procedimentos de recuperação de desastre
- Contatos de emergência
- SLA de restauração (tempo máximo aceitável)

---

## Conclusão

Esta documentação fornece uma visão completa da implementação dos utilitários de manutenção. Para replicar em outra aplicação:

1. ✅ Copiar modelos do banco (`BackupLog`, `Configuracao`)
2. ✅ Adaptar `system_monitor.py` para seu ambiente
3. ✅ Integrar endpoints de `autocare_configuracoes.py`
4. ✅ Configurar Celery para backups automáticos
5. ✅ Implementar interface frontend (ou usar CLI)
6. ✅ Testar em ambiente de desenvolvimento
7. ✅ Documentar procedimentos específicos do seu projeto
8. ✅ Treinar equipe para operação

### Checklist de Implantação

```
[ ] Banco de dados criado e migrações aplicadas
[ ] Tabelas backup_logs e configuracoes existem
[ ] Cliente PostgreSQL (pg_dump/psql) instalado
[ ] Diretório de backups criado com permissões corretas
[ ] Redis instalado e rodando
[ ] Celery configurado e serviço systemd criado
[ ] Backend rodando e acessível
[ ] Frontend buildado e servido pelo NGINX
[ ] Senha padrão do supervisor alterada
[ ] Primeiro backup manual testado com sucesso
[ ] Restauração testada em ambiente de staging
[ ] Backups automáticos agendados (mensal confirmado)
[ ] Monitoramento configurado (logs, Flower)
[ ] Documentação de procedimentos atualizada
[ ] Equipe treinada
```

### Suporte e Manutenção

**Logs Importantes**:
- Backend: `/var/log/autocare-backend.log` ou `backend/logs/backend.log`
- Celery: `/var/log/celery-autocare.log`
- NGINX: `/var/log/nginx/access.log` e `/var/log/nginx/error.log`
- PostgreSQL: `/var/log/postgresql/postgresql-XX-main.log`

**Comandos Úteis**:

```bash
# Ver status de todos os serviços
sudo systemctl status postgresql redis nginx autocare-backend celery-autocare

# Reiniciar todos os serviços
sudo systemctl restart postgresql redis nginx autocare-backend celery-autocare

# Ver logs em tempo real
sudo journalctl -u autocare-backend -f
sudo journalctl -u celery-autocare -f

# Verificar tamanho do banco
psql -U autocare -d autocare -c "SELECT pg_size_pretty(pg_database_size('autocare'));"

# Listar backups no banco
psql -U autocare -d autocare -c "SELECT id, data_hora, tipo, tamanho_mb, status FROM backup_logs ORDER BY data_hora DESC LIMIT 10;"
```

---

**Última atualização**: 29 de outubro de 2025  
**Versão**: 1.0.0  
**Autor**: Documentação Técnica - Sistema Autocare

A criação de backups tenta os seguintes candidatos em ordem:
1) `AUTOCARE_BACKUP_DIR` (se definido)
2) `/var/backups/autocare` (tenta criar e ajustar permissão 777; se falhar, continua)
3) `~/autocare_backups`
4) `./backups` (diretório de trabalho)
5) `/tmp/autocare_backups`

A lógica valida permissão de escrita criando e removendo um arquivo `.test_write`. O nome final do backup segue `autocare_backup_YYYYMMDD_HHMMSS.sql`.

Requisito: o binário `pg_dump` e `psql` precisam estar disponíveis (no PATH ou em caminhos padrão como `/usr/bin/pg_dump`); a senha do Postgres é passada via `PGPASSWORD`.

## Endpoints – Banco de Dados

Contratos gerais:
- Autorização: as rotas de backup/restauração/exclusão requerem a senha do supervisor (hash SHA256 armazenado em `configuracoes.senha_supervisor`).
- Erros: respostas informam `mensagem` e opcionalmente `erro` (detalhe técnico truncado para segurança).

1) Criar backup
- POST `/configuracoes/postgres/backup`
- Body: `{ "senha": "<senhaSupervisor>" }`
- Resposta: `{ sucesso: boolean, arquivo?: string, tamanho_mb?: number, hash?: string, backup_log_id?: number, mensagem: string, erro?: string }`
- Observações: cria registro `BackupLog` e usa `pg_dump` com flags `--clean` e `--if-exists` (dump plain-text).

2) Listar backups
- GET `/configuracoes/backups?skip=0&limit=100&tipo=manual|diario|mensal`
- Resposta: lista de `BackupLog` (campos serializados, `data_hora` em ISO).

3) Sincronizar backups órfãos
- POST `/configuracoes/backups/sincronizar`
- Procura arquivos `.sql` no diretório de backups; adiciona registros ausentes e remove registros de arquivos inexistentes.
- Resposta: `{ sucesso: boolean, mensagem: string, sincronizados: string[], removidos: number[], total_arquivos: number, total_registrados: number }`

4) Restaurar backup
- POST `/configuracoes/backups/{backup_id}/restaurar`
- Body: `{ "senha": "<senhaSupervisor>", "confirmar": true }`
- Fluxo interno:
  - Valida senha do supervisor.
  - Garante que o arquivo do backup existe e que seu status é `sucesso`.
  - Carrega env e parseia `DATABASE_URL`.
  - Encerra conexões ativas: executa `pg_terminate_backend` via conexão administrativa na base `postgres`.
  - Modo manutenção: cria arquivo sentinela `.maintenance` no diretório `backend` (fallback `/tmp/.autocare_maintenance`) para bloquear novas requisições na aplicação durante a operação.
  - Limpa o schema `public` (DROP SCHEMA CASCADE; fallback para drop de objetos caso o primeiro falhe).
  - Executa `psql -f` no arquivo `.sql` com `-v ON_ERROR_STOP=1` e `-q`.
  - Em caso de sucesso: sincroniza `backup_logs` com arquivos presentes no diretório de backup (adiciona registros faltantes, remove órfãos), desativa o modo manutenção.
  - Em caso de erro: retorna mensagem e parte final dos erros, tenta desativar o modo manutenção.
- Resposta: `{ sucesso: boolean, mensagem: string, erro?: string }`
- Tempo limite padrão: ~5 minutos para a execução do `psql`.

5) Excluir backup
- DELETE `/configuracoes/backups/{backup_id}`
- Body: `{ "senha": "<senhaSupervisor>" }`
- Efeitos: remove o arquivo físico (se existir) e o registro no BD.
- Resposta: `{ sucesso: boolean, mensagem: string }`

6) Informações do PostgreSQL
- GET `/configuracoes/postgres/info`
- Resposta: `{ status: 'online'|'offline', nome_instancia?: string, tamanho?: string, conexoes_ativas?: number, versao?: string, erro?: string }`

## Endpoints – Servidor e Serviços

1) Informações do sistema (disco e memória)
- GET `/configuracoes/sistema/info`
- Resposta: `{ disco: { total_gb, usado_gb, livre_gb, percentual_usado }, memoria: { memoria_total_gb, memoria_usada_gb, memoria_livre_gb, memoria_percentual, swap_total_gb, swap_usada_gb, swap_livre_gb, swap_percentual } }`

2) Status dos serviços
- GET `/configuracoes/sistema/servicos`
- Resposta: `{ nginx: boolean, postgresql: boolean, fastapi: boolean, venv_ativo: boolean }`
- Detecção:
  - Tenta `systemctl is-active` (NGINX e PostgreSQL) com fallback para varredura de processos (`psutil`).
  - FastAPI/Uvicorn: busca processo `uvicorn` e padrões no cmdline (`server:app`, `:app`, `backend/server.py`).
  - venv: heurística baseada em `sys.prefix`/`base_prefix` ou variável `VIRTUAL_ENV`.

3) Verificar serviços e obter logs (executa script)
- POST `/configuracoes/sistema/verificar-servicos-logs`
- Efeito: executa `start_services.sh` via bash e retorna stdout/stderr; tenta incluir trechos de `backend/logs/backend.log` (ou outros `.log` se disponível).
- Resposta: `{ sucesso: boolean, logs: string, mensagem: string }`

Aliases legados (compatibilidade):
- GET `/configuracoes/servicos` (mapeia para `/sistema/servicos`)
- POST `/configuracoes/servicos/verificar` (mapeia para `/sistema/verificar-servicos`)

## Supervisão e segurança (senha do supervisor)

- Config de senha é criada automaticamente com valor padrão `admin123` (hash SHA256) na primeira listagem de configurações.
- Endpoints auxiliares:
  - GET `/configuracoes`: garante chaves padrão e lista todas.
  - POST `/configuracoes/validar-senha` — Body `{ senha }` — retorna `{ valida, mensagem }`.
  - PUT `/configuracoes/senha_supervisor` — Body `{ valor: '<novaSenhaEmTextoPlano>' }` — o backend armazena o hash SHA256 quando `tipo=password`.

Recomendações:
- Alterar a senha padrão na primeira utilização.
- Proteger endpoints críticos por autenticação/autorização, além do fluxo de validação de senha do supervisor (já implementado).

## Tarefas agendadas (Celery)

Arquivo `backend/services/celery_tasks.py`:
- App Celery usa `REDIS_URL` como broker e backend; timezone `America/Sao_Paulo`.
- Agendamento em `beat_schedule`:
  - Backup mensal: tarefa `backup_mensal_task` roda no dia 28–31 às 22:00 (equivale ao último dia do mês).
- Outras tarefas:
  - `backup_diario_task`: cria backup do tipo `diario` e mantém apenas os últimos 7 (remove arquivo e registro dos demais). Não está no `beat_schedule` por padrão; pode ser adicionado conforme necessidade.

## Frontend – Página Configurações (UX)

Arquivo `frontend/src/pages/Configuracoes.tsx`:

- Card Banco de Dados:
  - Consulta `GET /configuracoes/postgres/info` para status e metadados.
  - Botão “Criar Backup”: abre modal solicitando senha do supervisor; aciona `POST /configuracoes/postgres/backup`.
  - Botão “Backups Existentes”: abre modal que lista `GET /configuracoes/backups` e expõe as ações:
    - “Restaurar”: abre modal de confirmação (resume impacto, encerra conexões, etc.), solicita senha e aciona `POST /configuracoes/backups/{id}/restaurar`.
    - “Excluir”: solicita senha e aciona `DELETE /configuracoes/backups/{id}`.
    - “Sincronizar Órfãos”: aciona `POST /configuracoes/backups/sincronizar` para reconciliar registros/arquivos.
  - Overlays durante e após restauração:
    - “Sistema em modo manutenção” enquanto o backend executa (bloqueia interação e informa progresso).
    - Em sucesso: overlay pede confirmação e força reload da aplicação.
    - Em falha: overlay exibe erro detalhado e exige acknowledge.
  - Observação na UI: “Backup será salvo em: /var/backups/autocare/”. O backend possui fallback inteligente; o diretório real pode variar conforme permissões/ambiente.

- Card Servidor:
  - Consulta `GET /configuracoes/sistema/info` e exibe métricas de disco e memória (barras de progresso e valores em GB).
  - Botão de atualizar para refetch.

- Card Serviços:
  - Consulta `GET /configuracoes/sistema/servicos` e exibe status com chips (NGINX, PostgreSQL, FastAPI/Uvicorn, Venv).
  - Botão “Verificar Status”: aciona `POST /configuracoes/sistema/verificar-servicos-logs`, exibe modal com logs do script (stdout/stderr e trechos dos arquivos de log disponíveis).

## Pontos de atenção e erros comuns

- Permissões no diretório de backups: se `/var/backups/autocare` não for gravável, o backend cai para outro diretório com permissão de escrita (home, cwd/backups ou /tmp).
- Ausência de `pg_dump`/`psql`: a criação e restauração dependem desses binários; instale o cliente do PostgreSQL no host.
- Senha do supervisor inválida: operações críticas retornam 401 e não executam.
- Conexões ativas no banco: a rota de restauração encerra conexões por segurança; garanta que aplicações externas não reconectem durante a operação.
- Tempo de execução: restauração possui timeout padrão (~300s). Bancos grandes podem exigir ajuste no ambiente/timeout.

## Como portar para outra aplicação

Backend:
- Adicione o modelo `BackupLog` ao seu projeto (ou migre a tabela equivalente) e configure migração no seu Alembic.
- Copie/adapte os endpoints de `autocare_configuracoes.py` (principalmente a seção de backups e sistema/serviços) considerando:
  - Dependências: `psutil`, `python-dotenv`, `psycopg2-binary` (ou adaptador compatível), `celery` e `redis` (opcional para agendamentos).
  - Integração com seu `db.py`/Session e com sua configuração de autenticação.
  - Forneça (ou adapte) um script `start_services.sh` para a verificação/arranque dos serviços que façam sentido no seu ambiente.
  - Garanta que `DATABASE_URL` esteja corretamente configurado em produção.

Frontend:
- Reaproveite o fluxo e componentes da página `Configurações` (cards, modais e overlays) ou implemente UI equivalente que consuma os mesmos endpoints.
- Integre com sua camada de fetch (ex.: `apiFetch`) e sistema de toasts/modal do seu app.

Agendamentos:
- Para backups automáticos:
  - Use `backup_diario_task` se desejar diário (e adicione ao `beat_schedule`).
  - `backup_mensal_task` já está configurada para rodar no último dia do mês às 22:00, usando `REDIS_URL`.

## Contrato resumido (inputs/outputs)

- Criar backup: input `{ senha }` → output `{ sucesso, arquivo?, tamanho_mb?, hash?, backup_log_id?, mensagem, erro? }`.
- Restaurar backup: input `{ senha, confirmar }` → output `{ sucesso, mensagem, erro? }`.
- Excluir backup: input `{ senha }` → output `{ sucesso, mensagem }`.
- Sincronizar: sem input → output `{ sucesso, mensagem, sincronizados, removidos, ... }`.
- Sistema/info: sem input → output `{ disco, memoria }`.
- Serviços/status: sem input → output `{ nginx, postgresql, fastapi, venv_ativo }`.
- Serviços/logs: sem input → output `{ sucesso, logs, mensagem }`.
- Postgres/info: sem input → output `{ status, nome_instancia?, tamanho?, conexoes_ativas?, versao?, erro? }`.

## Casos de borda a considerar

- Diretório de backup indisponível (permissão/ausência) → fallback para diretórios alternativos.
- `pg_dump`/`psql` ausentes → retornar erro com dica para instalar o cliente PostgreSQL.
- Backup inexistente/arquivo ausente/status != sucesso → bloqueia restauração com erro 400/404 apropriado.
- Senha supervisor incorreta → 401.
- Logs de serviços ausentes → mensagem de logs informando que não há arquivos ou estão vazios.

## Notas finais

- Modo manutenção: arquivo sentinela `.maintenance` (ou `/tmp/.autocare_maintenance`) é criado durante a restauração para bloquear novas requisições; não esqueça de considerar esse comportamento no middleware da sua aplicação (se aplicável) para retornar 503 durante a janela.
- Pós-restauração: o frontend força reload para garantir consistência após mudança completa do estado do banco.

---

Conclusão: os utilitários de manutenção aqui descritos oferecem uma solução completa para backup/restauração do PostgreSQL, monitoramento básico do servidor e checagem dos serviços essenciais, com proteções operacionais (senha do supervisor, modo manutenção e encerramento de conexões). Para portar, concentre-se em replicar os endpoints e o serviço de monitoramento, ajustar variáveis de ambiente e wirear a UI com os fluxos acima.
