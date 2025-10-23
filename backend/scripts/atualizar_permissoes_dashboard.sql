-- =========================================================
-- Script de Atualização: Permissões de Dashboard
-- Data: 23/10/2025
-- Descrição: Atualiza permissões de dashboard para
--            dashboard_gerencial e dashboard_operacional
-- =========================================================

-- 1. Atualizar perfil Administrador
UPDATE perfis 
SET permissoes = '{"dashboard_gerencial": true, "dashboard_operacional": true, "clientes": true, "veiculos": true, "estoque": true, "ordens_servico": true, "fornecedores": true, "relatorios": true, "configuracoes": true, "usuarios": true, "perfis": true}',
    updated_at = NOW()
WHERE nome = 'Administrador';

-- 2. Atualizar perfil Supervisor (tem dashboard gerencial)
UPDATE perfis 
SET permissoes = '{"dashboard_gerencial": true, "dashboard_operacional": false, "clientes": true, "veiculos": true, "estoque": true, "ordens_servico": true, "fornecedores": true, "relatorios": true, "configuracoes": false, "usuarios": false, "perfis": false}',
    updated_at = NOW()
WHERE nome = 'Supervisor';

-- 3. Atualizar perfil Operador (tem apenas dashboard operacional)
UPDATE perfis 
SET permissoes = '{"dashboard_gerencial": false, "dashboard_operacional": true, "clientes": false, "veiculos": false, "estoque": true, "ordens_servico": true, "fornecedores": false, "relatorios": false, "configuracoes": false, "usuarios": false, "perfis": false}',
    updated_at = NOW()
WHERE nome = 'Operador';

-- 4. Atualizar outros perfis customizados (se existirem)
-- Converter "dashboard": true para ambas permissões habilitadas
UPDATE perfis
SET permissoes = REPLACE(
    REPLACE(permissoes, '"dashboard": true', '"dashboard_gerencial": true, "dashboard_operacional": true'),
    '"dashboard": false', '"dashboard_gerencial": false, "dashboard_operacional": false'
),
    updated_at = NOW()
WHERE nome NOT IN ('Administrador', 'Supervisor', 'Operador')
  AND permissoes LIKE '%"dashboard":%';

-- 5. Verificação final - Mostrar resultado
SELECT 
    '=== PERMISSÕES ATUALIZADAS ===' AS info,
    NULL::INTEGER AS id,
    NULL::VARCHAR AS nome,
    NULL::TEXT AS permissoes
UNION ALL
SELECT 
    NULL,
    id,
    nome,
    permissoes
FROM perfis
ORDER BY id NULLS FIRST;

-- Mensagem final
\echo ''
\echo '========================================='
\echo 'Atualização executada com sucesso!'
\echo '========================================='
\echo 'Permissões atualizadas:'
\echo '  - dashboard → dashboard_gerencial + dashboard_operacional'
\echo ''
\echo 'Perfis atualizados:'
\echo '  - Administrador: ambos dashboards habilitados'
\echo '  - Supervisor: apenas dashboard gerencial'
\echo '  - Operador: apenas dashboard operacional'
\echo ''
\echo 'Próximos passos:'
\echo '  1. Reiniciar o backend'
\echo '  2. Usuários devem fazer logout/login'
\echo '========================================='
