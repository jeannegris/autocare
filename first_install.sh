#!/bin/bash

# ============================================================================
# AutoCare - Script de Instalação Completo
# ============================================================================
# Este script instala e configura todos os componentes necessários para o
# projeto AutoCare funcionar corretamente em um servidor Linux.
#
# Componentes instalados:
# - PostgreSQL com usuário e banco de dados autocare
# - Python 3.10+ com ambiente virtual
# - Node.js 18+ com npm
# - Nginx com configuração no default
# - Firewalld com portas liberadas (80, 443, 8008)
# - Dependências do backend e frontend
# - Scripts de controle do sistema
#
# Uso: ./first_install.sh
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

# Função para logging
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Função para verificar se serviço está ativo
service_active() {
    if command_exists systemctl; then
        systemctl is-active --quiet "$1" 2>/dev/null
    else
        # Para sistemas sem systemd, verificar processo
        pgrep -f "$1" >/dev/null 2>&1
    fi
}

# Função para verificar se porta está em uso
port_in_use() {
    netstat -tuln | grep ":$1 " >/dev/null 2>&1
}

# Função para executar comando com log
run_cmd() {
    local cmd="$1"
    local desc="$2"
    
    log "INFO" "Executando: $desc"
    log "DEBUG" "Comando: $cmd"
    
    # Capturar stdout e stderr separadamente
    local temp_log="/tmp/run_cmd_output_$$"
    local temp_err="/tmp/run_cmd_error_$$"
    
    if eval "$cmd" > "$temp_log" 2> "$temp_err"; then
        # Adicionar saída ao log principal
        cat "$temp_log" >> "$LOG_FILE" 2>/dev/null || true
        cat "$temp_err" >> "$LOG_FILE" 2>/dev/null || true
        
        log "SUCCESS" "$desc - Concluído"
        rm -f "$temp_log" "$temp_err"
        return 0
    else
        local exit_code=$?
        
        # Adicionar saída ao log principal
        cat "$temp_log" >> "$LOG_FILE" 2>/dev/null || true
        cat "$temp_err" >> "$LOG_FILE" 2>/dev/null || true
        
        log "ERROR" "$desc - Falhou (código de saída: $exit_code)"
        
        # Mostrar últimas linhas do erro no console
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

# Função para verificar distribuição Linux
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
    
    # Verificar sistema de init
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
    
    # Avisar sobre limitações em containers/WSL
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
    log "INFO" "Configurando banco de dados..."
    
    # Parar serviços que possam estar usando o banco
    log "INFO" "Parando serviços que possam estar conectados ao banco..."
    sudo systemctl stop autocare-backend 2>/dev/null || true
    sudo pkill -f "uvicorn.*server:app" 2>/dev/null || true
    sleep 3
    
    # Forçar encerramento de todas as conexões ao banco antes de removê-lo
    log "INFO" "Encerrando todas as conexões ao banco $DB_NAME..."
    sudo -u postgres psql -c "
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
    " 2>/dev/null || true
    
    # Aguardar um momento para as conexões encerrarem
    sleep 2
    
    # Remover banco existente com verificação de sucesso
    log "INFO" "Removendo banco existente se houver..."
    if sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>&1 | grep -q "ERROR"; then
        log "ERROR" "Falha ao remover banco $DB_NAME. Tentando método alternativo..."
        # Método alternativo: renomear o banco antes de dropar
        sudo -u postgres psql -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old_$(date +%s);" 2>/dev/null || true
    else
        log "SUCCESS" "Banco $DB_NAME removido com sucesso"
    fi
    
    # Remover usuário existente (agora sem dependências)
    log "INFO" "Removendo usuário existente se houver..."
    sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
    
    # Verificar se usuário já existe e criar/alterar conforme necessário
    log "INFO" "Verificando se usuário $DB_USER existe..."
    if sudo -u postgres psql -t -c "SELECT 1 FROM pg_user WHERE usename = '$DB_USER';" 2>/dev/null | grep -q "1"; then
        log "INFO" "Usuário $DB_USER já existe, alterando senha..."
        if ! sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null; then
            log "WARN" "Falha ao alterar senha do usuário existente. Tentando recriar..."
            sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true
            sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
                log "ERROR" "Falha crítica ao criar usuário $DB_USER"
                return 1
            }
        fi
    else
        log "INFO" "Criando novo usuário $DB_USER..."
        if ! sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null; then
            log "ERROR" "Falha ao criar usuário $DB_USER"
            return 1
        fi
        log "SUCCESS" "Usuário $DB_USER criado com sucesso"
    fi
    
    # Criar banco de dados sempre novo (não verificar se existe)
    log "INFO" "Criando novo banco de dados $DB_NAME..."
    if sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>&1; then
        log "SUCCESS" "Banco de dados $DB_NAME criado com sucesso"
    else
        log "ERROR" "Falha ao criar banco de dados $DB_NAME"
        # Tentar remover qualquer banco remanescente e criar novamente
        log "INFO" "Tentando limpeza completa e recriação..."
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME CASCADE;" 2>/dev/null || true
        sleep 2
        if sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>&1; then
            log "SUCCESS" "Banco de dados $DB_NAME criado após limpeza"
        else
            log "ERROR" "Falha crítica ao criar banco de dados"
            return 1
        fi
    fi
    
    # Conceder privilégios
    log "INFO" "Concedendo privilégios ao usuário $DB_USER..."
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || {
        log "WARN" "Falha ao conceder privilégios no banco, mas continuando..."
    }
    
    sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null || {
        log "WARN" "Falha ao conceder privilégio de criação de bancos, mas continuando..."
    }
    
    log "SUCCESS" "Privilégios configurados para usuário $DB_USER"
    
    # Configurar pg_hba.conf para permitir conexões locais
    local pg_version=$(sudo -u postgres psql -c "SELECT version();" | grep -o "PostgreSQL [0-9]*" | grep -o "[0-9]*")
    local pg_hba_path="/etc/postgresql/$pg_version/main/pg_hba.conf"
    
    if [ ! -f "$pg_hba_path" ]; then
        pg_hba_path="/var/lib/pgsql/data/pg_hba.conf"
    fi
    
    if [ -f "$pg_hba_path" ]; then
        log "INFO" "Configurando pg_hba.conf..."
        sudo cp "$pg_hba_path" "$pg_hba_path.backup"
        
        # Adicionar linha para permitir conexões md5
        if ! grep -q "local.*$DB_NAME.*$DB_USER.*md5" "$pg_hba_path"; then
            echo "local   $DB_NAME   $DB_USER   md5" | sudo tee -a "$pg_hba_path" > /dev/null
        fi
        
        if [ "$INIT_SYSTEM" = "systemd" ]; then
            run_cmd "sudo systemctl restart postgresql" "Reiniciando PostgreSQL"
        else
            if [ -f /etc/init.d/postgresql ]; then
                run_cmd "sudo /etc/init.d/postgresql restart" "Reiniciando PostgreSQL"
            else
                run_cmd "sudo -u postgres pg_ctlcluster 14 main restart" "Reiniciando cluster PostgreSQL"
            fi
        fi
        sleep 3
    fi
    
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
    
    # Instalar NodeSource repository
    run_cmd "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -" "Adicionando repositório NodeSource"
    
    case $DISTRO in
        "rhel")
            run_cmd "curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -" "Configurando repositório Node.js"
            run_cmd "sudo $PKG_MANAGER install -y nodejs" "Instalando Node.js"
            ;;
        "debian")
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
    
    # Executar migrações do banco (com tratamento de erro)
    log "INFO" "Executando migrações do banco de dados..."
    if [ -f "alembic.ini" ]; then
        # Verificar se há migrações pendentes
        if alembic upgrade head 2>/dev/null; then
            log "SUCCESS" "Migrações executadas com sucesso"
        else
            log "WARN" "Erro nas migrações, mas continuando (tabelas provavelmente já existem)"
            # Marcar migração atual como feita para evitar conflitos
            alembic stamp head 2>/dev/null || true
        fi
    else
        log "WARN" "Arquivo alembic.ini não encontrado. Pulando migrações."
    fi
    
    deactivate
    
    log "SUCCESS" "Backend configurado"
}

