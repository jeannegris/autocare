# Scripts de Ajuste - Sistema de Perfis

Este diretório contém scripts para criar/ajustar as tabelas do sistema de perfis de acesso.

## 📄 Arquivos

### 1. `ajustar_perfis.sql`
Script SQL completo que:
- Cria a tabela `perfis` se não existir
- Cria índices necessários
- Insere 3 perfis padrão (Administrador, Supervisor, Operador)
- Adiciona coluna `perfil_id` na tabela `usuarios`
- Cria foreign key entre `usuarios` e `perfis`
- Atualiza usuários existentes para perfil Operador
- Atualiza usuário 'admin' para perfil Administrador
- Mostra relatório final

### 2. `executar_ajuste_perfis.sh`
Script shell que facilita a execução do SQL acima.

## 🚀 Como Usar

### Opção 1: Executar via Script Shell (Recomendado)

```bash
cd /var/www/autocare/backend/scripts
./executar_ajuste_perfis.sh
```

O script irá:
1. Pedir a senha do PostgreSQL
2. Executar o SQL automaticamente
3. Mostrar o resultado

### Opção 2: Executar SQL Diretamente

```bash
cd /var/www/autocare/backend/scripts
psql -U autocare -d autocare -f ajustar_perfis.sql
```

### Opção 3: Executar Manualmente Linha por Linha

```bash
psql -U autocare -d autocare
```

Depois copie e cole o conteúdo de `ajustar_perfis.sql` no prompt do psql.

## ✅ O Que o Script Faz

1. **Cria tabela `perfis`** com campos:
   - id (SERIAL PRIMARY KEY)
   - nome (VARCHAR UNIQUE)
   - descricao (TEXT)
   - permissoes (TEXT - JSON)
   - ativo (BOOLEAN)
   - editavel (BOOLEAN)
   - created_at, updated_at (TIMESTAMP)

2. **Insere 3 perfis padrão**:
   - **Administrador** (id=1): Todas as permissões, não editável
   - **Supervisor** (id=2): Permissões intermediárias, editável
   - **Operador** (id=3): Permissões básicas, editável

3. **Adiciona `perfil_id` na tabela `usuarios`**:
   - Coluna NOT NULL com default=3
   - Foreign key para `perfis(id)`

4. **Atualiza usuários existentes**:
   - Todos recebem perfil_id=3 (Operador)
   - Usuário 'admin' recebe perfil_id=1 (Administrador)

## 📊 Verificação

Após executar o script, você verá duas tabelas:

1. **Perfis criados**: Lista os 3 perfis
2. **Usuários com perfil**: Mostra todos os usuários e seus perfis

## ⚠️ IMPORTANTE

Após executar este script:

1. **Reinicie o backend**:
   ```bash
   sudo systemctl restart autocare-backend
   ```

2. **Usuários devem fazer logout/login** para carregar as novas permissões

## 🔄 Executar Novamente

O script é **idempotente** - pode ser executado múltiplas vezes sem problemas:
- Não recria tabelas que já existem
- Não duplica perfis (usa `ON CONFLICT DO NOTHING`)
- Apenas atualiza o que for necessário

## 🛠️ Troubleshooting

### Erro de permissão
```bash
# Execute como usuário com permissões no PostgreSQL
sudo -u postgres psql -d autocare -f ajustar_perfis.sql
```

### Senha do PostgreSQL
Se precisar definir a senha via variável de ambiente:
```bash
export PGPASSWORD='sua_senha'
./executar_ajuste_perfis.sh
```

### Verificar se foi aplicado
```bash
psql -U autocare -d autocare -c "SELECT * FROM perfis;"
psql -U autocare -d autocare -c "SELECT id, username, perfil_id FROM usuarios;"
```

## 📝 Estrutura das Permissões (JSON)

Cada perfil tem um JSON com 10 permissões booleanas:

```json
{
  "dashboard": true/false,
  "clientes": true/false,
  "veiculos": true/false,
  "estoque": true/false,
  "ordens_servico": true/false,
  "fornecedores": true/false,
  "relatorios": true/false,
  "configuracoes": true/false,
  "usuarios": true/false,
  "perfis": true/false
}
```

---
**Data de Criação**: 22/10/2025  
**Versão**: 1.0
