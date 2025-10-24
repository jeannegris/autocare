#!/usr/bin/env python3
"""
Script para monitoramento de sistema e banco de dados PostgreSQL
Retorna informações em tempo real do servidor e banco de dados
"""

import psutil
import subprocess
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlparse, unquote


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


def _any_process_matches(names):
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

    # Verificar NGINX (systemctl + fallback por processo)
    nginx_active = False
    try:
        result = subprocess.run(['systemctl', 'is-active', 'nginx'],
                                capture_output=True, text=True, timeout=5)
        nginx_active = result.stdout.strip() == 'active'
    except Exception:
        pass
    if not nginx_active:
        nginx_active = _any_process_matches(['nginx'])
    services['nginx'] = bool(nginx_active)

    # Verificar PostgreSQL (systemctl + fallback por processo)
    pg_active = False
    try:
        result = subprocess.run(['systemctl', 'is-active', 'postgresql'],
                                capture_output=True, text=True, timeout=5)
        pg_active = result.stdout.strip() == 'active'
    except Exception:
        pass
    if not pg_active:
        pg_active = _any_process_matches(['postgres', 'postgresql'])
    services['postgresql'] = bool(pg_active)

    # Verificar processo do Uvicorn/FastAPI (mais abrangente)
    fastapi_active = False
    try:
        for proc in psutil.process_iter(['name', 'cmdline']):
            name = (proc.info.get('name') or '').lower()
            cmdline = ' '.join(proc.info.get('cmdline') or []).lower()
            if 'uvicorn' in name or 'uvicorn' in cmdline:
                # procurar app conhecido
                if 'server:app' in cmdline or ':app' in cmdline or 'backend/server.py' in cmdline:
                    fastapi_active = True
                    break
    except Exception:
        pass
    services['fastapi'] = bool(fastapi_active)

    # Verificar se está em ambiente virtual Python
    try:
        import sys as _sys
        venv_ativo = hasattr(_sys, 'real_prefix') or (
            hasattr(_sys, 'base_prefix') and _sys.base_prefix != _sys.prefix
        )
    except Exception:
        venv_ativo = bool(os.environ.get('VIRTUAL_ENV'))
    services['venv_ativo'] = venv_ativo

    return services


def check_postgres_connection():
    """Verifica conexão com PostgreSQL e retorna informações básicas"""
    try:
        import psycopg2
        import sys
        import os
        from pathlib import Path
        from dotenv import load_dotenv

        # Adicionar o diretório backend ao path
        backend_dir = Path(__file__).parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        # Carregar variáveis de ambiente do backend e também do diretório raiz do projeto
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
        cursor.execute("""
            SELECT pg_size_pretty(pg_database_size(current_database()));
        """)
        db_size = cursor.fetchone()[0]

        # Número de conexões ativas
        cursor.execute(
            """
            SELECT count(*) FROM pg_stat_activity 
            WHERE state = 'active';
            """
        )
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


def create_database_backup():
    """Cria backup do banco de dados PostgreSQL"""
    try:
        import sys
        import os
        from pathlib import Path
        import datetime
        from dotenv import load_dotenv
        
        # Adicionar o diretório backend ao path
        backend_dir = Path(__file__).parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        
        # Carregar variáveis de ambiente
        load_dotenv(backend_dir / '.env')
        
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
        
        # Diretório de backup no home do usuário
        backup_dir = Path.home() / 'autocare_backups'
        backup_dir.mkdir(exist_ok=True)
        
        # Nome do arquivo de backup com timestamp
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = backup_dir / f'autocare_backup_{timestamp}.sql'
        
        # Comando pg_dump
        env = os.environ.copy()
        env['PGPASSWORD'] = password
        
        cmd = [
            'pg_dump',
            '-h', host,
            '-p', str(port),
            '-U', user,
            '-d', database,
            '-F', 'p',  # Plain text format
            '-f', str(backup_file)
        ]
        
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            # Verificar tamanho do arquivo de backup
            file_size = backup_file.stat().st_size / (1024 * 1024)  # MB
            return {
                'sucesso': True,
                'arquivo': str(backup_file),
                'tamanho_mb': round(file_size, 2),
                'mensagem': f'Backup criado com sucesso: {backup_file.name}'
            }
        else:
            return {
                'sucesso': False,
                'erro': result.stderr,
                'mensagem': 'Erro ao criar backup do banco de dados'
            }
    except Exception as e:
        return {
            'sucesso': False,
            'erro': str(e),
            'mensagem': 'Erro ao criar backup do banco de dados'
        }


if __name__ == '__main__':
    import sys
    
    # Permitir execução direta para testes
    if len(sys.argv) > 1:
        if sys.argv[1] == 'disk':
            print(json.dumps(get_disk_info(), indent=2))
        elif sys.argv[1] == 'memory':
            print(json.dumps(get_memory_info(), indent=2))
        elif sys.argv[1] == 'services':
            print(json.dumps(get_services_status(), indent=2))
        elif sys.argv[1] == 'postgres':
            print(json.dumps(check_postgres_connection(), indent=2))
        elif sys.argv[1] == 'backup':
            print(json.dumps(create_database_backup(), indent=2))
        else:
            print("Uso: system_monitor.py [disk|memory|services|postgres|backup]")
    else:
        # Retornar tudo
        data = {
            'disco': get_disk_info(),
            'memoria': get_memory_info(),
            'servicos': get_services_status(),
            'postgres': check_postgres_connection()
        }
        print(json.dumps(data, indent=2))
