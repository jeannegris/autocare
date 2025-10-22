#!/bin/bash

set -e  # Para em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Variáveis de configuração
PROJECT_DIR="/var/www/autocare"
DB_NAME="autocare"
DB_USER="autocare" 
DB_PASSWORD="autocare"
BACKEND_PORT="8008"
INIT_SYSTEM=""

# Variáveis de status
POSTGRES_STATUS="❌"
BACKEND_STATUS="❌"
NGINX_STATUS="❌"
APP_STATUS="❌"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID_FILE="/tmp/autocare_backend.pid"

# Configuração do sistema de log
BACKEND_LOG_DIR="$PROJECT_DIR/backend/logs"
LOG_FILE="$BACKEND_LOG_DIR/backend.log"

# Inicializar sistema de log
init_logging() {
    # Criar diretório de logs se não existir
    mkdir -p "$BACKEND_LOG_DIR"
    
    # Se backend.log já existir, fazer backup
    if [ -f "$LOG_FILE" ]; then
        mv "$LOG_FILE" "$BACKEND_LOG_DIR/backend_old.log"
    fi
    
    # Criar novo arquivo de log
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"
}

# Função para logging (compatível com first_install.sh)
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
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null || true
}

# Detectar sistema de init (mesma lógica do first_install.sh)
detect_init_system() {
    if [ -d /run/systemd/system ]; then
        INIT_SYSTEM="systemd"
    elif [ -f /sbin/init ] && [ "$(readlink /sbin/init)" = "upstart" ]; then
        INIT_SYSTEM="upstart"  
    else
        INIT_SYSTEM="sysv"
    fi
}

function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Função para verificar se serviço está ativo (mesma do first_install.sh)
service_active() {
    if command_exists systemctl && [ "$INIT_SYSTEM" = "systemd" ]; then
        systemctl is-active --quiet "$1" 2>/dev/null
    else
        # Para sistemas sem systemd, verificar processo
        pgrep -f "$1" >/dev/null 2>&1
    fi
}

function is_port_listening() {
    local port="$1"
    ss -ltn 2>/dev/null | grep -q ":${port} \|:${port}$" || netstat -tuln 2>/dev/null | grep ":$port " >/dev/null 2>&1
}

function wait_for_port() {
    local port="$1"
    local retries="${2:-15}"
    local i=0
    while [ $i -lt $retries ]; do
        if is_port_listening "$port"; then
            return 0
        fi
        sleep 1
        i=$((i+1))
    done
    return 1
}

function wait_for_port_down() {
    local port="$1"
    local retries="${2:-15}"
    local i=0
    while [ $i -lt $retries ]; do
        if ! is_port_listening "$port"; then
            return 0
        fi
        sleep 1
        i=$((i+1))
    done
    return 1
}

# Banner inicial
echo -e "${PURPLE}"
echo "============================================================"
echo "    🚗 AutoCare - Inicializador de Serviços v1.0"
echo "============================================================"
echo -e "${NC}"

# Detectar sistema e inicializar
detect_init_system

# Inicializar sistema de log
init_logging

log "INFO" "=== AutoCare - Inicialização dos Serviços ===" 
log "INFO" "Data/Hora: $(date '+%Y-%m-%d %H:%M:%S')"
log "INFO" "Sistema de init detectado: $INIT_SYSTEM"
log "INFO" "Iniciando verificação e inicialização dos serviços AutoCare..."
log "INFO" "Log será salvo em: $LOG_FILE"

echo -e "\n${BLUE}📋 Verificando serviços necessários...${NC}"

# 1. PostgreSQL
echo -e "\n🐘 ${BLUE}Verificando PostgreSQL (porta 5432)...${NC}"
if is_port_listening 5432; then
    log "SUCCESS" "PostgreSQL já está rodando"
    POSTGRES_STATUS="✅"
