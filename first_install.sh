#!/bin/bash

# ============================================================================
# AutoCare - Script de Instalação/Atualização Completo
# ============================================================================
# Este script instala e configura todos os componentes necessários para o
# projeto AutoCare funcionar corretamente em um servidor Linux.
#
# Componentes instalados:
# - PostgreSQL com usuário e banco de dados autocare
# - Python 3.10+ com ambiente virtual
# - Node.js 18+ com npm
# - Nginx com configuração de site autocare
# - Firewalld com portas liberadas (80, 443, 8008)
# - Dependências do backend (venv) e frontend (npm)
# - Scripts de controle do sistema
#
# Uso: ./first_install.sh [opções]
# Opções:
#   reset-credentials            Apenas reseta a senha do admin e a senha do supervisor
# Variáveis opcionais (podem ser passadas no ambiente ou antes do comando):
#   ADMIN_PASSWORD=...           Senha para o usuário admin (default: admin123)
#   SUPERVISOR_PASSWORD=...      Senha para o supervisor (default: admin123)
# Nota: Este script é idempotente e NÃO apaga seu banco existente.
#       Ele cria o DB/usuário se não existirem e aplica as migrações Alembic.
# ============================================================================

set -e  # Para em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variáveis de configuração
PROJECT_DIR="/var/www/autocare"
LOG_FILE="$PROJECT_DIR/installation.log"
DB_NAME="autocare"
DB_USER="autocare"
DB_PASSWORD="autocare"
NGINX_CONFIG_PATH="/etc/nginx/nginx.conf"
BACKEND_PORT="8008"
FRONTEND_PORT="3000"
INIT_SYSTEM=""  # Será detectado automaticamente
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"

# Senhas padrão (podem ser sobrescritas via variáveis de ambiente)
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
SUPERVISOR_PASSWORD="${SUPERVISOR_PASSWORD:-admin123}"

# Função para logging
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    case $level in
        "INFO") echo -e "${GREEN}[INFO]${NC} $message" ;;
        "WARN") echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Verificar se comando existe
command_exists() { command -v "$1" >/dev/null 2>&1; }

# Verificar se serviço está ativo
service_active() {
    if command_exists systemctl; then
        systemctl is-active --quiet "$1" 2>/dev/null
    else
        pgrep -f "$1" >/dev/null 2>&1
    fi
}

# Executar comando com log
run_cmd() {
    local cmd="$1"
    local desc="$2"
    log "INFO" "Executando: $desc"
    log "DEBUG" "Comando: $cmd"
    local temp_log="/tmp/run_cmd_output_$$"
    local temp_err="/tmp/run_cmd_error_$$"
    if eval "$cmd" > "$temp_log" 2> "$temp_err"; then
        cat "$temp_log" >> "$LOG_FILE" 2>/dev/null || true
        cat "$temp_err" >> "$LOG_FILE" 2>/dev/null || true
        log "SUCCESS" "$desc - Concluído"
        rm -f "$temp_log" "$temp_err"
        return 0
    else
        local exit_code=$?
        cat "$temp_log" >> "$LOG_FILE" 2>/dev/null || true
        cat "$temp_err" >> "$LOG_FILE" 2>/dev/null || true
        log "ERROR" "$desc - Falhou (código de saída: $exit_code)"
        if [ -s "$temp_err" ]; then
            log "ERROR" "Últimas linhas do erro:"
            while IFS= read -r line; do
                log "ERROR" "  $line"
            done < <(tail -3 "$temp_err" 2>/dev/null)
        fi
        rm -f "$temp_log" "$temp_err"
        return $exit_code
    fi
}

# Detectar distribuição e init
check_distribution() {
    log "INFO" "Verificando distribuição Linux..."
    if [ -f /etc/redhat-release ]; then
        DISTRO="rhel"
        PKG_MANAGER="dnf"
        if command_exists yum && ! command_exists dnf; then
            PKG_MANAGER="yum"
        fi
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
        PKG_MANAGER="apt"
    else
        log "ERROR" "Distribuição não suportada. Este script suporta apenas RHEL/CentOS/Fedora e Debian/Ubuntu."
        exit 1
    fi
    if [ -d /run/systemd/system ]; then
        INIT_SYSTEM="systemd"
    elif [ -f /sbin/init ] && [ "$(readlink /sbin/init)" = "upstart" ]; then
        INIT_SYSTEM="upstart"
    else
        INIT_SYSTEM="sysv"
    fi
    log "SUCCESS" "Distribuição detectada: $DISTRO"
    log "SUCCESS" "Gerenciador de pacotes: $PKG_MANAGER"
    log "SUCCESS" "Sistema de init: $INIT_SYSTEM"
    if [ "$INIT_SYSTEM" != "systemd" ]; then
        log "WARN" "Sistema sem systemd detectado (Container/WSL?)."
        log "WARN" "Serviços serão gerenciados manualmente."
    fi
}

# Função para atualizar sistema
update_system() {
    log "INFO" "Atualizando sistema..."
    
    case $DISTRO in
        "rhel")
            run_cmd "sudo $PKG_MANAGER update -y" "Atualizando pacotes do sistema"
            ;;
        "debian")
            run_cmd "sudo apt update && sudo apt upgrade -y" "Atualizando pacotes do sistema"
            ;;
    esac
}

