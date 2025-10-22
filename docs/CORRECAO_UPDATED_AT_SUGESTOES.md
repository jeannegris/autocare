# Correção: Campo updated_at NULL em Sugestões de Manutenção

**Data:** 16/10/2025  
**Tipo:** Bug Fix  
**Prioridade:** Crítica  
**Status:** ✅ Corrigido

---

## 📋 Problema Identificado

### Erro Real no Backend
```
❌ Erro ao criar sugestão de manutenção: (psycopg2.errors.NotNullViolation) 
null value in column "updated_at" of relation "sugestoes_manutencao" 
violates not-null constraint

DETAIL: Failing row contains (26, Óleo de motor (mineral), 3.000 KM ou 4 meses, 
null, 3000, 3000, Óleo, t, 1, 2025-10-16 00:35:51.586385, null).
```

### Análise do Erro
O campo `updated_at` estava sendo inserido como `NULL`, mas a constraint da coluna no banco não permite valores nulos.

**SQL gerado pelo SQLAlchemy:**
```sql
INSERT INTO sugestoes_manutencao (
    nome_peca, km_media_troca, observacoes, intervalo_km_min, 
    intervalo_km_max, tipo_servico, ativo, ordem_exibicao, updated_at
) VALUES (..., ..., ..., ..., ..., ..., ..., ..., NULL)  -- ❌ NULL aqui!
```

### Causa Raiz
No model SQLAlchemy, o campo `updated_at` estava definido apenas com `onupdate`:

```python
# ❌ ANTES (ERRADO)
updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

**Problema:** 
- `onupdate` só define valor em **atualizações** (UPDATE)
- Em **inserções** (INSERT), o valor fica `None` (NULL)
- Mas a coluna no banco tem `NOT NULL` constraint

---

## ✅ Solução Implementada

### Correção no Model

**Arquivo:** `/var/www/autocare/backend/models/autocare_models.py`

**Linha ~387:**

```python
# ✅ DEPOIS (CORRETO)
updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

**Explicação:**
- `server_default=func.now()` → Define valor padrão no INSERT
- `onupdate=func.now()` → Atualiza valor no UPDATE

Agora ambas as operações têm valores corretos:
- **INSERT:** `updated_at` = timestamp atual
- **UPDATE:** `updated_at` = novo timestamp atual

---

## 🔍 Comparação Antes/Depois

### Antes da Correção

```python
class SugestaoManutencao(Base):
    __tablename__ = "sugestoes_manutencao"
    
    id = Column(Integer, primary_key=True, index=True)
    nome_peca = Column(String(200), nullable=False)
    km_media_troca = Column(String(100), nullable=False)
    # ... outros campos ...
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())  # ❌ ERRADO
```

**Problema:** Sem `server_default`, o valor no INSERT fica NULL.

### Depois da Correção

```python
class SugestaoManutencao(Base):
    __tablename__ = "sugestoes_manutencao"
    
    id = Column(Integer, primary_key=True, index=True)
    nome_peca = Column(String(200), nullable=False)
    km_media_troca = Column(String(100), nullable=False)
    # ... outros campos ...
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())  # ✅ CORRETO
```

**Solução:** Com `server_default`, o banco preenche automaticamente no INSERT.

---

## 🧪 Testes Realizados

### Teste 1: Criação via API (POST)

**Request:**
```bash
curl -X POST http://localhost:8008/api/sugestoes-manutencao/ \
  -H "Content-Type: application/json" \
  -d '{
    "nome_peca": "Teste Backend",
    "km_media_troca": "10000 km",
    "observacoes": "Teste",
    "intervalo_km_min": 10000,
    "intervalo_km_max": 10000,
    "tipo_servico": "teste",
    "ativo": true,
    "ordem_exibicao": 99
  }'
```

**Response (ANTES - ERRO):**
```json
{
  "detail": "Erro ao criar sugestão de manutenção: null value in column updated_at..."
}
```

**Response (DEPOIS - SUCESSO):**
```json
{
  "nome_peca": "Teste Backend",
  "km_media_troca": "10000 km",
  "observacoes": "Teste",
  "intervalo_km_min": 10000,
  "intervalo_km_max": 10000,
  "tipo_servico": "teste",
  "ativo": true,
  "ordem_exibicao": 99,
  "id": 27,
  "created_at": "2025-10-16T00:37:57.354259",
  "updated_at": "2025-10-16T00:37:57.354259"  // ✅ Valor preenchido!
}
```

### Teste 2: Verificação no Banco

```sql
SELECT id, nome_peca, created_at, updated_at 
FROM sugestoes_manutencao 
WHERE id = 27;
```

**Resultado:**
```
 id |   nome_peca    |        created_at          |        updated_at          
----+----------------+----------------------------+----------------------------
 27 | Teste Backend  | 2025-10-16 00:37:57.354259 | 2025-10-16 00:37:57.354259
```

✅ **Ambos os campos preenchidos corretamente!**

---

## 📊 Impacto da Correção