else
    log "INFO" "PostgreSQL não está rodando. Tentando iniciar..."
    
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        if sudo systemctl start postgresql 2>/dev/null; then
            if wait_for_port 5432; then
                log "SUCCESS" "PostgreSQL iniciado via systemd"
                POSTGRES_STATUS="✅"
            else
                log "ERROR" "PostgreSQL não respondeu na porta 5432"
            fi
        else
            log "ERROR" "Falha ao iniciar PostgreSQL via systemd"
        fi
    else
        # Sistemas sem systemd - usar mesma lógica do first_install.sh
        if [ -f /etc/init.d/postgresql ]; then
            if sudo /etc/init.d/postgresql start; then
                if wait_for_port 5432; then
                    log "SUCCESS" "PostgreSQL iniciado via init.d" 
                    POSTGRES_STATUS="✅"
                else
                    log "ERROR" "PostgreSQL não respondeu na porta 5432"
                fi
            else
                log "ERROR" "Falha ao iniciar PostgreSQL via init.d"
            fi
        else
            # Tentar iniciar cluster diretamente
            if sudo -u postgres pg_ctlcluster 14 main start 2>/dev/null; then
                if wait_for_port 5432; then
                    log "SUCCESS" "PostgreSQL iniciado via pg_ctlcluster"
                    POSTGRES_STATUS="✅"
                else
                    log "ERROR" "PostgreSQL não respondeu na porta 5432"
                fi
            else
                log "ERROR" "Não foi possível iniciar PostgreSQL"
            fi
        fi
    fi
fi

# 2. Nginx
echo -e "\n🌐 ${BLUE}Verificando Nginx (porta 80)...${NC}"
if is_port_listening 80; then
    log "SUCCESS" "Nginx já está rodando"
    NGINX_STATUS="✅"
else
    log "INFO" "Nginx não está rodando. Tentando iniciar..."
    
    if [ "$INIT_SYSTEM" = "systemd" ]; then
        if sudo systemctl start nginx 2>/dev/null; then
            if wait_for_port 80; then
                log "SUCCESS" "Nginx iniciado via systemd"
                NGINX_STATUS="✅"
            else
                log "ERROR" "Nginx não respondeu na porta 80"
            fi
        else
            log "ERROR" "Falha ao iniciar Nginx via systemd"
        fi
    else
        # Sistemas sem systemd
        if command_exists nginx; then
            if sudo nginx 2>/dev/null; then
                if wait_for_port 80; then
                    log "SUCCESS" "Nginx iniciado manualmente"
                    NGINX_STATUS="✅"
                else
                    log "ERROR" "Nginx não respondeu na porta 80"
                fi
            else
                log "ERROR" "Falha ao iniciar Nginx manualmente"
            fi
        else
            log "ERROR" "Nginx não está instalado"
        fi
    fi
fi

# 3. Backend (uvicorn)
echo -e "\n🔧 ${BLUE}Verificando Backend AutoCare (porta $BACKEND_PORT)...${NC}"

if is_port_listening $BACKEND_PORT; then
    log "INFO" "Backend já está rodando na porta $BACKEND_PORT - reiniciando..."
    
    # Parar processos existentes
    OLD_PIDS=$(pgrep -f 'uvicorn.*server:app' 2>/dev/null || true)
    if [ -n "$OLD_PIDS" ]; then
        log "INFO" "Parando processo(s) backend existente(s): $OLD_PIDS"
        echo "$OLD_PIDS" | xargs -r kill 2>/dev/null || true
        
        # Aguardar porta ficar livre
        if wait_for_port_down $BACKEND_PORT 15; then
            log "INFO" "Processo backend finalizado"
        else
            log "WARN" "Forçando finalização do backend..."
            echo "$OLD_PIDS" | xargs -r kill -9 2>/dev/null || true
            sleep 2
        fi
    fi
fi

log "INFO" "Iniciando backend AutoCare..."