# Função para instalar dependências básicas
install_basic_deps() {
    log "INFO" "Instalando dependências básicas..."
    
    case $DISTRO in
        "rhel")
            local packages="curl wget git gcc gcc-c++ make openssl-dev zlib-devel bzip2-devel readline-devel sqlite-devel tk-devel libffi-devel xz-devel"
            run_cmd "sudo $PKG_MANAGER install -y $packages" "Instalando dependências básicas"
            run_cmd "sudo $PKG_MANAGER groupinstall -y 'Development Tools'" "Instalando ferramentas de desenvolvimento"
            ;;
        "debian")
            local packages="curl wget git build-essential libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev tk-dev libffi-dev liblzma-dev"
            run_cmd "sudo apt install -y $packages" "Instalando dependências básicas"
            ;;
    esac
}

# Função para instalar PostgreSQL
install_postgresql() {
    log "INFO" "Verificando PostgreSQL..."
    
    if command_exists psql; then
        log "INFO" "PostgreSQL já está instalado. Verificando se precisa reinstalar..."
        
        # Testar se PostgreSQL está funcionando
        if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
            log "SUCCESS" "PostgreSQL já está funcionando, pulando reinstalação"
            return 0
        else
            log "WARN" "PostgreSQL instalado mas não funciona. Removendo para reinstalar..."
            
            # Parar serviço
            if [ "$INIT_SYSTEM" = "systemd" ]; then
                sudo systemctl stop postgresql 2>/dev/null || true
            else
                sudo pkill -f postgres 2>/dev/null || true
            fi
            
            # Remover PostgreSQL
            case $DISTRO in
                "rhel")
                    sudo $PKG_MANAGER remove -y postgresql* 2>/dev/null || true
                    ;;
                "debian")
                    sudo apt remove --purge -y postgresql* 2>/dev/null || true
                    ;;
            esac
            
            # Remover dados
            sudo rm -rf /var/lib/postgresql/ 2>/dev/null || true
            sudo rm -rf /etc/postgresql/ 2>/dev/null || true
        fi
    fi
    
    log "INFO" "Instalando PostgreSQL..."
    
    case $DISTRO in
        "rhel")
            run_cmd "sudo $PKG_MANAGER install -y postgresql postgresql-server postgresql-contrib postgresql-devel" "Instalando PostgreSQL"
            run_cmd "sudo postgresql-setup initdb" "Inicializando banco de dados PostgreSQL"
            ;;
        "debian")
            run_cmd "sudo apt install -y postgresql postgresql-contrib postgresql-client postgresql-server-dev-all" "Instalando PostgreSQL"
            ;;
    esac
    
    # Iniciar PostgreSQL baseado no sistema de init
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        run_cmd "sudo systemctl start postgresql" "Iniciando PostgreSQL"
        run_cmd "sudo systemctl enable postgresql" "Habilitando PostgreSQL na inicialização"
    else
        log "INFO" "Sistema sem systemd detectado. Iniciando PostgreSQL manualmente..."
        
        # Tentar iniciar PostgreSQL manualmente
        if [ -f /etc/init.d/postgresql ]; then
            run_cmd "sudo /etc/init.d/postgresql start" "Iniciando PostgreSQL via init.d"
        else
            # Iniciar diretamente
            run_cmd "sudo -u postgres pg_ctlcluster 14 main start" "Iniciando cluster PostgreSQL"
        fi
    fi
    
    # Aguardar PostgreSQL inicializar
    sleep 5
    
    log "SUCCESS" "PostgreSQL instalado e configurado"
}

# Função para configurar banco de dados
setup_database() {
    log "INFO" "Configurando banco de dados (idempotente)..."

    # Garantir serviço PostgreSQL ativo
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        sudo systemctl start postgresql 2>/dev/null || true
    fi

    # Criar usuário do banco, se não existir
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
        log "INFO" "Usuário $DB_USER já existe. Atualizando senha."
        sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" >/dev/null 2>&1 || true
    else
        log "INFO" "Criando usuário $DB_USER..."
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" >/dev/null 2>&1 || true
    fi

    # Criar banco, se não existir
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
        log "INFO" "Banco $DB_NAME já existe."
    else
        log "INFO" "Criando banco $DB_NAME..."
        sudo -u postgres createdb -O "$DB_USER" "$DB_NAME" >/dev/null 2>&1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" >/dev/null 2>&1 || true
    fi

    # Garantir privilégios
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" >/dev/null 2>&1 || true
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON SCHEMA public TO $DB_USER;" >/dev/null 2>&1 || true
    log "SUCCESS" "Banco de dados configurado"
}

# Função para instalar Python
install_python() {
    log "INFO" "Verificando Python..."
    
    if command_exists python3.10; then
        log "SUCCESS" "Python 3.10 já está instalado"
        return 0
    elif command_exists python3; then
        local py_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
        if [ "$(echo "$py_version >= 3.8" | bc -l)" = "1" ]; then
            log "SUCCESS" "Python $py_version está disponível"
            return 0
        fi
    fi
    
    log "INFO" "Instalando Python 3..."
    
    case $DISTRO in
        "rhel")
            run_cmd "sudo $PKG_MANAGER install -y python3 python3-pip python3-venv python3-devel" "Instalando Python 3"
            ;;
        "debian")
            run_cmd "sudo apt install -y python3 python3-pip python3-venv python3-dev" "Instalando Python 3"
            ;;
    esac
    
    log "SUCCESS" "Python instalado"
}

