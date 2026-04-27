#!/bin/bash

set -e  # Para em caso de erro

# Definir PATH completo para garantir acesso a comandos básicos
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Aliases para comandos com caminhos absolutos (fallback se PATH falhar)
DATE_CMD="/usr/bin/date"
GREP_CMD="/usr/bin/grep"
TAIL_CMD="/usr/bin/tail"
SLEEP_CMD="/usr/bin/sleep"
MKDIR_CMD="/usr/bin/mkdir"
CHMOD_CMD="/usr/bin/chmod"
CHOWN_CMD="/usr/bin/chown"
TOUCH_CMD="/usr/bin/touch"
MV_CMD="/usr/bin/mv"
RM_CMD="/usr/bin/rm"
DIRNAME_CMD="/usr/bin/dirname"
BASENAME_CMD="/usr/bin/basename"
PS_CMD="/usr/bin/ps"
PGREP_CMD="/usr/bin/pgrep"
KILL_CMD="/usr/bin/kill"
CURL_CMD="/usr/bin/curl"
SS_CMD="/usr/bin/ss"
NETSTAT_CMD="/usr/bin/netstat"
FUSER_CMD="/usr/bin/fuser"

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
CELERY_STATUS="❌"
APP_STATUS="❌"

CELERY_PID_FILE="/tmp/autocare_celery.pid"
CELERY_LOG_FILE="$PROJECT_DIR/backend/logs/celery.log"

ROOT_DIR="$(cd "$($DIRNAME_CMD "$0")" && pwd)"
BACKEND_PID_FILE="/tmp/autocare_backend.pid"
# OBS: PID é opcional. Quando iniciado manualmente, tentamos registrar em /tmp.
# Quando iniciado via systemd, não forçamos gravação de PID para evitar travamentos.

# Configuração do sistema de log
BACKEND_LOG_DIR="$PROJECT_DIR/backend/logs"
LOG_FILE="$BACKEND_LOG_DIR/backend.log"

# Inicializar sistema de log
init_logging() {
    # Criar diretório de logs se não existir
    if ! $MKDIR_CMD -p "$BACKEND_LOG_DIR" 2>/dev/null; then
        # Tentar com sudo
        if ! sudo -n $MKDIR_CMD -p "$BACKEND_LOG_DIR" 2>/dev/null; then
            # Fallback para /tmp desde o início se não conseguir criar diretório
            echo "[WARN] Não foi possível criar $BACKEND_LOG_DIR. Usando /tmp para logs."
            BACKEND_LOG_DIR="/tmp"
            LOG_FILE="/tmp/autocare_backend.log"
        fi
    fi

    # Garantir que o diretório seja gravável por todos (se conseguimos criá-lo)
    if [ -d "$BACKEND_LOG_DIR" ] && [ "$BACKEND_LOG_DIR" != "/tmp" ]; then
        sudo -n $CHMOD_CMD 777 "$BACKEND_LOG_DIR" 2>/dev/null || $CHMOD_CMD 777 "$BACKEND_LOG_DIR" 2>/dev/null || true
    fi

    # Se backend.log já existir, tentar fazer backup
    if [ -f "$LOG_FILE" ]; then
        $MV_CMD -f "$LOG_FILE" "$BACKEND_LOG_DIR/backend_old.log" 2>/dev/null || \
        sudo -n $MV_CMD -f "$LOG_FILE" "$BACKEND_LOG_DIR/backend_old.log" 2>/dev/null || \
        $RM_CMD -f "$LOG_FILE" 2>/dev/null || \
        sudo -n $RM_CMD -f "$LOG_FILE" 2>/dev/null || true
    fi

    # Criar novo arquivo de log com permissões amplas
    if $TOUCH_CMD "$LOG_FILE" 2>/dev/null; then
        $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || sudo -n $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || true
    elif sudo -n $TOUCH_CMD "$LOG_FILE" 2>/dev/null; then
        sudo -n $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || true
    else
        # Fallback final para /tmp
        echo "[WARN] Não foi possível criar $LOG_FILE. Usando /tmp/autocare_backend.log"
        LOG_FILE="/tmp/autocare_backend.log"
        $TOUCH_CMD "$LOG_FILE" 2>/dev/null || true
        $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || true
    fi

    # Verificação final: se ainda não for gravável, usar /tmp
    if [ ! -w "$LOG_FILE" ]; then
        echo "[WARN] $LOG_FILE não é gravável. Usando /tmp/autocare_backend.log"
        LOG_FILE="/tmp/autocare_backend.log"
        $TOUCH_CMD "$LOG_FILE" 2>/dev/null || true
        $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || true
    fi
}