# Tentar usar systemd primeiro se disponível
backend_started_systemd=false
if [ "$INIT_SYSTEM" = "systemd" ]; then
    if systemctl list-unit-files 2>/dev/null | grep -q "autocare-backend.service"; then
        log "INFO" "Tentando iniciar via systemd..."
        if sudo systemctl start autocare-backend 2>/dev/null; then
            sleep 3
            if sudo systemctl is-active --quiet autocare-backend; then
                if wait_for_port $BACKEND_PORT 15; then
                    log "SUCCESS" "Backend iniciado via systemd"
                    BACKEND_STATUS="✅"
                    backend_started_systemd=true
                else
                    log "WARN" "Systemd ativo mas porta não respondeu"
                fi
            else
                log "WARN" "Systemd não conseguiu manter o serviço ativo"
            fi
        else
            log "WARN" "Falha ao iniciar via systemd, tentando modo manual"
        fi
    else
        log "INFO" "Serviço systemd não encontrado, usando modo manual"
    fi
fi

# Modo manual se systemd falhou ou não está disponível
if [ "$backend_started_systemd" = false ]; then
    cd "$PROJECT_DIR/backend"
    
    # Verificar ambiente virtual
    if [ ! -d "venv" ]; then
        log "INFO" "Criando ambiente virtual..."
        python3 -m venv venv
    fi
    
    # Ativar ambiente e verificar dependências
    source venv/bin/activate
    if [ -f "requirements.txt" ] && [ ! -f ".deps_installed" ]; then
        log "INFO" "Instalando dependências Python..."
        pip install -q -r requirements.txt
        touch .deps_installed
    fi
    
    # Criar .env se necessário
    if [ ! -f ".env" ]; then
        log "INFO" "Criando arquivo .env..."
        cat > .env << ENVEOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME
SECRET_KEY=sua_chave_secreta_muito_segura_$(date +%s)
DEBUG=False
HOST=0.0.0.0
PORT=$BACKEND_PORT
ENVEOF
    fi
    
    # Iniciar backend manualmente
    log "INFO" "Iniciando uvicorn manualmente (logs integrados em backend.log)..."
    nohup uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT >> "$LOG_FILE" 2>&1 &
    
    # Salvar PID
    echo $! > "$BACKEND_PID_FILE"
    
    deactivate
    cd "$ROOT_DIR"
    
    # Aguardar inicialização
    if wait_for_port $BACKEND_PORT 20; then
        log "SUCCESS" "Backend iniciado manualmente (PID: $(cat $BACKEND_PID_FILE))"
        BACKEND_STATUS="✅"
    else
        log "ERROR" "Backend falhou ao iniciar - verifique $LOG_FILE"
        if [ -f "$LOG_FILE" ]; then
            log "ERROR" "Últimas linhas do log:"
            tail -10 "$LOG_FILE" | grep -v "\[INFO\]\|\[SUCCESS\]\|\[WARN\]\|\[ERROR\]" | tail -5 | while read line; do
                log "ERROR" "  $line"
            done
        fi
    fi
fi

# 4. Testes da aplicação
echo -e "\n🔍 ${BLUE}Testando aplicação AutoCare...${NC}"

# Testar PostgreSQL com banco autocare
log "INFO" "Testando conexão com banco de dados..."
if sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    log "SUCCESS" "Conexão com banco autocare: OK"
else
    log "ERROR" "Falha na conexão com banco autocare"
    POSTGRES_STATUS="❌"
fi

# Testar backend se estiver rodando
if [ "$BACKEND_STATUS" = "✅" ]; then
    log "INFO" "Testando endpoints do backend..."
    
    # Aguardar backend estar realmente pronto
    sleep 5
    
    # Testar health check
    if curl -s --max-time 10 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        log "SUCCESS" "Health check: OK"
        APP_STATUS="✅"
    else
        log "ERROR" "Health check: FALHOU"
        APP_STATUS="❌"
    fi
    
    # Testar endpoint raiz
    if curl -s --max-time 10 "http://localhost:$BACKEND_PORT/" >/dev/null 2>&1; then
        log "SUCCESS" "Endpoint raiz: OK"
    else
        log "WARN" "Endpoint raiz: não respondeu"
    fi
    
    # Testar via Nginx se estiver rodando
    if [ "$NGINX_STATUS" = "✅" ]; then
        log "INFO" "Testando acesso via Nginx..."
        if curl -s --max-time 10 "http://localhost/autocare/" >/dev/null 2>&1; then
            log "SUCCESS" "Frontend via Nginx: OK"
        else
            log "WARN" "Frontend via Nginx: não acessível"
        fi
        
        if curl -s --max-time 10 "http://localhost/autocare-api/" >/dev/null 2>&1; then
            log "SUCCESS" "API via Nginx: OK"
        else
            log "WARN" "API via Nginx: não acessível"
        fi
    fi