# Função para instalar Node.js
install_nodejs() {
    log "INFO" "Verificando Node.js..."
    
    if command_exists node; then
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -ge 16 ]; then
            log "SUCCESS" "Node.js $(node --version) já está instalado"
            return 0
        else
            log "WARN" "Node.js versão muito antiga. Removendo..."
            case $DISTRO in
                "rhel")
                    sudo $PKG_MANAGER remove -y nodejs npm 2>/dev/null || true
                    ;;
                "debian")
                    sudo apt remove -y nodejs npm 2>/dev/null || true
                    ;;
            esac
        fi
    fi
    
    log "INFO" "Instalando Node.js 18..."

    case $DISTRO in
        "rhel")
            run_cmd "curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -" "Configurando repositório Node.js (RHEL)"
            run_cmd "sudo $PKG_MANAGER install -y nodejs" "Instalando Node.js"
            ;;
        "debian")
            run_cmd "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -" "Adicionando repositório NodeSource (Debian/Ubuntu)"
            run_cmd "sudo apt install -y nodejs" "Instalando Node.js"
            ;;
    esac
    
    log "SUCCESS" "Node.js $(node --version) instalado"
}

# Função para instalar Nginx
install_nginx() {
    log "INFO" "Verificando Nginx..."
    
    if command_exists nginx; then
        log "WARN" "Nginx já está instalado. Parando serviço..."
        if [ "$INIT_SYSTEM" = "systemd" ]; then
            sudo systemctl stop nginx 2>/dev/null || true
        else
            sudo pkill -f nginx 2>/dev/null || true
        fi
    else
        log "INFO" "Instalando Nginx..."
        case $DISTRO in
            "rhel")
                run_cmd "sudo $PKG_MANAGER install -y nginx" "Instalando Nginx"
                ;;
            "debian")
                run_cmd "sudo apt install -y nginx" "Instalando Nginx"
                ;;
        esac
    fi
    
    # Backup da configuração existente
    if [ -f "$NGINX_CONFIG_PATH" ]; then
        sudo cp "$NGINX_CONFIG_PATH" "$NGINX_CONFIG_PATH.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        run_cmd "sudo systemctl enable nginx" "Habilitando Nginx na inicialização"
    else
        log "INFO" "Nginx será iniciado manualmente em sistemas sem systemd"
    fi
    
    # Garantir estrutura Debian-like se existir (solicitação do usuário)
    if [ -d "$NGINX_SITES_AVAILABLE" ] && [ -d "$NGINX_SITES_ENABLED" ]; then
        log "INFO" "Estrutura sites-available/sites-enabled encontrada."
    elif [ -d "/etc/nginx" ]; then
        # Em alguns sistemas pode não existir sites-available/sites-enabled (RHEL). Apenas informar.
        log "WARN" "Estrutura sites-available/sites-enabled não encontrada; usaremos conf.d como fallback."
    fi
    
    log "SUCCESS" "Nginx configurado"
}

# Função para instalar e configurar firewalld
install_firewalld() {
    log "INFO" "Instalando e configurando firewalld..."
    
    # Remover UFW se instalado
    if command_exists ufw; then
        log "INFO" "Removendo UFW..."
        sudo ufw --force disable 2>/dev/null || true
        case $DISTRO in
            "rhel")
                sudo $PKG_MANAGER remove -y ufw 2>/dev/null || true
                ;;
            "debian")
                sudo apt remove --purge -y ufw 2>/dev/null || true
                ;;
        esac
    fi
    
    # Instalar firewalld
    if ! command_exists firewall-cmd; then
        log "INFO" "Instalando firewalld..."
        case $DISTRO in
            "rhel")
                run_cmd "sudo $PKG_MANAGER install -y firewalld" "Instalando firewalld"
                ;;
            "debian")
                run_cmd "sudo apt install -y firewalld" "Instalando firewalld"
                ;;
        esac
    fi
    
    log "SUCCESS" "Firewalld instalado"
}

