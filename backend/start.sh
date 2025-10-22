#!/bin/bash

set -euo pipefail

echo "🚀 Iniciando AutoCare (script integrado: DB, Redis, Metabase opcional e backend)..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

function command_exists() {
    command -v "$1" >/dev/null 2>&1
}

function try_systemctl_start() {
    local svc_names=("$@")
    for svc in "${svc_names[@]}"; do
        if command_exists systemctl; then
            echo "🔧 Tentando iniciar service: $svc (systemctl)..."
            sudo systemctl start "$svc" || true
            sleep 1
            sudo systemctl is-active --quiet "$svc" && return 0 || true
        fi
    done
    return 1
}

function try_service_start() {
    local svc_names=("$@")
    for svc in "${svc_names[@]}"; do
        if command_exists service; then
            echo "� Tentando iniciar service: $svc (service)..."
            sudo service "$svc" start || true
            sleep 1
            sudo service "$svc" status >/dev/null 2>&1 && return 0 || true
        fi
    done
    return 1
}

function wait_for_port() {
    local host=${1:-127.0.0.1}
    local port=${2}
    local retries=${3:-10}
    local i=0
    while [ $i -lt $retries ]; do
        if ss -ltn | grep -q ":${port} \|:${port}$"; then
            echo "✅ Porta ${port} está ouvindo"
            return 0
        fi
        echo "⏳ Aguardando porta ${port}... tentativa $((i+1))/${retries}"
        sleep 2
        i=$((i+1))
    done
    echo "❌ Timeout aguardando porta ${port}"
    return 1
}

echo "📌 Iniciando PostgreSQL local (se disponível)..."
if ss -ltn | grep -q ":5432 \|:5432$"; then
    echo "ℹ️ PostgreSQL já está escutando em 5432"
else
    # Tentar nomes comuns de serviços
    if try_systemctl_start postgresql postgresql.service postgres || try_service_start postgresql postgresql postgres; then
        echo "🔁 Start request enviado para PostgreSQL via init/systemd"
    else
        echo "⚠️ Não foi possível iniciar PostgreSQL automaticamente (não encontrado systemctl/service ou serviço não instalado)."
        echo "   Se não tiver Postgres instalado, instale via apt: sudo apt install postgresql"
    fi
    wait_for_port 127.0.0.1 5432 12 || true
fi

echo "📌 Iniciando Redis local (se disponível)..."
if ss -ltn | grep -q ":6379 \|:6379$"; then
    echo "ℹ️ Redis já está escutando em 6379"
else
    if try_systemctl_start redis-server redis || try_service_start redis-server redis; then
        echo "🔁 Start request enviado para Redis via init/systemd"
    else
        echo "⚠️ Não foi possível iniciar Redis automaticamente. Instale com: sudo apt install redis-server"
    fi
    wait_for_port 127.0.0.1 6379 12 || true
fi

# Metabase: opcional — tentar via Docker se disponível, ou via metabase.jar se já tiver
echo "📌 Preparando Metabase (opcional) na porta 3000..."
METABASE_STARTED=false
if ss -ltn | grep -q ":3000 \|:3000$"; then
    echo "ℹ️ Alguma coisa já está escutando na porta 3000"
    METABASE_STARTED=true
else
    if command_exists docker; then
        echo "🐳 Docker detectado — iniciando Metabase como container..."
        docker rm -f autocare_metabase >/dev/null 2>&1 || true
        docker run -d --name autocare_metabase -p 3000:3000 \
            -e MB_DB_TYPE=postgres \
            -e MB_DB_DBNAME=autocare \
            -e MB_DB_PORT=5432 \
            -e MB_DB_USER=autocare \
            -e MB_DB_PASS=autocare \
            -e MB_DB_HOST=host.docker.internal \
            metabase/metabase:latest >/dev/null
        sleep 2
        if ss -ltn | grep -q ":3000 \|:3000$"; then
            METABASE_STARTED=true
        fi
    elif command_exists java && [ -f "${ROOT_DIR}/metabase.jar" ]; then
        echo "☕ Java detectado e metabase.jar encontrado — iniciando Metabase local (background)..."
        nohup java -jar "${ROOT_DIR}/metabase.jar" >/dev/null 2>&1 &
        sleep 2
        if ss -ltn | grep -q ":3000 \|:3000$"; then
            METABASE_STARTED=true
        fi
    else
        echo "ℹ️ Metabase não iniciado automaticamente (não há Docker/Java+metabase.jar)."
        echo "   Para rodar Metabase localmente você pode:"
        echo "     - instalar Docker e rodar via docker run (recomendado), ou"
        echo "     - baixar metabase.jar e executar: java -jar metabase.jar"
    fi
fi
if [ "$METABASE_STARTED" = true ]; then
    echo "✅ Metabase ativo na porta 3000"
else
    echo "⚠️ Metabase não ativo (opcional)."
fi

echo "\n📦 Preparando ambiente Python e iniciando backend..."

# Ir para backend
cd "$(dirname "$0")"

# Criar ambiente virtual se não existir
if [ ! -d "venv" ]; then
        echo "📦 Criando ambiente virtual..."
        python3 -m venv venv
fi

# Ativar ambiente virtual
source venv/bin/activate

# Instalar dependências se necessário
if [ -f requirements.txt ]; then
    echo "📚 Instalando/atualizando dependências Python..."
    pip install -r requirements.txt
fi

# Copiar arquivo de ambiente se não existir
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        echo "⚙️ Copiando arquivo de ambiente..."
        cp .env.example .env
fi

echo "🌟 Iniciando servidor FastAPI (uvicorn) na porta 8008..."
exec uvicorn server:app --host 0.0.0.0 --port 8008