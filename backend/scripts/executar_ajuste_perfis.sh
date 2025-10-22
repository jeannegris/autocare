#!/bin/bash

# =========================================================
# Script de Execução: Ajuste Sistema de Perfis
# Data: 22/10/2025
# =========================================================

echo "========================================="
echo "  AutoCare - Ajuste de Perfis de Acesso"
echo "========================================="
echo ""

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$SCRIPT_DIR/ajustar_perfis.sql"

# Verificar se arquivo SQL existe
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Erro: Arquivo $SQL_FILE não encontrado!"
    exit 1
fi

# Configurações do banco (ajuste se necessário)
DB_USER="${DB_USER:-autocare}"
DB_NAME="${DB_NAME:-autocare}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "📋 Configurações:"
echo "   Banco: $DB_NAME"
echo "   Usuário: $DB_USER"
echo "   Host: $DB_HOST"
echo "   Porta: $DB_PORT"
echo ""

# Perguntar senha se não estiver definida
if [ -z "$PGPASSWORD" ]; then
    echo "🔐 Digite a senha do PostgreSQL para o usuário '$DB_USER':"
    read -s DB_PASSWORD
    export PGPASSWORD="$DB_PASSWORD"
    echo ""
fi

echo "🚀 Executando script SQL..."
echo ""

# Executar o script SQL
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

EXIT_CODE=$?

# Limpar senha da memória
unset PGPASSWORD

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Script executado com sucesso!"
    echo ""
    echo "⚠️  IMPORTANTE:"
    echo "   1. Reinicie o backend: sudo systemctl restart autocare-backend"
    echo "   2. Usuários devem fazer LOGOUT e LOGIN novamente"
    echo ""
else
    echo "❌ Erro ao executar o script (código: $EXIT_CODE)"
    echo ""
    exit $EXIT_CODE
fi

echo "========================================="
