# Sistema de Configurações e Validações - AutoCare

## 📋 Resumo

Implementação completa de um sistema de configurações com validações de segurança para operações críticas, incluindo:

1. **Módulo de Configurações** - Menu dedicado para parametrizações do sistema
2. **Validação de KM** - Controle de KM inferior ao atual do veículo
3. **Atualização Automática de KM** - Sincronização automática ao criar OS
4. **Aplicação de Margem de Lucro em Lote** - Atualização massiva de preços
5. **Controle de Descontos** - Validação de descontos acima do limite configurado

---

## 🔧 Funcionalidades Implementadas

### 1. Menu de Configurações

**Localização:** Menu lateral → Configurações (ícone de engrenagem)

**Rota Frontend:** `/configuracoes`

**Rota Backend:** `/api/configuracoes`

#### Parâmetros Disponíveis:

- **Senha do Supervisor** (password)
  - Senha padrão inicial: `admin123`
  - Hash SHA256 armazenado no banco
  - Requerida para operações críticas

- **Margem de Lucro Padrão** (number)
  - Valor padrão: 50%
  - Aplicável a todos produtos do estoque
  - Pode ser atualizada em lote

- **Desconto Máximo em OS** (number)
  - Valor padrão: 15%
  - Descontos acima exigem senha do supervisor

---

### 2. Validação de KM Inferior

**Cenário:** Ao criar uma OS com KM menor que o KM atual do veículo

**Fluxo:**

1. Usuário informa KM na criação da OS
2. Sistema detecta que KM é menor que o atual
3. Modal de confirmação é exibido:
   - Mostra KM informado vs KM atual
   - Solicita senha do supervisor
4. Após senha validada:
   - KM é atualizado
   - OS continua sendo criada normalmente

**Componentes Envolvidos:**
- `ModalNovaOrdem.tsx` - Validação no campo KM
- `/api/configuracoes/validar-senha` - Endpoint de validação

---

### 3. Atualização Automática de KM do Veículo

**Comportamento:**

Sempre que uma OS é criada com um valor de KM informado, o sistema:

1. Cria a Ordem de Serviço normalmente
2. Atualiza automaticamente o `km_atual` do veículo no cadastro
3. Mantém histórico de atualização

**Endpoint Backend:**
```
POST /api/veiculos/{veiculo_id}/atualizar-km
Body: { "km_atual": 195000 }
```

**Implementação:**
- Chamada automática após criação da OS
- Não bloqueia a criação da OS em caso de falha
- Log de erro em console se falhar

---

### 4. Aplicação de Margem de Lucro em Lote

**Localização:** Configurações → Configurações de Venda

**Funcionalidade:**

Permite aplicar uma margem de lucro em todos os produtos ativos do estoque de uma só vez.

**Fluxo:**

1. Usuário define margem de lucro (ex: 50%)
2. Clica em "Aplicar a Todos Produtos"
3. Modal de confirmação exibe:
   - Margem a ser aplicada
   - Alerta sobre recálculo de preços
   - Campo de senha do supervisor
4. Após confirmação:
   - Calcula preço de venda: `custo + (custo * margem%)`
   - Atualiza todos produtos ativos
   - Exibe quantidade de produtos atualizados

**Cálculo:**
```
Preço Venda = Preço Custo × (1 + Margem/100)

Exemplo:
Custo: R$ 100,00
Margem: 50%
Venda: R$ 100,00 × 1,50 = R$ 150,00
```

**Endpoint:**
```
POST /api/configuracoes/aplicar-margem-lucro
Body: {
  "margem_lucro": 50,
  "senha_supervisor": "admin123"
}
```

**Segurança:**
- Requer senha do supervisor
- Validação antes de aplicação
- Atualiza somente produtos ativos
- Ignora produtos sem preço de custo

---

### 5. Controle de Descontos em OS

**Cenário:** Ao aplicar desconto maior que o limite configurado

**Fluxo:**

1. Usuário informa desconto percentual na OS
2. Sistema verifica se excede limite (ex: 15%)
3. Se exceder, modal de confirmação:
   - Mostra desconto informado vs limite
   - Solicita senha do supervisor
4. Após validação:
   - Desconto é aplicado
   - OS pode ser finalizada

**Validação Automática:**
- Ocorre ao alterar campo `percentual_desconto`
- Modal bloqueia continuação até validação
- Opção de cancelar reverte para limite máximo

---

