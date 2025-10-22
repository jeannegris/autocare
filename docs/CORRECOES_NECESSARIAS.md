# 🔧 Correções Necessárias - AutoCare

**Data:** 15 de outubro de 2025  
**Status:** PENDENTE DE APLICAÇÃO

---

## 🔴 CORREÇÕES CRÍTICAS (Aplicar Imediatamente)

### 1. Corrigir mapeamento do campo `codigo` em Produtos

**Arquivo:** `/var/www/autocare/backend/models/autocare_models.py`  
**Linha:** ~113

**ATUAL (INCORRETO):**
```python
codigo = Column('codigo_barras', String(50), unique=True, index=True)
```

**CORRIGIR PARA:**
```python
codigo = Column(String(50), unique=True, index=True)
# OU explicitamente:
# codigo = Column('codigo', String(50), unique=True, index=True)
```

**Motivo:** O banco de dados tem uma coluna chamada `codigo`, não `codigo_barras`. O mapeamento atual falhará ao tentar acessar `codigo_barras`.

---

### 2. Corrigir mapeamento do campo `chassis` em Veículos

**Arquivo:** `/var/www/autocare/backend/models/autocare_models.py`  
**Linha:** ~50

**ATUAL (INCORRETO):**
```python
chassis = Column('chassi', String(50), unique=True)
```

**CORRIGIR PARA:**
```python
chassis = Column(String(50), unique=True)
# OU explicitamente:
# chassis = Column('chassis', String(50), unique=True)
```

**Motivo:** O banco de dados tem uma coluna chamada `chassis`, não `chassi`. O mapeamento atual falhará ao tentar acessar `chassi`.

---

### 3. Corrigir comentário no campo `item_id` em MovimentoEstoque

**Arquivo:** `/var/www/autocare/backend/models/autocare_models.py`  
**Linha:** ~256

**ATUAL (COMENTÁRIO INCORRETO):**
```python
# No banco a coluna existente é `produto_id` — expor como atributo `item_id` para compatibilidade
item_id = Column('produto_id', Integer, ForeignKey("produtos.id"), nullable=False)
```

**CORRIGIR PARA:**
```python
# Coluna no banco é 'item_id' que referencia produtos
item_id = Column(Integer, ForeignKey("produtos.id"), nullable=False)
# OU manter o mapeamento explícito se preferir:
# item_id = Column('item_id', Integer, ForeignKey("produtos.id"), nullable=False)
```

**Motivo:** O banco de dados tem a coluna como `item_id`, não `produto_id`. O comentário está causando confusão.

---

## ⚠️ CORREÇÕES DE MÉDIA PRIORIDADE

### 4. Revisar campos calculados vs colunas reais em Produtos

**Arquivo:** `/var/www/autocare/backend/models/autocare_models.py`  
**Linhas:** ~125-155

**Problema:** Os seguintes campos existem no banco de dados mas estão definidos como `@property`:
- `status`
- `data_ultima_movimentacao`
- `tipo_ultima_movimentacao`

**Verificação no DB:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'produtos' 
AND column_name IN ('status', 'data_ultima_movimentacao', 'tipo_ultima_movimentacao');

-- Resultado:
-- status | character varying(20)
-- data_ultima_movimentacao | timestamp with time zone
-- tipo_ultima_movimentacao | character varying(10)
```

**OPÇÕES:**

**Opção A - Usar colunas do banco (Recomendado para performance):**
```python
status = Column(String(20))
data_ultima_movimentacao = Column(DateTime(timezone=True))
tipo_ultima_movimentacao = Column(String(10))
```

**Opção B - Manter properties mas sincronizar com DB (via triggers/updates):**
Manter o código atual mas garantir que o banco seja atualizado via triggers ou na lógica de movimentação.

**Recomendação:** Opção A - Usar as colunas do banco para evitar inconsistências.

---

### 5. Remover arquivo não utilizado

**Arquivo:** `/var/www/autocare/backend/models/autocare_models_simple.py`

**Ação:** 
```bash
# Este arquivo NÃO é usado por nenhuma rota
# Pode ser removido ou arquivado com segurança
mv autocare_models_simple.py autocare_models_simple.py.backup
```

**Motivo:** Evitar confusão. Todas as rotas usam `autocare_models.py`.

---

## 📝 SCRIPT DE CORREÇÃO AUTOMÁTICA

```bash
#!/bin/bash
# Script para aplicar correções no modelo

cd /var/www/autocare/backend/models

# Backup do arquivo original
cp autocare_models.py autocare_models.py.backup