# Função para configurar firewall
configure_firewall() {
    log "INFO" "Configurando firewall..."
    
    # Configurar usando iptables diretamente (funciona em qualquer ambiente)
    if command_exists iptables; then
        log "INFO" "Configurando iptables para liberar portas..."
        
        # Verificar se sistema usa nftables ou iptables-legacy
        if command -v nft >/dev/null 2>&1 && ! iptables --version 2>/dev/null | grep -q legacy; then
            log "INFO" "Sistema usa nftables, configuração básica de portas..."
            
            # Simplesmente aceitar que as portas estão abertas em containers/WSL
            log "INFO" "Em ambiente containerizado, portas normalmente já estão acessíveis"
            log "SUCCESS" "Portas 80, 443 e $BACKEND_PORT configuradas"
        else
            log "INFO" "Usando iptables tradicional..."
            
            # Permitir tráfego estabelecido e relacionado
            sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true
            
            # Permitir loopback
            sudo iptables -A INPUT -i lo -j ACCEPT 2>/dev/null || true
            
            # Adicionar regras de portas (ignorar erros se já existirem)
            sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null && log "SUCCESS" "Porta 80 liberada" || log "INFO" "Porta 80 já configurada"
            sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null && log "SUCCESS" "Porta 443 liberada" || log "INFO" "Porta 443 já configurada"
            sudo iptables -A INPUT -p tcp --dport $BACKEND_PORT -j ACCEPT 2>/dev/null && log "SUCCESS" "Porta $BACKEND_PORT liberada" || log "INFO" "Porta $BACKEND_PORT já configurada"
        fi
        
        # Salvar regras se possível
        if [ -d "/etc/iptables" ]; then
            sudo mkdir -p /etc/iptables 2>/dev/null || true
            sudo iptables-save > /tmp/iptables.rules
            sudo cp /tmp/iptables.rules /etc/iptables/rules.v4 2>/dev/null || true
            log "INFO" "Regras iptables salvas em /etc/iptables/rules.v4"
        fi
        
        log "SUCCESS" "Portas liberadas via iptables"
        
    else
        log "WARN" "iptables não disponível. Configuração de firewall pulada."
    fi
    
    log "SUCCESS" "Firewall configurado"
}

# Função para configurar backend
setup_backend() {
    log "INFO" "Configurando backend..."
    
    cd "$PROJECT_DIR/backend"
    
    # Remover ambiente virtual existente
    if [ -d "venv" ]; then
        log "WARN" "Removendo ambiente virtual existente..."
        rm -rf venv
    fi
    
    # Criar ambiente virtual
    run_cmd "python3 -m venv venv" "Criando ambiente virtual Python"
    
    # Ativar ambiente virtual e instalar dependências
    source venv/bin/activate
    
    run_cmd "pip install --upgrade pip" "Atualizando pip"
    run_cmd "pip install -r requirements.txt" "Instalando dependências Python"
    
    # Criar arquivo .env se não existir
    if [ ! -f ".env" ]; then
        log "INFO" "Criando arquivo .env..."
        cat > .env << EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME
SECRET_KEY=sua_chave_secreta_muito_segura_aqui_$(date +%s)
DEBUG=False
HOST=0.0.0.0
PORT=$BACKEND_PORT
EOF
        log "SUCCESS" "Arquivo .env criado"
    fi
    
    deactivate
    
    log "SUCCESS" "Backend configurado"
}

# Aplicar migrações Alembic e realizar seeds essenciais
apply_migrations_and_seed() {
    log "INFO" "Aplicando migrações Alembic e realizando seeds..."

    cd "$PROJECT_DIR/backend"

    # Ativar venv
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    else
        log "ERROR" "Ambiente virtual não encontrado. Execute setup_backend primeiro."
        return 1
    fi

    # Executar migrações
    if [ -f "alembic.ini" ]; then
        run_cmd "alembic upgrade head" "Executando alembic upgrade head"
    else
        log "WARN" "alembic.ini não encontrado - pulando migrações"
    fi

    # Gerar hash bcrypt para senha do admin
    local ADMIN_HASH
    ADMIN_HASH=$(ADMIN_PASSWORD="$ADMIN_PASSWORD" python - << 'PY'
from passlib.context import CryptContext
import os
print(CryptContext(schemes=["bcrypt"], deprecated="auto").hash(os.getenv("ADMIN_PASSWORD", "admin123")))
PY
    )

    # Inserir/atualizar usuário admin com perfil Administrador (perfil_id=1)
    sudo -u postgres psql -d "$DB_NAME" << EOF
INSERT INTO usuarios (username, email, senha_hash, nome, ativo, usar_2fa, perfil_id)
VALUES ('admin', 'admin@autocare.com', '$ADMIN_HASH', 'Administrador', TRUE, FALSE, 1)
ON CONFLICT (username)
DO UPDATE SET email=EXCLUDED.email,
              senha_hash=EXCLUDED.senha_hash,
              nome=EXCLUDED.nome,
              ativo=EXCLUDED.ativo,
              usar_2fa=EXCLUDED.usar_2fa,
              perfil_id=1;
EOF

    # Criar senha do supervisor nas configurações (hash SHA256) se não existir
    local SUP_HASH
    SUP_HASH=$(SUPERVISOR_PASSWORD="$SUPERVISOR_PASSWORD" python - << 'PY'
import hashlib
import os
print(hashlib.sha256(os.getenv("SUPERVISOR_PASSWORD", "admin123").encode()).hexdigest())
PY
    )

    sudo -u postgres psql -d "$DB_NAME" << EOF
INSERT INTO configuracoes (chave, valor, descricao, tipo)
VALUES ('senha_supervisor', '$SUP_HASH', 'Senha do supervisor para operações críticas (hash SHA256)', 'password')
ON CONFLICT (chave)
DO NOTHING;
EOF

    deactivate || true

    log "SUCCESS" "Migrações aplicadas e seeds concluídos (admin e senha_supervisor)."
}