else
    log "ERROR" "Backend não está rodando - impossível testar aplicação"
    APP_STATUS="❌"
fi

# Relatório final
echo -e "\n${PURPLE}============================================================${NC}"
echo -e "${PURPLE}                    📊 RELATÓRIO FINAL                    ${NC}"  
echo -e "${PURPLE}============================================================${NC}"

log "INFO" "Status dos serviços AutoCare:"
echo -e "   🐘 PostgreSQL: $POSTGRES_STATUS"
echo -e "   🌐 Nginx: $NGINX_STATUS"
echo -e "   🔧 Backend: $BACKEND_STATUS" 
echo -e "   🔍 Aplicação: $APP_STATUS"

echo -e "\n${BLUE}🌐 URLs de acesso:${NC}"
[ "$POSTGRES_STATUS" = "✅" ] && echo "   🐘 PostgreSQL: localhost:5432 (banco: $DB_NAME)"
[ "$NGINX_STATUS" = "✅" ] && echo "   🌐 Nginx: http://localhost/"
[ "$BACKEND_STATUS" = "✅" ] && echo "   🔧 Backend API: http://localhost:$BACKEND_PORT"
[ "$BACKEND_STATUS" = "✅" ] && echo "   📚 Documentação: http://localhost:$BACKEND_PORT/docs"
[ "$NGINX_STATUS" = "✅" ] && [ "$BACKEND_STATUS" = "✅" ] && echo "   �� AutoCare App: http://localhost/autocare/"
[ "$NGINX_STATUS" = "✅" ] && [ "$BACKEND_STATUS" = "✅" ] && echo "   🔗 API via Nginx: http://localhost/autocare-api/"

echo -e "\n${BLUE}🛠️ Comandos úteis:${NC}"
echo "   Controlar sistema: sudo /usr/local/bin/autocare {start|stop|restart|status|logs}"
echo "   Ver logs completos: tail -f $LOG_FILE"
echo "   Ver logs do script: grep -E '\[INFO\]|\[SUCCESS\]|\[WARN\]|\[ERROR\]' $LOG_FILE"
echo "   Conectar ao banco: psql -h localhost -U $DB_USER -d $DB_NAME"

if [ "$APP_STATUS" = "✅" ]; then
    echo -e "\n${GREEN}🎉 AutoCare está funcionando corretamente!${NC}"
    log "SUCCESS" "Todos os serviços estão operacionais!"
    log "INFO" "=== Inicialização concluída com sucesso ==="
    exit 0
else
    echo -e "\n${RED}❌ Alguns serviços apresentaram problemas.${NC}"
    log "ERROR" "Verifique os erros acima e os logs dos serviços."
    
    # Mostrar dicas de solução
    if [ "$POSTGRES_STATUS" = "❌" ]; then
        echo -e "${YELLOW}💡 PostgreSQL: execute 'sudo systemctl start postgresql' ou reinstale${NC}"
        log "ERROR" "PostgreSQL não está funcionando corretamente"
    fi
    if [ "$BACKEND_STATUS" = "❌" ]; then
        echo -e "${YELLOW}💡 Backend: verifique logs em $LOG_FILE${NC}"
        log "ERROR" "Backend não está funcionando corretamente"
    fi
    if [ "$NGINX_STATUS" = "❌" ]; then
        echo -e "${YELLOW}💡 Nginx: execute 'sudo systemctl start nginx' ou 'sudo nginx'${NC}"
        log "ERROR" "Nginx não está funcionando corretamente"
    fi
    
    log "ERROR" "=== Inicialização concluída com falhas ==="
    exit 1
fi