### Antes
❌ Impossível criar novas sugestões  
❌ Erro 400 Bad Request  
❌ Constraint violation no banco  
❌ Frustração do usuário  

### Depois
✅ Criação de sugestões funciona perfeitamente  
✅ Response 201 Created  
✅ Timestamps corretos no banco  
✅ Sistema totalmente funcional  

---

## 🔧 Detalhes Técnicos

### Definição da Coluna no Banco (Migration)

A migration criou a coluna assim:

```python
sa.Column('updated_at', sa.DateTime(), nullable=False, 
          server_default=sa.text('CURRENT_TIMESTAMP'))
```

**Importante:** A coluna tem `nullable=False` e `server_default`, então o banco **sempre** preenche o valor.

### Mapeamento do SQLAlchemy

O SQLAlchemy precisa saber que o banco vai preencher automaticamente:

```python
# Com server_default, SQLAlchemy não tenta inserir NULL
updated_at = Column(DateTime(timezone=True), 
                   server_default=func.now(),  # Banco preenche no INSERT
                   onupdate=func.now())        # Banco atualiza no UPDATE
```

### Comportamento do func.now()

- `func.now()` → Função SQL `CURRENT_TIMESTAMP`
- Executada no **servidor do banco de dados**
- Garante consistência de timezone
- Mais eficiente que gerar no Python

---

## 🎯 Padrão Correto para Timestamps

### ✅ Recomendação

Para campos de timestamp NOT NULL:

```python
created_at = Column(DateTime(timezone=True), 
                   server_default=func.now(),
                   nullable=False)

updated_at = Column(DateTime(timezone=True), 
                   server_default=func.now(),
                   onupdate=func.now(),
                   nullable=False)
```

### ❌ Evitar

```python
# ERRADO - NULL em INSERT
updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# ERRADO - Timezone não gerenciado
updated_at = Column(DateTime, server_default=func.now())
```

---

## 📝 Outros Models Verificados

Verifiquei outros models no projeto para garantir consistência:

### ✅ Cliente (correto)
```python
created_at = Column(DateTime(timezone=True), server_default=func.now())
updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```
**Status:** OK - `updated_at` é nullable (sem constraint NOT NULL)

### ✅ Veiculo (correto)
```python
created_at = Column(DateTime(timezone=True), server_default=func.now())
updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```
**Status:** OK - `updated_at` é nullable

### ✅ Configuracao (correto)
```python
created_at = Column(DateTime(timezone=True), server_default=func.now())
updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```
**Status:** OK - `updated_at` é nullable

### ⚠️ SugestaoManutencao (CORRIGIDO)
```python
# ANTES
updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# DEPOIS
updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```
**Status:** ✅ CORRIGIDO - Agora tem `server_default`

---

## 🚀 Deploy

### Arquivos Alterados
- `/var/www/autocare/backend/models/autocare_models.py` (1 linha)

### Comandos Executados
```bash
# Reiniciar backend
sudo systemctl restart autocare-backend

# Testar API
curl -X POST http://localhost:8008/api/sugestoes-manutencao/ ...
```

### Status
✅ Backend reiniciado com sucesso  
✅ API testada e funcionando  
✅ Registro de teste criado e deletado  
✅ Sistema 100% operacional  

---

## 🎓 Lições Aprendidas

### 1. Consistência entre Migration e Model
A migration definiu `server_default`, mas o model não refletia isso.

**Solução:** Sempre alinhar definições de coluna entre migration e model.

### 2. Testes de API
Testar endpoints via curl/Postman antes de integrar no frontend.

**Benefício:** Identifica problemas no backend isoladamente.

### 3. Análise de Logs
Os logs do backend mostraram claramente o erro SQL.

**Comando útil:**
```bash
sudo journalctl -u autocare-backend -n 50 --no-pager
```

### 4. Constraint Violations
Constraints NOT NULL devem ter valores padrão no model.

**Regra:** Se coluna é NOT NULL, model deve ter `default` ou `server_default`.

---

## ✅ Checklist de Validação

- [x] Erro identificado nos logs
- [x] Causa raiz encontrada (falta de server_default)
- [x] Model corrigido
- [x] Backend reiniciado
- [x] API testada com sucesso (POST)
- [x] Timestamps verificados no banco
- [x] Registro de teste limpo
- [x] Outros models auditados
- [x] Documentação completa criada
- [x] Pronto para teste do usuário

---

## 🔄 Próximas Validações Sugeridas

1. **Teste de Edição (PUT):** Verificar se `updated_at` atualiza corretamente
2. **Teste de Frontend:** Criar sugestão pela interface
3. **Teste de Listagem:** Confirmar que todas as sugestões aparecem
4. **Auditoria:** Revisar todos os models para padrões consistentes

---

**Corrigido por:** GitHub Copilot  
**Data:** 16/10/2025 00:37  
**Tempo de resolução:** ~8 minutos  
**Status:** ✅ Resolvido e Testado
