#!/bin/bash

echo "=== Script de Teste: Logs e Verificação de Serviços ==="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/var/www/autocare"
LOG_DIR="$PROJECT_DIR/backend/logs"
LOG_FILE="$LOG_DIR/backend.log"

echo -e "${YELLOW}[1/6]${NC} Verificando diretório de logs..."
if [ ! -d "$LOG_DIR" ]; then
    echo -e "${YELLOW}Criando diretório de logs...${NC}"
    sudo mkdir -p "$LOG_DIR"
fi

echo -e "${YELLOW}[2/6]${NC} Ajustando permissões do diretório de logs..."
sudo chmod 777 "$LOG_DIR"
sudo chown -R www-data:www-data "$LOG_DIR" 2>/dev/null || true
ls -ld "$LOG_DIR"
echo ""

echo -e "${YELLOW}[3/6]${NC} Limpando log antigo se existir..."
if [ -f "$LOG_FILE" ]; then
    sudo mv "$LOG_FILE" "$LOG_DIR/backend_old_$(date +%s).log" 2>/dev/null || \
    sudo rm -f "$LOG_FILE" 2>/dev/null || true
fi
echo ""

echo -e "${YELLOW}[4/6]${NC} Garantindo que start_services.sh seja executável..."
chmod +x "$PROJECT_DIR/start_services.sh"
ls -l "$PROJECT_DIR/start_services.sh"
echo ""

echo -e "${YELLOW}[5/6]${NC} Executando start_services.sh..."
echo "=================================================="
cd "$PROJECT_DIR"
./start_services.sh
EXIT_CODE=$?
echo "=================================================="
echo -e "Script finalizado com código: $EXIT_CODE"
echo ""

echo -e "${YELLOW}[6/6]${NC} Verificando resultado..."
echo ""

# Verificar se o log foi criado
if [ -f "$LOG_FILE" ]; then
    echo -e "${GREEN}✓ Arquivo de log criado: $LOG_FILE${NC}"
    echo -e "${YELLOW}Tamanho:${NC} $(du -h $LOG_FILE | cut -f1)"
    echo -e "${YELLOW}Permissões:${NC} $(ls -l $LOG_FILE)"
    echo ""
    echo -e "${YELLOW}Últimas 30 linhas do log:${NC}"
    echo "=================================================="
    tail -n 30 "$LOG_FILE"
    echo "=================================================="
else
    echo -e "${RED}✗ Arquivo de log NÃO foi criado!${NC}"
    echo ""
    echo -e "${YELLOW}Verificando logs alternativos em /tmp:${NC}"
    ls -lh /tmp/autocare*.log 2>/dev/null || echo "Nenhum log encontrado em /tmp"
fi
echo ""

# Testar endpoint
echo -e "${YELLOW}Testando endpoint de verificação de serviços...${NC}"
echo ""
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:8008/autocare-api/configuracoes/sistema/verificar-servicos-logs 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Endpoint respondeu com sucesso!${NC}"
    echo ""
    echo "Resposta (primeiros 500 caracteres):"
    echo "$BODY" | head -c 500
    echo ""
    echo "..."
    echo ""
    
    # Verificar se há logs na resposta
    if echo "$BODY" | grep -q "LOG FILE"; then
        echo -e "${GREEN}✓ Logs foram encontrados e retornados na resposta!${NC}"
    elif echo "$BODY" | grep -q "Nenhum"; then
        echo -e "${YELLOW}⚠ Resposta indica 'Nenhum log disponível'${NC}"
    else
        echo -e "${YELLOW}⚠ Não foi possível determinar se há logs na resposta${NC}"
    fi
else
    echo -e "${RED}✗ Endpoint retornou erro: $HTTP_CODE${NC}"
    echo ""
    echo "Resposta:"
    echo "$BODY"
fi
echo ""

echo -e "${GREEN}=== Teste concluído ===${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Se o endpoint retornou 200 mas sem logs, reinicie o uvicorn:"
echo "     sudo systemctl restart autocare-backend"
echo "     (ou use: sudo pkill -f uvicorn && cd $PROJECT_DIR/backend && sudo -u www-data ./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8008 &)"
echo ""
echo "  2. Teste novamente na UI clicando em 'Verificar Status'"
echo ""
echo "  3. Para ver logs em tempo real:"
echo "     tail -f $LOG_FILE"