## 🗄️ Estrutura de Banco de Dados

### Tabela: `configuracoes`

```sql
CREATE TABLE configuracoes (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao TEXT,
    tipo VARCHAR(50) DEFAULT 'string', -- string, number, boolean, password
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índice
CREATE INDEX ix_configuracoes_chave ON configuracoes(chave);
```

### Configurações Padrão Criadas:

```sql
INSERT INTO configuracoes (chave, valor, descricao, tipo) VALUES
('senha_supervisor', '[hash_sha256]', 'Senha do supervisor para operações críticas', 'password'),
('margem_lucro_padrao', '50', 'Margem de lucro padrão para produtos (%)', 'number'),
('desconto_maximo_os', '15', 'Desconto máximo permitido em OS sem senha (%)', 'number'),
('alerta_estoque_baixo', 'quando_atingir_estoque_minimo', 'Alerta de estoque baixo', 'string');
```

---

## 🔒 Segurança

### Hash de Senha

**Algoritmo:** SHA256

**Implementação:**
```python
import hashlib

def hash_senha(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()
```

**Validação:**
```python
senha_hash = hash_senha(senha_informada)
valida = (senha_hash == senha_armazenada)
```

### Endpoints Protegidos

Operações que requerem senha do supervisor:

1. `POST /api/configuracoes/validar-senha`
2. `POST /api/configuracoes/aplicar-margem-lucro`
3. Atualização de KM inferior (frontend)
4. Desconto acima do limite (frontend)

---

## 📱 Interfaces de Usuário

### Página de Configurações

**Seções:**

1. **Senha do Supervisor**
   - Campos: Senha Atual, Nova Senha, Confirmar
   - Validação de senha atual antes de alterar
   - Mínimo 6 caracteres

2. **Configurações de Venda**
   - Margem de Lucro Padrão
   - Botão "Aplicar a Todos Produtos"
   - Desconto Máximo em OS
   - Alertas visuais sobre operações críticas

### Modais de Confirmação

**Modal de KM Inferior:**
- Título: "KM Inferior ao Atual" (amarelo)
- Comparação: KM informado vs KM atual
- Campo de senha
- Botões: Cancelar | Confirmar

**Modal de Desconto Alto:**
- Título: "Desconto Acima do Limite" (vermelho)
- Comparação: Desconto informado vs limite
- Campo de senha
- Botões: Cancelar (reverte) | Confirmar

**Modal de Aplicar Margem:**
- Título: "Confirmação Necessária" (vermelho)
- Detalhes da operação
- Aviso sobre recálculo de preços
- Campo de senha
- Botões: Cancelar | Confirmar

---

## 🚀 Endpoints da API

### Listar Configurações
```
GET /api/configuracoes
Response: [
  {
    "id": 1,
    "chave": "senha_supervisor",
    "valor": "[hash]",
    "descricao": "Senha do supervisor...",
    "tipo": "password"
  }
]
```

### Obter Configuração Específica
```
GET /api/configuracoes/{chave}
Response: {
  "id": 2,
  "chave": "desconto_maximo_os",
  "valor": "15",
  "descricao": "Desconto máximo...",
  "tipo": "number"
}
```

### Atualizar Configuração
```
PUT /api/configuracoes/{chave}
Body: { "valor": "20" }
Response: { ... }
```

### Validar Senha do Supervisor
```
POST /api/configuracoes/validar-senha
Body: { "senha": "admin123" }
Response: {
  "valida": true,
  "mensagem": "Senha válida"
}
```

### Aplicar Margem de Lucro
```
POST /api/configuracoes/aplicar-margem-lucro
Body: {
  "margem_lucro": 50.0,
  "senha_supervisor": "admin123"
}
Response: {
  "success": true,
  "produtos_atualizados": 45,
  "mensagem": "Margem de 50% aplicada em 45 produto(s)"
}
```

### Atualizar KM do Veículo
```
POST /api/veiculos/{veiculo_id}/atualizar-km
Body: { "km_atual": 195000 }
Response: { ... }
```

---

## 🧪 Testes

### Testar Validação de KM

1. Acesse: Ordens de Serviço → + Nova OS
2. Selecione cliente com veículo (KM atual: 190.100)
3. Informe KM: 185.000 (menor)
4. Observe modal de confirmação
5. Digite senha: `admin123`
6. Confirme e verifique KM atualizado

### Testar Aplicação de Margem

