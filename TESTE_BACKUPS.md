# 🔍 Teste e Debug de Backups

## ✅ Problema 1: Registros Fantasmas - RESOLVIDO

A sincronização funcionou corretamente! Os 4 registros foram deletados do banco.

**Como funciona:**
- A função `sincronizar_backups_orfaos` verifica todos os registros no BD
- Remove aqueles cujo arquivo não existe no diretório
- Você clicou no botão e os 4 registros sumiram = **funcionou!**

---

## ⚠️ Problema 2: Backup Aparece com Status "Erro"

Backups recém-criados aparecem com status "erro" na lista, mas podem ter sido criados com sucesso.

### 📋 Passos para Investigar

Execute estes comandos **no servidor SSH**:

```bash
# 1. Ir para o diretório do projeto
cd /home/ubuntu/autocare

# 2. Puxar as alterações (logs adicionados)
git pull

# 3. Reiniciar backend
pm2 restart autocare-backend

# 4. Verificar onde os backups estão sendo salvos
ls -lh /var/backups/autocare/
# ou
ls -lh ~/autocare_backups/

# 5. Ver logs do backend em tempo real
pm2 logs autocare-backend --lines 100
```

### 🧪 Teste de Criação de Backup

1. **Deixe o terminal aberto** com: `pm2 logs autocare-backend`
2. **No navegador**, vá em Configurações → Criar Backup
3. **Digite a senha** do supervisor
4. **Observe os logs** que aparecerão:

```
[BACKUP] Iniciando criação de backup manual pelo supervisor
[BACKUP] Resultado: { sucesso: True/False, arquivo: "...", ... }
```

### 🔍 Verificar Registros no Banco de Dados

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql -d autocare

# Ver últimos backups criados
SELECT id, data_hora, tipo, status, tamanho_mb, caminho_arquivo, erro_detalhes 
FROM backup_logs 
ORDER BY data_hora DESC 
LIMIT 5;

# Sair do psql
\q
```

### 📊 Possíveis Causas do Status "Erro"

1. **pg_dump retornou código de erro** (mas criou o arquivo)
2. **Exceção durante o processo** (registrada em `erro_detalhes`)
3. **Problema de permissões** no diretório de backup
4. **Falta o binário `pg_dump`** no sistema

### ✅ O Que Esperar Após as Correções

**No Console do Navegador (F12):**
```javascript
Resposta criar backup: {
  sucesso: true,
  arquivo: "/var/backups/autocare/autocare_backup_20251024_210000.sql",
  tamanho_mb: 0.52,
  hash: "3b1d6617929f...",
  backup_log_id: 10,
  mensagem: "Backup criado com sucesso: ..."
}
```

**No Navegador:**
- Toast verde: "Backup criado com sucesso! - 0.52 MB"
- Modal fecha automaticamente
- Lista de backups é recarregada
- Novo backup aparece no topo com status "sucesso" ✅

---

## 🔧 Comandos de Manutenção

```bash
# Limpar backups antigos (manter só os últimos 10)
cd /var/backups/autocare
ls -t | tail -n +11 | xargs -I {} rm {}

# Ver tamanho total dos backups
du -sh /var/backups/autocare/

# Forçar sincronização via API
curl -X POST http://localhost:3000/autocare-api/configuracoes/backups/sincronizar \
  -H "Authorization: Bearer SEU_TOKEN"

# Verificar se pg_dump está disponível
which pg_dump
pg_dump --version
```

---

## 📝 Próximos Passos

1. **Execute os comandos de teste** acima
2. **Copie os logs** que aparecerem
3. **Me envie o resultado** para análise
4. **Verificaremos juntos** qual é o problema específico