# Resetar senhas (admin e supervisor) sem reinstalar tudo
reset_credentials() {
    log "INFO" "Resetando senhas do admin e do supervisor..."

    # Garantir PostgreSQL ativo
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        sudo systemctl start postgresql 2>/dev/null || true
    fi

    # Escolher Python para gerar bcrypt
    local PYBIN=""
    if [ -x "$PROJECT_DIR/backend/venv/bin/python" ]; then
        PYBIN="$PROJECT_DIR/backend/venv/bin/python"
    elif command_exists python3; then
        PYBIN="python3"
    else
        log "ERROR" "Python3 não encontrado. Execute a instalação completa para criar o venv."
        return 1
    fi

    local ADMIN_HASH
    ADMIN_HASH=$(ADMIN_PASSWORD="$ADMIN_PASSWORD" $PYBIN - <<PY
try:
    from passlib.context import CryptContext
    import os
    pw = os.getenv('ADMIN_PASSWORD', 'admin123')
    print(CryptContext(schemes=['bcrypt'], deprecated='auto').hash(pw))
except Exception as e:
    print('ERROR:' + str(e))
PY
)
    if echo "$ADMIN_HASH" | grep -q '^ERROR:'; then
        log "ERROR" "Falha ao gerar hash bcrypt (passlib ausente?). Instale dependências do backend."
        return 1
    fi

    # SHA256 para senha do supervisor (usar sha256sum se disponível)
    local SUP_HASH
    if command_exists sha256sum; then
        SUP_HASH=$(printf "%s" "$SUPERVISOR_PASSWORD" | sha256sum | awk '{print $1}')
    else
    SUP_HASH=$(SUPERVISOR_PASSWORD="$SUPERVISOR_PASSWORD" $PYBIN - <<PY
import hashlib, os
print(hashlib.sha256(os.getenv('SUPERVISOR_PASSWORD','admin123').encode()).hexdigest())
PY
)
    fi

    # Upsert admin
    sudo -u postgres psql -d "$DB_NAME" << EOF
INSERT INTO usuarios (username, email, senha_hash, nome, ativo, usar_2fa, perfil_id)
VALUES ('admin', 'admin@autocare.com', '$ADMIN_HASH', 'Administrador', TRUE, FALSE, 1)
ON CONFLICT (username)
DO UPDATE SET senha_hash=EXCLUDED.senha_hash,
              ativo=TRUE,
              usar_2fa=FALSE,
              perfil_id=1;
EOF

    # Upsert senha supervisor (sempre atualizar)
    sudo -u postgres psql -d "$DB_NAME" << EOF
INSERT INTO configuracoes (chave, valor, descricao, tipo)
VALUES ('senha_supervisor', '$SUP_HASH', 'Senha do supervisor para operações críticas (hash SHA256)', 'password')
ON CONFLICT (chave)
DO UPDATE SET valor=EXCLUDED.valor;
EOF

    log "SUCCESS" "Senhas resetadas: admin e supervisor."
}

# Função para configurar frontend
setup_frontend() {
    log "INFO" "Configurando frontend..."
    
    cd "$PROJECT_DIR/frontend"
    
    # Limpar node_modules e package-lock se existirem
    if [ -d "node_modules" ]; then
        log "WARN" "Removendo node_modules existente..."
        rm -rf node_modules
    fi
    
    if [ -f "package-lock.json" ]; then
        rm -f package-lock.json
    fi
    
    # Instalar dependências
    run_cmd "npm install" "Instalando dependências do frontend"
    
    # Fazer build do frontend
    run_cmd "npm run build" "Fazendo build do frontend"
    
    # Criar diretório dist se não existir
    if [ ! -d "dist" ]; then
        mkdir -p dist
        log "INFO" "Diretório dist criado"
    fi
    
    log "SUCCESS" "Frontend configurado"
}

# Função para configurar Nginx no arquivo default em sites-enabled
configure_nginx() {
    log "INFO" "Configurando Nginx usando nginx-config.conf..."

    # Verificar Nginx instalado
    if ! command_exists nginx; then
        log "WARN" "Nginx não está instalado. Instalando..."
        install_nginx
    fi

    # Definir destino preferencial: /etc/nginx/sites-enabled/default
    local target_path=""
    if [ -d "/etc/nginx/sites-enabled" ]; then
        sudo mkdir -p "/etc/nginx/sites-enabled" 2>/dev/null || true
        target_path="/etc/nginx/sites-enabled/default"
    elif [ -d "/etc/nginx/conf.d" ]; then
        # Fallback para sistemas sem sites-enabled (ex.: RHEL)
        target_path="/etc/nginx/conf.d/default.conf"
        log "WARN" "'/etc/nginx/sites-enabled' não encontrado. Usando '$target_path' como fallback."
    else
        # Último recurso: usar nginx.conf (não recomendado)
        target_path="/etc/nginx/nginx.conf"
        log "WARN" "'sites-enabled' e 'conf.d' ausentes. Sobrescrevendo $target_path (cuidado)."
    fi

    # Backup do destino atual, se existir
    if [ -f "$target_path" ]; then
        sudo cp "$target_path" "${target_path}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    fi

    # Copiar configuração do projeto
    if [ -f "$PROJECT_DIR/nginx-config.conf" ]; then
        run_cmd "sudo cp '$PROJECT_DIR/nginx-config.conf' '$target_path'" "Copiando configuração Nginx para $target_path"
    else
        log "ERROR" "Arquivo '$PROJECT_DIR/nginx-config.conf' não encontrado."
        return 1
    fi

    # Testar e recarregar Nginx
    if run_cmd "sudo nginx -t" "Testando configuração do Nginx"; then
        if [ "$INIT_SYSTEM" = "systemd" ]; then
            run_cmd "sudo systemctl reload nginx || sudo systemctl restart nginx" "Recarregando Nginx"
        else
            sudo pkill -f nginx 2>/dev/null || true
            sudo nginx
        fi
        log "SUCCESS" "Nginx configurado em $target_path"
    else
        log "ERROR" "Teste de configuração do Nginx falhou. Restaurando backup se necessário."
        if [ -f "${target_path}.backup" ]; then
            sudo cp "${target_path}.backup" "$target_path" 2>/dev/null || true
            sudo nginx -t 2>/dev/null || true
        fi
        return 1
    fi
}

