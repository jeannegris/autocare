#!/bin/bash

echo "🚀 Iniciando Frontend AutoCenter..."

# Instalar dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    yarn install
fi

# Iniciar servidor de desenvolvimento
echo "🌟 Iniciando servidor Vite..."
yarn dev