#!/bin/bash

echo "========================================"
echo "SOLUÇÃO DEFINITIVA: Permissões de Backup"
echo "========================================"

cd /home/ubuntu/autocare

BACKUP_DIR="/var/backups/autocare"

echo ""
echo "1. Atualizando código..."
git pull

echo ""
echo "2. DELETANDO e RECRIANDO diretório com permissões corretas..."
echo "   Removendo: $BACKUP_DIR"
sudo rm -rf "$BACKUP_DIR"

echo "   Criando novo diretório..."
sudo mkdir -p "$BACKUP_DIR"

echo "   Definindo permissões 777 (acesso TOTAL)..."
sudo chmod -R 777 "$BACKUP_DIR"

echo ""
echo "3. Verificando permissões:"
ls -ld "$BACKUP_DIR"

echo ""
echo "4. Testando escrita pelos diferentes usuários..."
# Testar com usuário atual
touch "$BACKUP_DIR/test_ubuntu.txt" 2>/dev/null && echo "   ✅ ubuntu pode escrever" || echo "   ❌ ubuntu NÃO pode"
rm -f "$BACKUP_DIR/test_ubuntu.txt"

# Testar com postgres
sudo -u postgres touch "$BACKUP_DIR/test_postgres.txt" 2>/dev/null && echo "   ✅ postgres pode escrever" || echo "   ❌ postgres NÃO pode"
sudo rm -f "$BACKUP_DIR/test_postgres.txt"

echo ""
echo "5. Reiniciando backend..."
pm2 restart autocare-backend

echo ""
echo "6. Recompilando frontend..."
cd frontend
npm run build

echo ""
echo "7. Reiniciando frontend..."
pm2 restart autocare-frontend

echo ""
echo "========================================"
echo "✅ TUDO PRONTO!"
echo "========================================"
echo ""
echo "Permissões do diretório:"
ls -ld "$BACKUP_DIR"
echo ""
echo "Agora crie um backup e veja o resultado!"
echo "Logs: pm2 logs autocare-backend"