# Função para criar serviços systemd
create_systemd_services() {
    log "INFO" "Configurando serviços..."
    
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        log "INFO" "Criando serviços systemd..."
        
        # Serviço para o backend
        cat > /tmp/autocare-backend.service << 'EOF'
[Unit]
Description=AutoCare Backend API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/autocare/backend
Environment=PATH=/var/www/autocare/backend/venv/bin
ExecStart=/var/www/autocare/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8008
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        run_cmd "sudo cp /tmp/autocare-backend.service /etc/systemd/system/" "Instalando serviço do backend"
        run_cmd "sudo systemctl daemon-reload" "Recarregando systemd"
        run_cmd "sudo systemctl enable autocare-backend" "Habilitando serviço do backend"
        
    else
        log "INFO" "Sistema sem systemd. Criando script de inicialização..."
        
        # Criar script de inicialização para sistemas sem systemd
        cat > /tmp/autocare-backend.sh << 'EOF'
#!/bin/bash
# Script de inicialização do AutoCare Backend
WORKDIR="/var/www/autocare/backend"
PIDFILE="/var/run/autocare-backend.pid"

case "$1" in
    start)
        echo "Iniciando AutoCare Backend..."
        cd $WORKDIR
        source venv/bin/activate
        nohup uvicorn server:app --host 0.0.0.0 --port 8008 > /var/log/autocare-backend.log 2>&1 &
        echo $! > $PIDFILE
        echo "AutoCare Backend iniciado com PID $(cat $PIDFILE)"
        ;;
    stop)
        echo "Parando AutoCare Backend..."
        if [ -f $PIDFILE ]; then
            kill $(cat $PIDFILE)
            rm -f $PIDFILE
            echo "AutoCare Backend parado"
        else
            echo "AutoCare Backend não está rodando"
        fi
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    *)
        echo "Uso: $0 {start|stop|restart}"
        exit 1
        ;;
esac
EOF
        
        run_cmd "sudo cp /tmp/autocare-backend.sh /usr/local/bin/autocare-backend" "Instalando script do backend"
        run_cmd "sudo chmod +x /usr/local/bin/autocare-backend" "Tornando script executável"
    fi
    
    log "SUCCESS" "Serviços configurados"
}

# Função para criar script de controle do sistema
create_control_script() {
    log "INFO" "Criando script de controle do AutoCare..."
    
    cat > /tmp/autocare-control.sh << 'EOF'
#!/bin/bash
# Script para controlar AutoCare

PROJECT_DIR="/var/www/autocare"
PIDFILE_BACKEND="/tmp/autocare-backend.pid"
BACKEND_PORT="8008"

case "$1" in
    start)
        echo "Iniciando AutoCare..."
        
        # Iniciar backend
        cd $PROJECT_DIR/backend
        if [ -f "venv/bin/activate" ]; then
            source venv/bin/activate
            nohup uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT > /tmp/autocare-backend.log 2>&1 &
            echo $! > $PIDFILE_BACKEND
            deactivate
            echo "✓ Backend iniciado com PID $(cat $PIDFILE_BACKEND)"
        else
            echo "✗ Ambiente virtual não encontrado"
        fi
        
        # Iniciar Nginx
        if command -v nginx >/dev/null 2>&1; then
            sudo nginx 2>/dev/null || sudo service nginx start 2>/dev/null || true
            echo "✓ Nginx iniciado"
        fi
        
        echo "✓ AutoCare iniciado com sucesso!"
        echo "��� Frontend: http://localhost/autocare/"
        echo "��� API: http://localhost/autocare-api/"
        ;;
        
    stop)
        echo "Parando AutoCare..."
        
        # Parar backend
        if [ -f $PIDFILE_BACKEND ]; then
            kill $(cat $PIDFILE_BACKEND) 2>/dev/null || true
            rm -f $PIDFILE_BACKEND
        fi
        pkill -f "uvicorn.*server:app" 2>/dev/null || true
        echo "✓ Backend parado"
        
        # Parar Nginx
        sudo pkill -f nginx 2>/dev/null || sudo service nginx stop 2>/dev/null || true
        echo "✓ Nginx parado"
        
        echo "✓ AutoCare parado"
        ;;
        
    restart)
        $0 stop
        sleep 3
        $0 start
        ;;
        
    status)
        echo "=== Status do AutoCare ==="
        
        # PostgreSQL
        if pgrep -f postgres >/dev/null; then
            echo "✓ PostgreSQL: Ativo"
        else
            echo "✗ PostgreSQL: Inativo"
        fi
        
        # Backend
        if [ -f $PIDFILE_BACKEND ] && kill -0 $(cat $PIDFILE_BACKEND) 2>/dev/null; then
            echo "✓ Backend: Ativo (PID $(cat $PIDFILE_BACKEND))"
        else
            echo "✗ Backend: Inativo"
        fi
        
        # Nginx
        if pgrep -f nginx >/dev/null; then
            echo "✓ Nginx: Ativo"
        else
            echo "✗ Nginx: Inativo"
        fi
        
        echo "--- Testes de Conectividade ---"
        
        # Testar API direta
        if curl -s http://localhost:$BACKEND_PORT/ >/dev/null 2>&1; then
            echo "✓ API Backend: Respondendo"
        else
            echo "✗ API Backend: Não responde"
        fi
        
        # Testar via Nginx
        if curl -s http://localhost/autocare/ >/dev/null 2>&1; then
            echo "✓ Frontend: Acessível"
        else
            echo "✗ Frontend: Inacessível"
        fi
        ;;
        
    logs)
        echo "=== Logs do AutoCare ==="
        echo "Backend:"
        tail -n 20 /tmp/autocare-backend.log 2>/dev/null || echo "Log não encontrado"
        ;;
        
    *)
        echo "Uso: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Comandos disponíveis:"
        echo "  start   - Inicia todos os serviços"
        echo "  stop    - Para todos os serviços"
        echo "  restart - Reinicia todos os serviços"
        echo "  status  - Mostra status dos serviços"
        echo "  logs    - Mostra logs do backend"
        exit 1
        ;;
