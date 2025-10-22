-- =========================================================
-- Script de Ajuste: Sistema de Perfis de Acesso
-- Data: 22/10/2025
-- Descrição: Cria/ajusta tabelas de perfis e adiciona 
--            perfil_id aos usuários
-- =========================================================

-- 1. Criar tabela perfis se não existir
CREATE TABLE IF NOT EXISTS perfis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    permissoes TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    editavel BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Criar índices na tabela perfis se não existirem
CREATE INDEX IF NOT EXISTS ix_perfis_id ON perfis(id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_perfis_nome ON perfis(nome);

-- 3. Inserir perfis padrão (apenas se não existirem)
INSERT INTO perfis (id, nome, descricao, permissoes, ativo, editavel, created_at)
VALUES 
    (1, 'Administrador', 'Acesso total ao sistema', 
     '{"dashboard": true, "clientes": true, "veiculos": true, "estoque": true, "ordens_servico": true, "fornecedores": true, "relatorios": true, "configuracoes": true, "usuarios": true, "perfis": true}',
     true, false, NOW()),
    (2, 'Supervisor', 'Acesso intermediário ao sistema',
     '{"dashboard": true, "clientes": true, "veiculos": true, "estoque": true, "ordens_servico": true, "fornecedores": true, "relatorios": true, "configuracoes": false, "usuarios": false, "perfis": false}',
     true, true, NOW()),
    (3, 'Operador', 'Acesso básico ao sistema',
     '{"dashboard": true, "clientes": false, "veiculos": false, "estoque": true, "ordens_servico": true, "fornecedores": false, "relatorios": false, "configuracoes": false, "usuarios": false, "perfis": false}',
     true, true, NOW())
ON CONFLICT (nome) DO NOTHING;

-- 4. Ajustar sequence do ID se necessário
SELECT setval('perfis_id_seq', (SELECT COALESCE(MAX(id), 3) FROM perfis), true);

-- 5. Adicionar coluna perfil_id à tabela usuarios se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'perfil_id'
    ) THEN
        ALTER TABLE usuarios ADD COLUMN perfil_id INTEGER;
    END IF;
END $$;

-- 6. Atualizar usuários sem perfil para Operador (id=3)
UPDATE usuarios SET perfil_id = 3 WHERE perfil_id IS NULL;

-- 7. Tornar perfil_id NOT NULL e definir valor padrão
ALTER TABLE usuarios ALTER COLUMN perfil_id SET NOT NULL;
ALTER TABLE usuarios ALTER COLUMN perfil_id SET DEFAULT 3;

-- 8. Criar foreign key se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_usuarios_perfil_id' 
        AND table_name = 'usuarios'
    ) THEN
        ALTER TABLE usuarios 
        ADD CONSTRAINT fk_usuarios_perfil_id 
        FOREIGN KEY (perfil_id) REFERENCES perfis(id);
    END IF;
END $$;

-- 9. Atualizar usuário 'admin' para perfil Administrador
UPDATE usuarios SET perfil_id = 1 WHERE username = 'admin';

-- 10. Verificação final - Mostrar resultado
SELECT 
    '=== PERFIS CRIADOS ===' AS info,
    NULL::INTEGER AS id,
    NULL::VARCHAR AS nome,
    NULL::BOOLEAN AS ativo,
    NULL::BOOLEAN AS editavel
UNION ALL
SELECT 
    NULL,
    id,
    nome,
    ativo,
    editavel
FROM perfis
ORDER BY id NULLS FIRST;

SELECT 
    '=== USUÁRIOS COM PERFIL ===' AS info,
    NULL::INTEGER AS id,
    NULL::VARCHAR AS username,
    NULL::VARCHAR AS nome,
    NULL::INTEGER AS perfil_id,
    NULL::VARCHAR AS perfil_nome
UNION ALL
SELECT 
    NULL,
    u.id,
    u.username,
    u.nome,
    u.perfil_id,
    p.nome
FROM usuarios u
LEFT JOIN perfis p ON u.perfil_id = p.id
ORDER BY u.id NULLS FIRST;

-- Mensagem final
\echo ''
\echo '========================================='
\echo 'Script executado com sucesso!'
\echo '========================================='
\echo 'Tabelas criadas/ajustadas:'
\echo '  - perfis (3 perfis padrão)'
\echo '  - usuarios (coluna perfil_id adicionada)'
\echo ''
\echo 'Próximos passos:'
\echo '  1. Reiniciar o backend'
\echo '  2. Usuários devem fazer logout/login'
\echo '========================================='
