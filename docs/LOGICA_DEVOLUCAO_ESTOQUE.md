# Lógica de Devolução ao Estoque - Ordem de Serviço

## Resumo das Alterações

Implementei a funcionalidade de **devolução automática ao estoque** quando uma ordem de serviço tem seu status alterado para estados de "pausa" ou cancelamento.

## Como Funciona

### Status que Geram Devolução
Quando uma ordem transita **DE** um status com baixa aplicada **PARA** um destes status:
- `PENDENTE`
- `AGUARDANDO_PECA` 
- `AGUARDANDO_APROVACAO`
- `CANCELADA`

### Condição para Devolução
A devolução só acontece se a ordem **anteriormente** estava em:
- `CONCLUIDA` 
- `EM_ANDAMENTO`

### O Que é Devolvido
- **Todos os itens do tipo PRODUTO** da ordem
- **Quantidade completa** de cada item é devolvida ao estoque
- **Movimentos de estoque** são criados para auditoria (tipo `ENTRADA`)

## Arquivo Alterado

**Arquivo:** `backend/routes/autocare_ordens.py`
**Função:** Handler PUT `/ordens/{ordem_id}`

### Lógica Implementada

```python
elif novo_status in ["PENDENTE", "AGUARDANDO_PECA", "AGUARDANDO_APROVACAO", "CANCELADA"] and previous_status in ["CONCLUIDA", "EM_ANDAMENTO"]:
    # Transição DE status com baixa aplicada PARA status de pausa/cancelamento -> devolver tudo ao estoque
    
    # Para cada item PRODUTO da ordem:
    # 1. Criar MovimentoEstoque tipo ENTRADA
    # 2. Somar quantidade ao produto.quantidade_atual 
    # 3. Atualizar data_ultima_movimentacao e tipo_ultima_movimentacao
    # 4. Recalcular status do produto (DISPONIVEL/BAIXO_ESTOQUE/SEM_ESTOQUE)
```

## Estados da Lógica de Estoque

Agora o sistema possui **3 cenários** de controle de estoque:

### 1. Transição Inicial para CONCLUIDA/EM_ANDAMENTO
- **Quando:** Status anterior NÃO era CONCLUIDA nem EM_ANDAMENTO
- **Ação:** Baixa completa (SAÍDA) de todos os itens PRODUTO

### 2. Edição com Ordem já CONCLUIDA/EM_ANDAMENTO  
- **Quando:** Status anterior E atual são CONCLUIDA ou EM_ANDAMENTO
- **Ação:** Aplicar somente o DELTA (diferença) das quantidades alteradas

### 3. **NOVO:** Devolução por Cancelamento/Pausa
- **Quando:** Status anterior era CONCLUIDA/EM_ANDAMENTO e novo é PENDENTE/AGUARDANDO/CANCELADA
- **Ação:** Devolução completa (ENTRADA) de todos os itens PRODUTO

## Como Testar

### 1. Via Interface do Usuário

1. **Criar uma ordem** com itens PRODUTO
2. **Alterar status** para `EM_ANDAMENTO` ou `CONCLUIDA`
   - ✅ Verificar que o estoque foi decrementado
3. **Alterar status** para `CANCELADA` (ou outro status de pausa)
   - ✅ Verificar que o estoque foi devolvido
4. **Consultar movimentos** para ver os registros de auditoria

### 2. Via API (Endpoints)

```bash
# Verificar ordem atual
curl -X GET "http://localhost:8008/autocare-api/ordens/15"

# Verificar estoque dos produtos
curl -X GET "http://localhost:8008/autocare-api/estoque/produtos/3"
curl -X GET "http://localhost:8008/autocare-api/estoque/produtos/8"

# Alterar status da ordem para CANCELADA
curl -X PUT "http://localhost:8008/autocare-api/ordens/15" \
  -H "Content-Type: application/json" \
  -d '{"status": "CANCELADA"}'

# Verificar movimentos de estoque criados
curl -X GET "http://localhost:8008/autocare-api/estoque/movimentos?ordem_servico_id=15"
```

### 3. Script de Demonstração

Execute o script criado em `/var/www/autocare/tmp/demonstracao_devolucao.py`:

```bash
cd /var/www/autocare
PYTHONPATH=/var/www/autocare:/var/www/autocare/backend backend/venv/bin/python3 tmp/demonstracao_devolucao.py
```

## Registros de Auditoria

Cada devolução cria registros na tabela `movimentos_estoque`:

- **tipo:** `ENTRADA`
- **motivo:** `"Devolução Ordem de Serviço"`  
- **observacoes:** `"OS {numero} - {descricao_item} - Status alterado para: {novo_status}"`
- **ordem_servico_id:** ID da ordem que gerou o movimento

## Validações de Segurança

- ✅ **Verificação de status anterior:** só aplica devolução se anteriormente tinha baixa
- ✅ **Somente itens PRODUTO:** itens de serviço não afetam estoque
- ✅ **Auditoria completa:** todos os movimentos ficam registrados
- ✅ **Atualização de status do produto:** recalcula DISPONIVEL/BAIXO_ESTOQUE/SEM_ESTOQUE
- ✅ **Transação atômica:** tudo ou nada (em caso de erro, nada é alterado)

## Exemplo Prático

**Cenário:** Ordem 00000002 (ID 15) com 2 produtos

**Situação inicial:**
- Produto RJ 1: estoque = 16, item na ordem = 2 unidades  
- Produto SP 1: estoque = 5, item na ordem = 3 unidades
- Status da ordem: `PENDENTE` 

**Se a ordem for alterada para `CONCLUIDA`:**
- Produto RJ 1: estoque = 14 (16-2)
- Produto SP 1: estoque = 2 (5-3)

**Se depois for alterada para `CANCELADA`:**
- Produto RJ 1: estoque = 16 (14+2) - **devolvido**
- Produto SP 1: estoque = 5 (2+3) - **devolvido**

## Compatibilidade

- ✅ **Backward compatible:** ordens existentes continuam funcionando
- ✅ **Frontend:** funciona com modal de edição e visualização existentes
- ✅ **API:** usa o mesmo endpoint PUT que já existe
- ✅ **Banco de dados:** usa tabelas existentes, sem migrations necessárias