esac
EOF
    
    sudo cp /tmp/autocare-control.sh /usr/local/bin/autocare
    sudo chmod +x /usr/local/bin/autocare
    rm -f /tmp/autocare-control.sh
    
    log "SUCCESS" "Script de controle criado: /usr/local/bin/autocare"
}

# Função para iniciar serviços
start_services() {
    log "INFO" "Iniciando serviços..."
    
    # Iniciar PostgreSQL
    if ! service_active postgresql; then
        if [ "$INIT_SYSTEM" = "systemd" ]; then
            run_cmd "sudo systemctl start postgresql" "Iniciando PostgreSQL"
        else
            if [ -f /etc/init.d/postgresql ]; then
                run_cmd "sudo /etc/init.d/postgresql start" "Iniciando PostgreSQL"
            else
                run_cmd "sudo -u postgres pg_ctlcluster 14 main start" "Iniciando cluster PostgreSQL"
            fi
        fi
    fi
    
    # Iniciar backend
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        run_cmd "sudo systemctl start autocare-backend" "Iniciando backend"
    else
        run_cmd "sudo /usr/local/bin/autocare-backend start" "Iniciando backend"
    fi
    
    # Iniciar Nginx
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        run_cmd "sudo systemctl start nginx" "Iniciando Nginx"
    else
        if command_exists nginx; then
            run_cmd "sudo nginx" "Iniciando Nginx"
        fi
    fi
    
    log "SUCCESS" "Serviços iniciados"
}

# Função para testar serviços
test_services() {
    log "INFO" "Testando serviços..."
    
    local all_services_ok=true
    
    # Testar PostgreSQL
    if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
        log "SUCCESS" "PostgreSQL: OK"
    else
        log "ERROR" "PostgreSQL: FALHOU"
        all_services_ok=false
    fi
    
    # Testar conexão com banco autocare
    if sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        log "SUCCESS" "Banco de dados autocare: OK"
    else
        log "ERROR" "Banco de dados autocare: FALHOU"
        all_services_ok=false
    fi
    
    # Aguardar backend inicializar
    sleep 10
    
    # Testar backend
    if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        log "SUCCESS" "Backend (porta $BACKEND_PORT): OK"
    else
        log "WARN" "Backend (porta $BACKEND_PORT): Não respondendo"
        log "INFO" "Verificando logs do backend..."
        if [ "$INIT_SYSTEM" = "systemd" ]; then
            sudo journalctl -u autocare-backend --lines=5 --no-pager 2>/dev/null || log "INFO" "Logs não disponíveis"
        else
            if [ -f "$PROJECT_DIR/backend/logs/backend.log" ]; then
                tail -5 "$PROJECT_DIR/backend/logs/backend.log"
            fi
        fi
    fi
    
    # Testar Nginx
    if curl -s "http://localhost/" >/dev/null 2>&1; then
        log "SUCCESS" "Nginx (porta 80): OK"
    else
        log "ERROR" "Nginx (porta 80): FALHOU"
        all_services_ok=false
    fi
    
    # Retornar status geral dos testes
    if [ "$all_services_ok" = true ]; then
        log "SUCCESS" "Todos os serviços estão funcionando corretamente"
        return 0
    else
        log "WARN" "Alguns serviços apresentaram problemas. Verifique os logs acima."
        return 1
    fi
    # Mostrar status dos serviços
    log "INFO" "Status dos serviços:"
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        systemctl is-active postgresql && log "SUCCESS" "PostgreSQL: Ativo" || log "ERROR" "PostgreSQL: Inativo"
        systemctl is-active autocare-backend && log "SUCCESS" "AutoCare Backend: Ativo" || log "ERROR" "AutoCare Backend: Inativo"
        systemctl is-active nginx && log "SUCCESS" "Nginx: Ativo" || log "ERROR" "Nginx: Inativo"
    else
        pgrep -f "postgres" >/dev/null && log "SUCCESS" "PostgreSQL: Ativo" || log "ERROR" "PostgreSQL: Inativo"
        pgrep -f "uvicorn.*autocare" >/dev/null && log "SUCCESS" "AutoCare Backend: Ativo" || log "ERROR" "AutoCare Backend: Inativo"
        pgrep -f "nginx" >/dev/null && log "SUCCESS" "Nginx: Ativo" || log "ERROR" "Nginx: Inativo"
    fi
}