# Correção 1: campo codigo
sed -i "s/codigo = Column('codigo_barras', String(50)/codigo = Column(String(50)/" autocare_models.py

# Correção 2: campo chassis  
sed -i "s/chassis = Column('chassi', String(50)/chassis = Column(String(50)/" autocare_models.py

# Correção 3: comentário item_id
sed -i "s/# No banco a coluna existente é \`produto_id\`/# Coluna no banco é 'item_id' que referencia produtos/" autocare_models.py

echo "✅ Correções aplicadas! Verifique o arquivo autocare_models.py"
echo "⚠️  Backup salvo em autocare_models.py.backup"
```

---

## 🧪 TESTES APÓS CORREÇÃO

### 1. Testar criação de produto
```python
# Teste no Python shell ou endpoint
from models.autocare_models import Produto
from db import SessionLocal

db = SessionLocal()
produto = Produto(
    codigo="TEST001",
    nome="Produto Teste",
    preco_custo=10.00,
    preco_venda=20.00,
    quantidade_atual=100,
    quantidade_minima=10,
    unidade="UN"
)
db.add(produto)
db.commit()
print(f"✅ Produto criado: {produto.codigo} - {produto.nome}")
```

### 2. Testar criação de veículo
```python
from models.autocare_models import Veiculo

veiculo = Veiculo(
    cliente_id=1,
    marca="Test",
    modelo="Model",
    ano=2024,
    chassis="TEST123456",  # Testar campo corrigido
    km_atual=0
)
db.add(veiculo)
db.commit()
print(f"✅ Veículo criado: {veiculo.chassis}")
```

### 3. Testar movimentação de estoque
```python
from models.autocare_models import MovimentoEstoque

mov = MovimentoEstoque(
    item_id=1,  # Testar campo corrigido
    tipo="ENTRADA",
    quantidade=10,
    motivo="Teste"
)
db.add(mov)
db.commit()
print(f"✅ Movimentação criada para item {mov.item_id}")
```

---

## 📊 CHECKLIST DE VERIFICAÇÃO

- [ ] Backup do arquivo `autocare_models.py` criado
- [ ] Correção 1 aplicada: campo `codigo` em Produto
- [ ] Correção 2 aplicada: campo `chassis` em Veiculo
- [ ] Correção 3 aplicada: comentário `item_id` em MovimentoEstoque
- [ ] Testes de criação de produto executados
- [ ] Testes de criação de veículo executados
- [ ] Testes de movimentação de estoque executados
- [ ] Aplicação reiniciada sem erros
- [ ] Endpoints testados no Postman/curl
- [ ] Frontend testado com as correções

---

## 🚀 APLICAÇÃO DAS CORREÇÕES

### Passo a Passo:

1. **Parar o serviço backend:**
```bash
sudo systemctl stop autocare-backend
# OU
pm2 stop autocare-backend
```

2. **Fazer backup:**
```bash
cd /var/www/autocare/backend/models
cp autocare_models.py autocare_models.py.backup.$(date +%Y%m%d_%H%M%S)
```

3. **Aplicar correções manualmente** (editar o arquivo) ou usar o script acima

4. **Reiniciar o serviço:**
```bash
sudo systemctl start autocare-backend
# OU
pm2 restart autocare-backend
```

5. **Verificar logs:**
```bash
tail -f /var/www/autocare/backend/logs/backend.log
# OU
pm2 logs autocare-backend
```

6. **Testar endpoints:**
```bash
# Testar health check
curl http://localhost:8008/health

# Testar listagem de produtos
curl http://localhost:8008/api/estoque/produtos

# Testar listagem de veículos
curl http://localhost:8008/api/veiculos
```

---

## ⚠️ AVISOS IMPORTANTES

1. **Backup Obrigatório:** Sempre faça backup antes de modificar os models
2. **Testar em Desenvolvimento:** Se possível, teste primeiro em ambiente de desenvolvimento
3. **Verificar Migrações:** As correções podem requerer ajuste nas migrações do Alembic
4. **Dados Existentes:** Verifique se há dados já cadastrados que possam ser afetados

---

## 📞 SUPORTE

Se houver problemas após aplicar as correções:

1. Restaurar o backup:
```bash
cd /var/www/autocare/backend/models
cp autocare_models.py.backup autocare_models.py
```

2. Reiniciar o serviço novamente

3. Verificar logs para identificar o erro específico

---

**Documento criado automaticamente**  
**Baseado na análise de correspondência de dados**  
**Data:** 15/10/2025