# Função para logging (compatível com first_install.sh)
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$($DATE_CMD '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo 'N/A')")
    
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
    
    # Tentar gravar no arquivo de log; se falhar, não travar a execução
    {
        echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null
    } || {
        # Fallback silencioso para /tmp se LOG_FILE principal falhar
        echo "[$timestamp] [$level] $message" >> "/tmp/autocare_fallback.log" 2>/dev/null || true
    }
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
    $SS_CMD -ltn 2>/dev/null | $GREP_CMD -q ":${port} \|:${port}$" || $NETSTAT_CMD -tuln 2>/dev/null | $GREP_CMD ":$port " >/dev/null 2>&1
}

function wait_for_port() {
    local port="$1"
    local retries="${2:-15}"
    local i=0
    while [ $i -lt $retries ]; do
        if is_port_listening "$port"; then
            return 0
        fi
        $SLEEP_CMD 1 2>/dev/null || sleep 1
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
        $SLEEP_CMD 1 2>/dev/null || sleep 1
        i=$((i+1))
    done
    return 1
}

function get_backend_pids() {
    {
        sudo -n $PGREP_CMD -f 'uvicorn.*server:app' 2>/dev/null ||
        $PGREP_CMD -f 'uvicorn.*server:app' 2>/dev/null ||
        true
    } | tr ' ' '\n' | $GREP_CMD -E '^[0-9]+$' | sort -u
}