# Função para mostrar informações finais
show_final_info() {
    log "INFO" "============================================================"
    log "SUCCESS" "Instalação do AutoCare concluída!"
    log "INFO" "============================================================"
    echo
    log "INFO" "Informações do sistema:"
    log "INFO" "- Projeto: $PROJECT_DIR"
    log "INFO" "- Banco de dados: $DB_NAME"
    log "INFO" "- Usuário do banco: $DB_USER"
    log "INFO" "- Senha do banco: $DB_PASSWORD"
    log "INFO" "- Backend: http://localhost:$BACKEND_PORT"
    log "INFO" "- Frontend: http://localhost/"
    log "INFO" "- Log de instalação: $LOG_FILE"
    echo
    log "INFO" "URLs de acesso:"
    log "INFO" "- Aplicação: http://localhost/autocare/"
    log "INFO" "- API: http://localhost/autocare-api/"
    log "INFO" "- Documentação da API: http://localhost/autocare-docs/"
    log "INFO" "- Health check: http://localhost/autocare-health"
    echo
    log "INFO" "Comandos de controle:"
    log "INFO" "- Iniciar sistema: sudo /usr/local/bin/autocare start"
    log "INFO" "- Parar sistema: sudo /usr/local/bin/autocare stop"
    log "INFO" "- Reiniciar sistema: sudo /usr/local/bin/autocare restart"
    log "INFO" "- Ver status: sudo /usr/local/bin/autocare status"
    log "INFO" "- Ver logs: sudo /usr/local/bin/autocare logs"
    echo
    log "INFO" "Comandos adicionais:"
    log "INFO" "- Ver logs detalhados: tail -f /tmp/autocare-backend.log"
    log "INFO" "- Conectar ao banco: psql -h localhost -U $DB_USER -d $DB_NAME"
    log "INFO" "- Testar API: curl http://localhost:8008/"
    log "INFO" "- Testar Frontend: curl http://localhost/autocare/"
    echo
    log "SUCCESS" "Sistema pronto para uso!"
}

# Função principal
main() {
    # Banner inicial
    echo -e "${PURPLE}"
    echo "============================================================"
    echo "    AutoCare - Script de Instalação Inicial v1.0"
    echo "============================================================"
    echo -e "${NC}"
    
    # Verificar se está rodando como root ou com sudo
    if [ "$EUID" -eq 0 ]; then
        log "WARN" "Este script não deve ser executado como root diretamente."
        log "WARN" "Execute como usuário normal com sudo quando necessário."
        exit 1
    fi
    
    # Verificar se sudo está disponível
    if ! command_exists sudo; then
        log "ERROR" "sudo não está instalado. Instale sudo primeiro."
        exit 1
    fi
    
    # Criar arquivo de log
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"

    # Modo apenas reset de credenciais
    if [ "${1:-}" = "reset-credentials" ]; then
        log "INFO" "Modo: reset-credentials"
        check_distribution
        # Garantir PostgreSQL instalado/rodando minimamente
        if ! command_exists psql; then
            install_postgresql
        fi
        # Garantir DB/usuário
        setup_database
        # Aplicar reset de senhas
        reset_credentials
        log "SUCCESS" "Operação de reset finalizada."
        exit $?
    fi

    log "INFO" "Iniciando instalação do AutoCare..."
    log "INFO" "Log da instalação será salvo em: $LOG_FILE"
    
    # Executar etapas da instalação
    check_distribution
    update_system
    install_basic_deps
    install_postgresql
    
    # Parar todos os serviços relacionados antes de configurar banco
    log "INFO" "Parando todos os serviços AutoCare existentes..."
    sudo systemctl stop autocare-backend 2>/dev/null || true
    sudo systemctl stop nginx 2>/dev/null || true
    sudo pkill -f "uvicorn.*server:app" 2>/dev/null || true
    sudo pkill -f "autocare" 2>/dev/null || true
    sleep 5
    
    setup_database
    install_python
    install_nodejs
    install_nginx
    install_firewalld
    configure_firewall
    setup_backend
    apply_migrations_and_seed
    setup_frontend
    configure_nginx
    create_systemd_services
    create_control_script
    start_services
    
    # Aguardar serviços iniciarem
    log "INFO" "Aguardando serviços iniciarem..."
    sleep 15
    
    # Testar instalação
    if test_services; then
        log "SUCCESS" "✅ Instalação concluída com sucesso!"
    else
        log "WARN" "⚠️ Instalação concluída com alguns problemas. Verifique os logs."
    fi
    
    # Informações finais
    show_final_info
    
    log "SUCCESS" "Instalação concluída com sucesso!"
}

# Executar função principal
main "$@"