1. Acesse: Configurações
2. Vá para "Configurações de Venda"
3. Informe margem: 60%
4. Clique "Aplicar a Todos Produtos"
5. Digite senha: `admin123`
6. Verifique mensagem com quantidade atualizada
7. Acesse Estoque para verificar preços

### Testar Desconto Acima do Limite

1. Acesse: Ordens de Serviço → + Nova OS
2. Crie uma OS normalmente
3. No campo "Desconto", informe: 20% (acima de 15%)
4. Observe modal de confirmação
5. Digite senha: `admin123`
6. Confirme e finalize OS

---

## 📝 Alteração de Senha Padrão

Para alterar a senha padrão do supervisor:

1. Acesse: Configurações
2. Seção "Senha do Supervisor"
3. Preencha:
   - Senha Atual: `admin123`
   - Nova Senha: (sua nova senha)
   - Confirmar Nova Senha: (repetir)
4. Clique "Atualizar Senha"

**Importante:** Guarde a senha em local seguro!

---

## 🐛 Troubleshooting

### Erro: "Configuração não encontrada"

**Solução:** Execute o endpoint GET para criar configurações padrão:
```bash
curl http://localhost:8008/api/configuracoes
```

### Erro: "Senha do supervisor inválida"

**Causas possíveis:**
1. Senha incorreta
2. Configuração não inicializada

**Solução:**
1. Verifique se digitou corretamente
2. Use senha padrão: `admin123`
3. Reset via banco:
```sql
UPDATE configuracoes 
SET valor = 'ba3253876aed6bc22d4a6ff53d8406c6ad864195ed144ab5c87621b6c233b548'
WHERE chave = 'senha_supervisor';
-- Hash de 'admin123'
```

### KM não atualiza automaticamente

**Verificações:**
1. Confirme que OS foi criada com sucesso
2. Verifique logs do backend: `tail -f /var/www/autocare/backend/logs/backend.log`
3. Teste endpoint manualmente:
```bash
curl -X POST http://localhost:8008/api/veiculos/1/atualizar-km \
  -H "Content-Type: application/json" \
  -d '{"km_atual": 195000}'
```

---

## 📊 Relatório de Implementação

### Arquivos Criados

**Backend:**
- `/backend/routes/autocare_configuracoes.py` - Rotas de configurações
- `/backend/models/autocare_models.py` - Model `Configuracao` (adicionado)
- `/backend/alembic/versions/32a20b8adc4d_add_configuracoes_table.py` - Migration

**Frontend:**
- `/frontend/src/pages/Configuracoes.tsx` - Página de configurações

### Arquivos Modificados

**Backend:**
- `/backend/server.py` - Registro da rota de configurações

**Frontend:**
- `/frontend/src/components/Layout.tsx` - Adicionado menu Configurações
- `/frontend/src/App.tsx` - Adicionado rota `/configuracoes`
- `/frontend/src/components/ModalNovaOrdem.tsx` - Validações de KM e desconto

### Linhas de Código

- **Backend:** ~220 linhas (rotas + model)
- **Frontend:** ~520 linhas (página + modais)
- **Total:** ~740 linhas

---

## ✅ Checklist de Funcionalidades

- [x] Tabela `configuracoes` criada no banco
- [x] Endpoints de configurações implementados
- [x] Página de Configurações no frontend
- [x] Menu "Configurações" adicionado ao layout
- [x] Senha do supervisor com hash SHA256
- [x] Validação de KM inferior ao atual
- [x] Modal de confirmação de KM com senha
- [x] Atualização automática de KM do veículo
- [x] Aplicação de margem de lucro em lote
- [x] Modal de confirmação de margem com senha
- [x] Controle de desconto máximo em OS
- [x] Modal de confirmação de desconto com senha
- [x] Build do frontend sem erros
- [x] Backend reiniciado e operacional
- [x] Migration aplicada com sucesso
- [x] Documentação completa criada

---

## 🎯 Próximos Passos Recomendados

1. **Logs de Auditoria:** Registrar todas operações críticas com senha
2. **Histórico de Alterações:** Tabela de log de mudanças de configurações
3. **Níveis de Permissão:** Diferentes níveis de acesso (admin, gerente, operador)
4. **Backup Automático:** Backup de configurações antes de alterações em lote
5. **Notificações:** Alertas quando operações críticas são realizadas

---

**Implementado em:** 15/10/2025  
**Versão:** 1.0  
**Status:** ✅ Produção
