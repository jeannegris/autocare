#!/bin/bash

echo "========================================"
echo "Aplicando Correções: Backups"
echo "========================================"

cd /home/ubuntu/autocare

echo ""
echo "1. Atualizando código..."
git pull

echo ""
echo "2. Reiniciando backend (logs adicionados)..."
pm2 restart autocare-backend

echo ""
echo "3. Recompilando frontend..."
cd frontend
npm run build

echo ""
echo "4. Reiniciando frontend..."
pm2 restart autocare-frontend

echo ""
echo "========================================"
echo "✅ Correções aplicadas!"
echo "========================================"
echo ""
echo "📋 Próximos passos:"
echo "1. Abra o navegador (F12 → Console)"
echo "2. Vá em Configurações → Criar Backup"
echo "3. Digite a senha e observe:"
echo "   - Console do navegador"
echo "   - Logs do backend: pm2 logs autocare-backend"
echo ""
echo "4. Verifique o status do backup na lista"
echo ""
echo "📁 Backups salvos em:"
echo "   /var/backups/autocare/ ou ~/autocare_backups/"
