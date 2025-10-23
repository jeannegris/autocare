#!/bin/bash

echo "=== Verificando e Corrigindo Permissões do Perfil Operador ==="
echo ""

# Conectar ao PostgreSQL e verificar/corrigir permissões
sudo -u postgres psql -d autocare << 'EOF'

-- Ver estado atual do perfil Operador
\echo '1. Estado atual do perfil Operador:'
SELECT id, nome, permissoes FROM perfis WHERE nome = 'Operador';

\echo ''
\echo '2. Corrigindo permissões (desmarcando ambos os dashboards):'

-- Atualizar para desmarcar ambos os dashboards
UPDATE perfis 
SET permissoes = jsonb_set(
    jsonb_set(permissoes::jsonb, '{dashboard_gerencial}', 'false'),
    '{dashboard_operacional}', 'false'
)::text,
updated_at = NOW()
WHERE nome = 'Operador';

\echo 'Feito!'

\echo ''
\echo '3. Estado após correção:'
SELECT id, nome, permissoes FROM perfis WHERE nome = 'Operador';

\echo ''
\echo '4. Todos os perfis:'
SELECT id, nome, 
    (permissoes::jsonb->>'dashboard_gerencial')::boolean as dash_ger,
    (permissoes::jsonb->>'dashboard_operacional')::boolean as dash_oper,
    (permissoes::jsonb->>'estoque')::boolean as estoque,
    (permissoes::jsonb->>'ordens_servico')::boolean as ordens
FROM perfis
ORDER BY id;

EOF

echo ""
echo "✅ Correção concluída!"
echo ""
echo "Agora você pode:"
echo "1. Acessar /perfis no navegador"
echo "2. Editar o perfil Operador"
echo "3. Marcar APENAS 'Dashboard Operacional'"
echo "4. Salvar"
echo ""
echo "O dashboard deve aparecer no card após salvar."
