#!/bin/bash

echo "=== Reinicialização do Uvicorn ===="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/var/www/autocare"
BACKEND_DIR="$PROJECT_DIR/backend"

echo -e "${YELLOW}[1/5]${NC} Parando uvicorn atual..."
# Tentar via systemd primeiro
if systemctl is-active --quiet autocare-backend 2>/dev/null; then
    echo "Parando via systemd..."
    sudo systemctl stop autocare-backend
    sleep 2
fi

# Matar qualquer processo uvicorn remanescente
PIDS=$(pgrep -f "uvicorn server:app" 2>/dev/null || echo "")
if [ -n "$PIDS" ]; then
    echo "Matando processos: $PIDS"
    sudo kill $PIDS 2>/dev/null || true
    sleep 2
    
    # Force kill se ainda estiver rodando
    REMAINING=$(pgrep -f "uvicorn server:app" 2>/dev/null || echo "")
    if [ -n "$REMAINING" ]; then
        echo "Forçando kill -9..."
        sudo kill -9 $REMAINING 2>/dev/null || true
        sleep 1
    fi
fi

echo -e "${GREEN}✓ Processos parados${NC}"
echo ""

echo -e "${YELLOW}[2/5]${NC} Verificando porta 8008..."
for i in {1..5}; do
    if ss -ltn 2>/dev/null | grep -q ":8008 "; then
        echo "Porta ainda em uso, aguardando..."
        sleep 1
    else
        break
    fi
done

if ss -ltn 2>/dev/null | grep -q ":8008 "; then
    echo -e "${RED}✗ Porta 8008 ainda está em uso!${NC}"
    ss -ltnp 2>/dev/null | grep ":8008"
    exit 1
fi
echo -e "${GREEN}✓ Porta 8008 livre${NC}"
echo ""

echo -e "${YELLOW}[3/5]${NC} Tentando iniciar via systemd..."
if systemctl list-unit-files 2>/dev/null | grep -q "autocare-backend.service"; then
    sudo systemctl start autocare-backend
    sleep 3
    
    if systemctl is-active --quiet autocare-backend; then
        echo -e "${GREEN}✓ Backend iniciado via systemd${NC}"
        SYSTEMD_SUCCESS=true
    else
        echo -e "${YELLOW}⚠ Systemd falhou, tentando modo manual...${NC}"
        SYSTEMD_SUCCESS=false
    fi
else
    echo "Serviço systemd não encontrado, usando modo manual..."
    SYSTEMD_SUCCESS=false
fi
echo ""

if [ "$SYSTEMD_SUCCESS" != "true" ]; then
    echo -e "${YELLOW}[4/5]${NC} Iniciando uvicorn manualmente..."
    cd "$BACKEND_DIR"
    
    if [ ! -d "venv" ]; then
        echo -e "${RED}✗ Venv não encontrado!${NC}"
        exit 1
    fi
    
    # Iniciar como www-data
    echo "Iniciando como usuário www-data..."
    sudo -u www-data nohup ./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8008 > "$PROJECT_DIR/uvicorn.log" 2>&1 &
    UVICORN_PID=$!
    
    echo -e "${GREEN}✓ Uvicorn iniciado (PID: $UVICORN_PID)${NC}"
    echo "Logs em: $PROJECT_DIR/uvicorn.log"
fi
echo ""

echo -e "${YELLOW}[5/5]${NC} Aguardando inicialização (10s)..."
sleep 10
echo ""

echo "Verificando status final..."
echo ""

# Verificar processo
if pgrep -f "uvicorn server:app" > /dev/null; then
    PID=$(pgrep -f "uvicorn server:app")
    echo -e "${GREEN}✓ Processo ativo (PID: $PID)${NC}"
    ps aux | grep -E "$PID" | grep -v grep
else
    echo -e "${RED}✗ Processo não está rodando!${NC}"
    echo ""
    echo "Últimas linhas do log systemd:"
    sudo journalctl -u autocare-backend -n 20 --no-pager 2>/dev/null || true
    echo ""
    echo "Últimas linhas do log manual:"
    tail -n 20 "$PROJECT_DIR/uvicorn.log" 2>/dev/null || true
    exit 1
fi
echo ""

# Verificar porta
if ss -ltn 2>/dev/null | grep -q ":8008 "; then
    echo -e "${GREEN}✓ Porta 8008 em escuta${NC}"
else
    echo -e "${RED}✗ Porta 8008 não está em escuta${NC}"
fi
echo ""

# Health check
echo "Testando health check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8008/health 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check: OK${NC}"
else
    echo -e "${RED}✗ Health check falhou (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Testar endpoint de verificação
echo "Testando endpoint de verificação de serviços..."
RESPONSE=$(curl -s -X POST http://127.0.0.1:8008/autocare-api/configuracoes/sistema/verificar-servicos-logs 2>/dev/null)
if echo "$RESPONSE" | grep -q '"sucesso"'; then
    if echo "$RESPONSE" | grep -q '"logs":".*[a-zA-Z]'; then
        echo -e "${GREEN}✓ Endpoint retorna logs!${NC}"
        echo ""
        echo "Preview da resposta (primeiros 300 caracteres):"
        echo "$RESPONSE" | head -c 300
        echo ""
        echo "..."
    else
        echo -e "${YELLOW}⚠ Endpoint responde mas logs estão vazios${NC}"
        echo "Resposta completa:"
        echo "$RESPONSE" | head -c 500
    fi
else
    echo -e "${RED}✗ Endpoint retornou erro ou resposta inválida${NC}"
    echo "Resposta:"
    echo "$RESPONSE" | head -c 500
fi
echo ""

echo -e "${GREEN}=== Reinicialização concluída ===${NC}"
echo ""
echo "Agora teste na UI clicando em 'Verificar Status'"
echo ""
echo "Para monitorar logs:"
echo "  tail -f /var/www/autocare/backend/logs/backend.log"
echo "  tail -f $PROJECT_DIR/uvicorn.log"
