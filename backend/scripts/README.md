# Scripts de Ajuste - Sistema de Perfis

Este diretório contém scripts para criar/ajustar as tabelas do sistema de perfis de acesso.

## Atualização de Forma de Pagamento das OS

Para corrigir OS antigas após a implantação da forma de pagamento, use o script [backend/scripts/atualizar_formas_pagamento_os.py](backend/scripts/atualizar_formas_pagamento_os.py).

O CSV padrão já foi criado em [backend/scripts/ordens_pagamento.csv](backend/scripts/ordens_pagamento.csv).

Se precisar listar todas as OS antes de preencher o CSV, use [backend/scripts/listar_os_forma_pagamento.sql](backend/scripts/listar_os_forma_pagamento.sql).

### Formato do CSV

```csv
numero_os,forma_pagamento,numero_parcelas,maquina_id
OS-0001,PIX,1,
OS-0002,CREDITO,3,2
OS-0003,DEBITO,1,
```

- `numero_os`: número exato da OS no banco
- `forma_pagamento`: `DINHEIRO`, `PIX`, `DEBITO` ou `CREDITO`
- `numero_parcelas`: opcional, usado para crédito; nos demais casos o script força `1`
- `maquina_id`: opcional; se vazio, o script usa a máquina padrão configurada

### Execução segura

Antes de preencher o CSV, você pode listar ou exportar as OS existentes:

```bash
cd /var/www/autocare/backend
psql -U autocare -d autocare -f scripts/listar_os_forma_pagamento.sql
```

O próprio arquivo SQL também traz exemplos de `\copy` para exportar diretamente para [backend/scripts/ordens_pagamento.csv](backend/scripts/ordens_pagamento.csv).

Primeiro rode em simulação:

```bash
cd /var/www/autocare/backend
python scripts/atualizar_formas_pagamento_os.py --dry-run
```

Se a prévia estiver correta, aplique:

```bash
cd /var/www/autocare/backend
python scripts/atualizar_formas_pagamento_os.py --aplicar
```

Se preferir usar outro arquivo CSV, continue podendo informar `--arquivo` manualmente.

### O que o script atualiza

1. Campo `forma_pagamento` da OS
2. Campo `numero_parcelas`
3. Campo `maquina_id`, quando informado
4. Campo `taxa_pagamento_aplicada` para OS concluídas
5. Campo `valor_faturado`, recalculado com a nova taxa

### Log gerado

O processamento grava detalhes em `backend/logs/atualizacao_formas_pagamento_os.log`.

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
