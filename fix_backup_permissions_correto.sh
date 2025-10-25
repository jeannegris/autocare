#!/bin/bash

echo "========================================"
echo "Corrigindo Permissões do Diretório de Backups"
echo "========================================"

BACKUP_DIR="/var/backups/autocare"

echo ""
echo "1. Verificando usuário que roda o backend..."
BACKEND_USER=$(ps aux | grep "node.*autocare" | grep -v grep | awk '{print $1}' | head -1)
if [ -z "$BACKEND_USER" ]; then
    BACKEND_USER="ubuntu"
fi
echo "   Usuário do backend: $BACKEND_USER"

echo ""
echo "2. Verificando usuário do PostgreSQL..."
PG_USER=$(ps aux | grep postgres | grep -v grep | awk '{print $1}' | head -1)
echo "   Usuário do PostgreSQL: $PG_USER"

echo ""
echo "3. Removendo diretório antigo (se existir)..."
sudo rm -rf "$BACKUP_DIR"

echo ""
echo "4. Criando novo diretório..."
sudo mkdir -p "$BACKUP_DIR"

echo ""
echo "5. Definindo permissões corretas..."
# Dar propriedade ao usuário do backend
sudo chown -R $BACKEND_USER:$BACKEND_USER "$BACKUP_DIR"
# Permissões 777 para garantir que postgres também consiga escrever
sudo chmod -R 777 "$BACKUP_DIR"

echo ""
echo "6. Verificando permissões finais:"
ls -ld "$BACKUP_DIR"

echo ""
echo "7. Testando escrita..."
sudo -u $BACKEND_USER touch "$BACKUP_DIR/test_backend.txt" 2>/dev/null && echo "   ✅ Backend consegue escrever" || echo "   ❌ Backend NÃO consegue escrever"
sudo -u $PG_USER touch "$BACKUP_DIR/test_postgres.txt" 2>/dev/null && echo "   ✅ PostgreSQL consegue escrever" || echo "   ❌ PostgreSQL NÃO consegue escrever"

# Limpar arquivos de teste
sudo rm -f "$BACKUP_DIR/test_backend.txt" "$BACKUP_DIR/test_postgres.txt"

echo ""
echo "========================================"
echo "✅ Permissões configuradas!"
echo "========================================"
echo ""
echo "Agora tente criar um backup novamente."