function stop_backend_processes() {
    local pids="$1"

    if [ -z "$pids" ]; then
        return 0
    fi

    log "INFO" "Parando processo(s) backend existente(s): $pids"

    echo "$pids" | xargs -r $KILL_CMD 2>/dev/null || true
    echo "$pids" | xargs -r sudo -n $KILL_CMD 2>/dev/null || true

    if wait_for_port_down $BACKEND_PORT 15; then
        log "INFO" "Processo backend finalizado"
        return 0
    fi

    log "WARN" "Forçando finalização do backend..."
    echo "$pids" | xargs -r $KILL_CMD -9 2>/dev/null || true
    echo "$pids" | xargs -r sudo -n $KILL_CMD -9 2>/dev/null || true

    if [ -x "$FUSER_CMD" ]; then
        sudo -n $FUSER_CMD -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
        $FUSER_CMD -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
    fi

    $SLEEP_CMD 2 2>/dev/null || sleep 2

    if wait_for_port_down $BACKEND_PORT 10; then
        log "INFO" "Porta $BACKEND_PORT liberada após finalização forçada"
        return 0
    fi

    log "ERROR" "Não foi possível liberar a porta $BACKEND_PORT"
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
log "INFO" "Data/Hora: $($DATE_CMD '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo 'N/A')"
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
    if sudo -n systemctl start postgresql 2>/dev/null; then
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
    if sudo -n systemctl start nginx 2>/dev/null; then
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

    OLD_PIDS="$(get_backend_pids)"
    if [ -n "$OLD_PIDS" ]; then
        stop_backend_processes "$OLD_PIDS"
    else
        log "WARN" "Porta $BACKEND_PORT ocupada, mas não foi possível identificar o PID pelo padrão do uvicorn"
        if [ -x "$FUSER_CMD" ]; then
            sudo -n $FUSER_CMD -k "${BACKEND_PORT}/tcp" 2>/dev/null || $FUSER_CMD -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
            $SLEEP_CMD 2 2>/dev/null || sleep 2
        fi
    fi
fi

log "INFO" "Iniciando backend AutoCare..."

# Tentar usar systemd primeiro se disponível
backend_started_systemd=false
if [ "$INIT_SYSTEM" = "systemd" ]; then
    if systemctl list-unit-files 2>/dev/null | grep -q "autocare-backend.service"; then
        log "INFO" "Tentando reiniciar via systemd..."
        if sudo -n systemctl restart autocare-backend 2>/dev/null; then
            sleep 3
            if sudo -n systemctl is-active --quiet autocare-backend; then
                if wait_for_port $BACKEND_PORT 15; then
                    log "SUCCESS" "Backend reiniciado via systemd"
                    BACKEND_STATUS="✅"
                    backend_started_systemd=true
                    # Não registrar PID quando iniciado via systemd (systemd gerencia o processo)
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
    
    # Verificar se venv existe, se não criar
    if [ ! -d "venv" ] || [ ! -f "venv/bin/activate" ]; then
        log "INFO" "Criando ambiente virtual Python..."
        python3 -m venv venv 2>/dev/null || {
            log "ERROR" "Falha ao criar venv. Usando Python do sistema..."
        }
    fi
    
    # Ativar venv se foi criado com sucesso
    if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
        log "INFO" "Ativando ambiente virtual..."
        source venv/bin/activate
        VENV_ACTIVATED=true
    else
        log "WARN" "Usando Python do sistema (venv não disponível)..."
        VENV_ACTIVATED=false
    fi
    
    # Verificar e instalar dependências
    if [ -f "requirements.txt" ]; then
        log "INFO" "Verificando dependências Python..."
        python3 -m pip install -q -r requirements.txt 2>/dev/null || {
            log "WARN" "Algumas dependências podem não ter sido instaladas corretamente"
        }
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
    log "INFO" "Iniciando uvicorn manualmente..."
    
    # Garantir que o arquivo de log seja gravável antes de redirecionar uvicorn
    if [ ! -w "$LOG_FILE" ]; then
        log "WARN" "Log file não gravável, ajustando permissões..."
        $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || sudo -n $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || {
            log "WARN" "Não foi possível ajustar permissões, redirecionando para /tmp"
            LOG_FILE="/tmp/autocare_backend.log"
            $TOUCH_CMD "$LOG_FILE" && $CHMOD_CMD 666 "$LOG_FILE" 2>/dev/null || true
        }
    fi
    
    # Iniciar uvicorn com redirecionamento robusto
    nohup python3 -m uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT >> "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
    
    # Salvar PID (com fallback em caso de falta de permissão)
    if echo "$BACKEND_PID" > "$BACKEND_PID_FILE" 2>/dev/null; then
        log "INFO" "PID do backend salvo: $BACKEND_PID"
    else
        log "WARN" "Não foi possível gravar PID em $BACKEND_PID_FILE (continuando sem registro de PID)"
    fi
    
    # Deactivate somente se venv foi ativado
    if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
        deactivate 2>/dev/null || true
    fi
    cd "$ROOT_DIR"
    
    # Aguardar inicialização
    if wait_for_port $BACKEND_PORT 20; then
        if [ -f "$BACKEND_PID_FILE" ]; then
            log "SUCCESS" "Backend iniciado manualmente (PID: $(cat $BACKEND_PID_FILE))"
        else
            log "SUCCESS" "Backend iniciado manualmente"
        fi
        BACKEND_STATUS="✅"
    else
        log "ERROR" "Backend falhou ao iniciar - verifique $LOG_FILE"
        if [ -f "$LOG_FILE" ]; then
            log "ERROR" "Últimas linhas do log:"
            ($TAIL_CMD -10 "$LOG_FILE" 2>/dev/null || tail -10 "$LOG_FILE" 2>/dev/null || cat "$LOG_FILE" 2>/dev/null) | ($GREP_CMD -v "\[INFO\]\|\[SUCCESS\]\|\[WARN\]\|\[ERROR\]" 2>/dev/null || grep -v "\[INFO\]\|\[SUCCESS\]\|\[WARN\]\|\[ERROR\]" 2>/dev/null || cat) | ($TAIL_CMD -5 2>/dev/null || tail -5 2>/dev/null || cat) | while read line; do
                log "ERROR" "  $line"
            done
        fi
    fi
fi

# 4. Celery Worker
echo -e "\n📨 ${BLUE}Verificando Celery Worker (e-mail assíncrono)...${NC}"

# Parar worker antigo se estiver rodando
OLD_CELERY_PIDS="$($PGREP_CMD -f 'celery.*autocare\|celery.*worker' 2>/dev/null || pgrep -f 'celery.*worker' 2>/dev/null || true)"
if [ -n "$OLD_CELERY_PIDS" ]; then
    log "INFO" "Parando Celery worker existente (PIDs: $OLD_CELERY_PIDS)..."
    echo "$OLD_CELERY_PIDS" | xargs -r $KILL_CMD 2>/dev/null || true
    echo "$OLD_CELERY_PIDS" | xargs -r sudo -n $KILL_CMD 2>/dev/null || true
    $SLEEP_CMD 2 2>/dev/null || sleep 2
fi

if [ "$BACKEND_STATUS" = "✅" ]; then
    log "INFO" "Iniciando Celery worker..."
    cd "$PROJECT_DIR/backend"

    if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi

    # Garantir arquivo de log do celery
    $TOUCH_CMD "$CELERY_LOG_FILE" 2>/dev/null || CELERY_LOG_FILE="/tmp/autocare_celery.log"
    $CHMOD_CMD 666 "$CELERY_LOG_FILE" 2>/dev/null || true

    nohup python3 -m celery -A services.celery_tasks worker \
        --loglevel=info \
        --concurrency=2 \
        --logfile="$CELERY_LOG_FILE" \
        >> "$CELERY_LOG_FILE" 2>&1 &
    CELERY_PID=$!

    if echo "$CELERY_PID" > "$CELERY_PID_FILE" 2>/dev/null; then
        log "INFO" "PID do Celery salvo: $CELERY_PID"
    fi

    if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
        deactivate 2>/dev/null || true
    fi
    cd "$ROOT_DIR"

    $SLEEP_CMD 4 2>/dev/null || sleep 4

    if $PGREP_CMD -f 'celery.*worker' >/dev/null 2>&1 || pgrep -f 'celery.*worker' >/dev/null 2>&1; then
        log "SUCCESS" "Celery worker iniciado (PID: $CELERY_PID)"
        CELERY_STATUS="✅"
    else
        log "WARN" "Celery worker pode não ter iniciado — verifique $CELERY_LOG_FILE"
        CELERY_STATUS="⚠️"
    fi
else
    log "WARN" "Backend não está rodando — Celery worker não iniciado"
fi

# 5. Testes da aplicação
echo -e "\n🔍 ${BLUE}Testando aplicação AutoCare...${NC}"

# Testar PostgreSQL com banco autocare (sem sudo, não-interativo)
log "INFO" "Testando conexão com banco de dados..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    log "SUCCESS" "Conexão com banco autocare: OK"
else
    log "ERROR" "Falha na conexão com banco autocare"
    POSTGRES_STATUS="❌"
fi

# Testar backend se estiver rodando
if [ "$BACKEND_STATUS" = "✅" ]; then
    log "INFO" "Testando endpoints do backend..."
    
    # Aguardar backend estar realmente pronto
    $SLEEP_CMD 5 2>/dev/null || sleep 5
    
    # Testar health check
    if $CURL_CMD -s --max-time 10 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1 || curl -s --max-time 10 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        log "SUCCESS" "Health check: OK"
        APP_STATUS="✅"
    else
        log "ERROR" "Health check: FALHOU"
        APP_STATUS="❌"
    fi
    
    # Testar endpoint raiz
    if $CURL_CMD -s --max-time 10 "http://localhost:$BACKEND_PORT/" >/dev/null 2>&1 || curl -s --max-time 10 "http://localhost:$BACKEND_PORT/" >/dev/null 2>&1; then
        log "SUCCESS" "Endpoint raiz: OK"
    else
        log "WARN" "Endpoint raiz: não respondeu"
    fi
    
    # Testar via Nginx se estiver rodando
    if [ "$NGINX_STATUS" = "✅" ]; then
        log "INFO" "Testando acesso via Nginx..."
        if $CURL_CMD -s --max-time 10 "http://localhost/autocare/" >/dev/null 2>&1 || curl -s --max-time 10 "http://localhost/autocare/" >/dev/null 2>&1; then
            log "SUCCESS" "Frontend via Nginx: OK"
        else
            log "WARN" "Frontend via Nginx: não acessível"
        fi
        
        if $CURL_CMD -s --max-time 10 "http://localhost/autocare-api/" >/dev/null 2>&1 || curl -s --max-time 10 "http://localhost/autocare-api/" >/dev/null 2>&1; then
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
echo -e "   📨 Celery Worker: $CELERY_STATUS"
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
echo "   Ver logs completos: tail -f $LOG_FILE"   echo "   Ver logs Celery: tail -f $CELERY_LOG_FILE"echo "   Ver logs do script: grep -E '\[INFO\]|\[SUCCESS\]|\[WARN\]|\[ERROR\]' $LOG_FILE"
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