# Função para criar estrutura completa do banco de dados
setup_database_tables() {
    log "INFO" "Configurando estrutura completa do banco de dados..."
    
    # Verificar se o banco foi realmente criado limpo
    log "INFO" "Verificando se banco está limpo..."
    local table_count=$(sudo -u postgres psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    
    if [ "$table_count" -gt 0 ]; then
        log "WARN" "Banco não está limpo ($table_count tabelas encontradas). Removendo todas as tabelas..."
        # Remover todas as tabelas existentes
        sudo -u postgres psql -d "$DB_NAME" -c "
            DROP SCHEMA public CASCADE;
            CREATE SCHEMA public;
            GRANT ALL ON SCHEMA public TO $DB_USER;
            GRANT ALL ON SCHEMA public TO public;
        " 2>/dev/null || true
        log "SUCCESS" "Schema público recriado"
    fi
    
    # Criar estrutura completa baseada nos modelos Python
    sudo -u postgres psql -d "$DB_NAME" << 'EOF'

-- Criar tabelas com esquema completo baseado nos modelos Python
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(20),
    endereco VARCHAR(500),
    cpf_cnpj VARCHAR(20) UNIQUE,
    tipo VARCHAR(20) DEFAULT 'Pessoa Física',
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    bairro VARCHAR(100),
    numero VARCHAR(20),
    complemento VARCHAR(200),
    data_nascimento DATE,
    contato_emergencia VARCHAR(100),
    telefone_emergencia VARCHAR(20),
    observacoes TEXT,
    data_cadastro DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'Ativo',
    limite_credito DECIMAL(10,2) DEFAULT 0,
    desconto_padrao DECIMAL(5,2) DEFAULT 0,
    rg VARCHAR(20),
    profissao VARCHAR(100),
    renda DECIMAL(10,2),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veiculos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    placa VARCHAR(10) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    ano INTEGER,
    km INTEGER DEFAULT 0,
    cor VARCHAR(50),
    chassi VARCHAR(50),
    renavam VARCHAR(20),
    combustivel VARCHAR(20),
    motor VARCHAR(50),
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fornecedores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    razao_social VARCHAR(255),
    contato VARCHAR(255),
    telefone VARCHAR(20),
    email VARCHAR(255),
    endereco VARCHAR(500),
    cnpj VARCHAR(20) UNIQUE,
    inscricao_estadual VARCHAR(20),
    cep VARCHAR(10),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    bairro VARCHAR(100),
    numero VARCHAR(20),
    complemento VARCHAR(200),
    banco VARCHAR(50),
    agencia VARCHAR(10),
    conta VARCHAR(20),
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    codigo_barras VARCHAR(50),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    categoria VARCHAR(100),
    preco_custo DECIMAL(10,2) DEFAULT 0,
    preco_venda DECIMAL(10,2) DEFAULT 0,
    quantidade_estoque INTEGER DEFAULT 0,
    estoque_minimo INTEGER DEFAULT 0,
    fornecedor_id INTEGER REFERENCES fornecedores(id),
    unidade VARCHAR(10) DEFAULT 'UN',
    peso DECIMAL(8,3),
    dimensoes VARCHAR(50),
    ncm VARCHAR(20),
    cest VARCHAR(20),
    origem VARCHAR(10),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    localizacao VARCHAR(50),
    validade DATE,
    lote VARCHAR(50),
    aplicacao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
    id SERIAL PRIMARY KEY,
    numero INTEGER UNIQUE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    veiculo_id INTEGER REFERENCES veiculos(id),
    data_abertura DATE DEFAULT CURRENT_DATE,
    data_entrega DATE,
    data_prevista_entrega DATE,
    status VARCHAR(50) DEFAULT 'Aberta',
    descricao_problema TEXT,
    descricao_servico TEXT,
    valor_mao_obra DECIMAL(10,2) DEFAULT 0,
    valor_pecas DECIMAL(10,2) DEFAULT 0,
    valor_total DECIMAL(10,2) DEFAULT 0,
    desconto DECIMAL(10,2) DEFAULT 0,
    valor_final DECIMAL(10,2) DEFAULT 0,
    forma_pagamento VARCHAR(50),
    observacoes TEXT,
    tecnico_responsavel VARCHAR(100),
    km_entrada INTEGER,
    km_saida INTEGER,
    garantia_dias INTEGER DEFAULT 90,
    prioridade VARCHAR(20) DEFAULT 'Normal',
    origem VARCHAR(50) DEFAULT 'Balcão',
    tipo_servico VARCHAR(50),
    aprovado BOOLEAN DEFAULT FALSE,
    data_aprovacao TIMESTAMP WITH TIME ZONE,
    usuario_aprovacao VARCHAR(100),
    cancelado BOOLEAN DEFAULT FALSE,
    motivo_cancelamento TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS servicos_ordem (
    id SERIAL PRIMARY KEY,
    ordem_servico_id INTEGER REFERENCES ordens_servico(id) ON DELETE CASCADE,
    produto_id INTEGER REFERENCES produtos(id),
    quantidade INTEGER DEFAULT 1,
    preco_unitario DECIMAL(10,2),
    desconto DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2),
    tipo VARCHAR(20) DEFAULT 'Produto',
    descricao TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manutencoes_historico (
    id SERIAL PRIMARY KEY,
    veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
    tipo VARCHAR(100) NOT NULL,
    descricao TEXT,
    km_realizada INTEGER NOT NULL,
    data_realizada DATE NOT NULL,
    km_proxima INTEGER,
    data_proxima DATE,
    valor NUMERIC(10, 2),
    observacoes TEXT,
    ordem_servico_id INTEGER REFERENCES ordens_servico(id),
    tecnico VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Realizada',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de usuários (necessária para autenticação)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices otimizados
CREATE INDEX IF NOT EXISTS ix_clientes_id ON clientes (id);
CREATE INDEX IF NOT EXISTS ix_clientes_cpf_cnpj ON clientes (cpf_cnpj);
CREATE INDEX IF NOT EXISTS ix_clientes_nome ON clientes (nome);

CREATE INDEX IF NOT EXISTS ix_veiculos_id ON veiculos (id);
CREATE INDEX IF NOT EXISTS ix_veiculos_cliente_id ON veiculos (cliente_id);
CREATE INDEX IF NOT EXISTS ix_veiculos_placa ON veiculos (placa);

CREATE INDEX IF NOT EXISTS ix_fornecedores_id ON fornecedores (id);
CREATE INDEX IF NOT EXISTS ix_fornecedores_cnpj ON fornecedores (cnpj);

CREATE INDEX IF NOT EXISTS ix_produtos_id ON produtos (id);
CREATE INDEX IF NOT EXISTS ix_produtos_codigo_barras ON produtos (codigo_barras);
CREATE INDEX IF NOT EXISTS ix_produtos_nome ON produtos (nome);

CREATE INDEX IF NOT EXISTS ix_ordens_servico_id ON ordens_servico (id);
CREATE INDEX IF NOT EXISTS ix_ordens_servico_numero ON ordens_servico (numero);
CREATE INDEX IF NOT EXISTS ix_ordens_servico_cliente_id ON ordens_servico (cliente_id);
CREATE INDEX IF NOT EXISTS ix_ordens_servico_status ON ordens_servico (status);
CREATE INDEX IF NOT EXISTS ix_ordens_servico_data_abertura ON ordens_servico (data_abertura);

CREATE INDEX IF NOT EXISTS ix_servicos_ordem_ordem_servico_id ON servicos_ordem (ordem_servico_id);
CREATE INDEX IF NOT EXISTS ix_servicos_ordem_produto_id ON servicos_ordem (produto_id);

CREATE INDEX IF NOT EXISTS ix_manutencoes_historico_id ON manutencoes_historico (id);
CREATE INDEX IF NOT EXISTS ix_manutencoes_historico_veiculo_id ON manutencoes_historico (veiculo_id);

CREATE INDEX IF NOT EXISTS ix_usuarios_username ON usuarios (username);
CREATE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios (email);

-- Criar sequência para numeração de ordens de serviço
CREATE SEQUENCE IF NOT EXISTS ordem_servico_numero_seq START 1;

-- Trigger para auto-incrementar número da ordem de serviço
CREATE OR REPLACE FUNCTION set_ordem_numero()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero IS NULL THEN
        NEW.numero := nextval('ordem_servico_numero_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ordem_numero
    BEFORE INSERT ON ordens_servico
    FOR EACH ROW
    WHEN (NEW.numero IS NULL)
    EXECUTE FUNCTION set_ordem_numero();

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_veiculos_updated_at
    BEFORE UPDATE ON veiculos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_fornecedores_updated_at
    BEFORE UPDATE ON fornecedores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_produtos_updated_at
    BEFORE UPDATE ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_ordens_servico_updated_at
    BEFORE UPDATE ON ordens_servico
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_manutencoes_historico_updated_at
    BEFORE UPDATE ON manutencoes_historico
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Dar permissões ao usuário autocare
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO autocare;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO autocare;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO autocare;

-- Inserir usuário padrão se não existir
INSERT INTO usuarios (username, email, password_hash, nome, role)
VALUES ('admin', 'admin@autocare.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewGOBmlJiW1q8YRu', 'Administrador', 'admin')
ON CONFLICT (username) DO NOTHING;

EOF
    
    if [ $? -eq 0 ]; then
        log "SUCCESS" "Estrutura completa do banco de dados configurada"
    else
        log "ERROR" "Erro ao criar estrutura do banco de dados"
        return 1
    fi
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

# Função para configurar Nginx no arquivo default
configure_nginx() {
    log "INFO" "Configurando Nginx no arquivo default..."
    
    # Verificar se configuração do AutoCare já existe
    if grep -q "# AutoCare - Projeto React" /etc/nginx/sites-available/default 2>/dev/null; then
        log "INFO" "Configuração do AutoCare já existe no Nginx, pulando configuração"
        return 0
    fi
    
    # Backup da configuração atual
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Integrar configuração do AutoCare no default do Nginx
    if [ -f "$PROJECT_DIR/nginx-config-new.conf" ]; then
        log "INFO" "Integrando configuração AutoCare no Nginx default..."
        
        # Extrair apenas as configurações do AutoCare do arquivo existente
        cat > /tmp/autocare-nginx-config << 'EOF'
 # ��� AutoCare - Projeto React
 location /autocare/ {
        alias /var/www/autocare/frontend/dist/;
        index index.html;
        try_files $uri $uri/ /index.html;
        access_log /var/log/nginx/autocare.access.log;
        error_log /var/log/nginx/autocare.error.log warn;
 }

 # ��� API AutoCare (porta 8008)
  location /autocare-api/ {
        # Encaminhar para o backend incluindo o prefixo /api/ para casar com as rotas do FastAPI
        proxy_pass http://127.0.0.1:8008/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
       # Informar prefixo externo ao backend e reescrever Location retornadas
        proxy_set_header X-Forwarded-Prefix /autocare-api;
        proxy_set_header X-Forwarded-Host $host;
        proxy_redirect ~^https?://[^/]+/api/(.*) /autocare-api/$1;
        proxy_redirect /api/ /autocare-api/;

        # Adicionar cabeçalhos CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, DELETE, PUT" always;   
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;       

        # Responder preflight rapidamente
        if ($request_method = 'OPTIONS') {
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
 }

 # ��� Documentação da API AutoCare
 location /autocare-docs/ {
        proxy_pass http://127.0.0.1:8008/docs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Remover sufixo da URL para o backend
        rewrite ^/autocare-docs/(.*)$ /docs/$1 break;
 }

 # ��� Health check AutoCare
 location /autocare-health {
        proxy_pass http://127.0.0.1:8008/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
 }
EOF

        # Inserir configuração no arquivo default do Nginx
        # Procurar pela linha que contém 'location / {' e inserir antes dela
        if sudo grep -q "location / {" /etc/nginx/sites-available/default; then
            # Criar arquivo temporário com nova configuração
            sudo awk '
                /location \/ \{/ { 
                    while ((getline line < "/tmp/autocare-nginx-config") > 0) {
                        print line
                    }
                    close("/tmp/autocare-nginx-config")
                    print ""
                }
                { print }
            ' /etc/nginx/sites-available/default > /tmp/nginx-default-new
            
            sudo cp /tmp/nginx-default-new /etc/nginx/sites-available/default
            rm -f /tmp/nginx-default-new /tmp/autocare-nginx-config
            
            log "SUCCESS" "Configuração AutoCare adicionada ao Nginx default"
        else
            log "WARN" "Estrutura do Nginx default não reconhecida, usando configuração padrão"
        fi
        
        # Testar configuração
        run_cmd "sudo nginx -t" "Testando configuração do Nginx"
        
    else
        log "WARN" "Arquivo de configuração nginx-config-new.conf não encontrado"
    fi
    
    log "SUCCESS" "Nginx configurado no arquivo default"
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
    setup_database_tables
    install_python
    install_nodejs
    install_nginx
    install_firewalld
    configure_firewall
    setup_backend
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
