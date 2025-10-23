#!/bin/bash

echo "=== Corrigindo Backend AutoCare ==="
echo ""

# 1. Parar o serviço systemd
echo "1. Parando serviço systemd..."
sudo systemctl stop autocare-backend.service
sleep 2

# 2. Matar processos na porta 8008
echo "2. Verificando processos na porta 8008..."
PIDS=$(sudo lsof -ti:8008)
if [ -n "$PIDS" ]; then
    echo "   Matando processos: $PIDS"
    sudo kill -9 $PIDS
    sleep 1
else
    echo "   Nenhum processo encontrado na porta 8008"
fi

# 3. Ajustar permissões do diretório de logs
echo "3. Ajustando permissões do diretório de logs..."
sudo mkdir -p /var/www/autocare/backend/logs
sudo chown -R autocare:autocare /var/www/autocare/backend/logs
sudo chmod -R 755 /var/www/autocare/backend/logs

# 4. Verificar se ainda há processos Python/Uvicorn rodando
echo "4. Verificando processos Python restantes..."
PYTHON_PIDS=$(pgrep -f "uvicorn server:app")
if [ -n "$PYTHON_PIDS" ]; then
    echo "   Matando processos Python: $PYTHON_PIDS"
    sudo kill -9 $PYTHON_PIDS
    sleep 1
fi

# 5. Iniciar o serviço
echo "5. Iniciando serviço..."
sudo systemctl start autocare-backend.service
sleep 3

# 6. Verificar status
echo "6. Verificando status..."
sudo systemctl status autocare-backend.service --no-pager -l | head -20

echo ""
echo "=== Verificação Final ==="
if sudo systemctl is-active --quiet autocare-backend.service; then
    echo "✅ Backend está rodando!"
    echo ""
    echo "Teste o endpoint:"
    echo "  curl http://localhost:8008/health"
else
    echo "❌ Backend ainda não está rodando corretamente"
    echo ""
    echo "Para ver logs completos:"
    echo "  sudo journalctl -u autocare-backend.service -n 100 --no-pager"
fi
