# Teste Manual - Movimentação de Estoque e Cancelamento

## Preparação

### Ordem de Teste
- **ID**: 10
- **Número**: 99999
- **Cliente**: João da Silva (ID: 9)
- **Produto**: Litros Shell 20w50 (ID: 10)
- **Quantidade**: 2 litros
- **Estoque inicial**: 18 unidades

---

## Cenário 1: PENDENTE → EM_ANDAMENTO (Criar SAIDA)

### Estado Inicial
- Status: `PENDENTE`
- Estoque produto 10: 18 unidades
- Movimentos: 0

### Ação
1. Abrir ordem ID 10 no frontend
2. Alterar status para `EM_ANDAMENTO`
3. Confirmar alteração

### Resultado Esperado
✅ Status atualizado para `EM_ANDAMENTO`
✅ Movimento criado:
   - Tipo: `SAIDA`
   - Quantidade: 2
   - Motivo: "Ordem de Serviço"
   - Observações: "OS 99999 - ... - Status: EM_ANDAMENTO"
✅ Estoque atualizado: 18 → 16 unidades

### Verificação SQL
```sql
-- Ver movimentos
SELECT * FROM movimentos_estoque WHERE ordem_servico_id = 10 ORDER BY id DESC;

-- Ver estoque atual
SELECT id, nome, quantidade_estoque FROM produtos WHERE id = 10;
```

---

## Cenário 2: EM_ANDAMENTO → AGUARDANDO_PECA (Criar ENTRADA - Reversão)

### Estado Inicial
- Status: `EM_ANDAMENTO`
- Estoque produto 10: 16 unidades
- Movimentos: 1 SAIDA

### Ação
1. Abrir ordem ID 10
2. Alterar status para `AGUARDANDO_PECA`
3. Confirmar alteração

### Resultado Esperado
✅ Status atualizado para `AGUARDANDO_PECA`
✅ Movimento criado:
   - Tipo: `ENTRADA`
   - Quantidade: 2
   - Motivo: "Devolução Ordem de Serviço"
   - Observações: "OS 99999 - ... - Status alterado para: AGUARDANDO_PECA"
✅ Estoque atualizado: 16 → 18 unidades (devolvido)

### Verificação SQL
```sql
-- Ver todos os movimentos
SELECT id, tipo, quantidade, motivo, observacoes 
FROM movimentos_estoque 
WHERE ordem_servico_id = 10 
ORDER BY id;

-- Verificar saldo
SELECT 
    SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE 0 END) as saidas,
    SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade ELSE 0 END) as entradas
FROM movimentos_estoque 
WHERE ordem_servico_id = 10;
```

---

## Cenário 3: AGUARDANDO_PECA → EM_ANDAMENTO (Nova SAIDA)

### Estado Inicial
- Status: `AGUARDANDO_PECA`
- Estoque produto 10: 18 unidades
- Movimentos: 1 SAIDA + 1 ENTRADA

### Ação
1. Abrir ordem ID 10
2. Alterar status para `EM_ANDAMENTO`
3. Confirmar alteração

### Resultado Esperado
✅ Status atualizado para `EM_ANDAMENTO`
✅ Movimento criado:
   - Tipo: `SAIDA`
   - Quantidade: 2
   - Motivo: "Ordem de Serviço"
✅ Estoque atualizado: 18 → 16 unidades

---

## Cenário 4: EM_ANDAMENTO → CANCELADA (Reversão + Motivo)

### Estado Inicial
- Status: `EM_ANDAMENTO`
- Estoque produto 10: 16 unidades
- Movimentos: 2 SAIDA + 1 ENTRADA

### Ação
1. Abrir ordem ID 10
2. Alterar status para `CANCELADA`
3. **MODAL DEVE APARECER** solicitando motivo
4. Digitar motivo: "Cliente desistiu da compra"
5. Confirmar cancelamento

### Resultado Esperado
✅ Modal de cancelamento exibido
✅ Validação: motivo obrigatório
✅ Status atualizado para `CANCELADA`
✅ Campo `motivo_cancelamento` salvo: "Cliente desistiu da compra"
✅ Movimento criado:
   - Tipo: `ENTRADA`
   - Quantidade: 2
   - Motivo: "Cancelamento de Ordem"
   - Observações inclui: "Status alterado para: CANCELADA | Motivo: Cliente desistiu da compra"
✅ Estoque atualizado: 16 → 18 unidades (devolvido)

### Verificação SQL
```sql
-- Ver ordem cancelada
SELECT id, numero, status, motivo_cancelamento 
FROM ordens_servico 
WHERE id = 10;

-- Ver movimento de cancelamento
SELECT * FROM movimentos_estoque 
WHERE ordem_servico_id = 10 AND motivo LIKE '%Cancelamento%';

-- Ver saldo final
SELECT 
    SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE -quantidade END) as saldo
FROM movimentos_estoque 
WHERE ordem_servico_id = 10;
-- Deve retornar 0 (tudo devolvido)
```

---

## Cenário 5: Tentativa de Cancelamento SEM Motivo (Validação)

### Ação
1. Criar nova ordem com status `EM_ANDAMENTO`
2. Tentar alterar para `CANCELADA`
3. **NO MODAL**: deixar campo de motivo vazio
4. Tentar confirmar

### Resultado Esperado
✅ Modal exibe mensagem de erro: "O motivo do cancelamento é obrigatório"
✅ Modal não fecha
✅ Status não é alterado
✅ Nenhum movimento criado

---

## Cenário 6: PENDENTE → CONCLUIDA (SAIDA Direta)

### Estado Inicial
- Status: `PENDENTE`
- Produto com estoque disponível

### Ação
1. Alterar status de `PENDENTE` para `CONCLUIDA`

### Resultado Esperado
✅ Status atualizado para `CONCLUIDA`
✅ Movimento SAIDA criado
✅ Campo `data_conclusao` preenchido com timestamp atual
✅ Estoque baixado

---

## Cenário 7: Consultar Ordens Canceladas

### SQL para Relatório
```sql
SELECT 
    o.id,
    o.numero,
    o.status,
    o.motivo_cancelamento,
    c.nome as cliente_nome,
    o.valor_total,
    o.created_at as data_criacao,
    COUNT(m.id) as total_movimentos
FROM ordens_servico o
JOIN clientes c ON c.id = o.cliente_id
LEFT JOIN movimentos_estoque m ON m.ordem_servico_id = o.id
WHERE o.status = 'CANCELADA'
GROUP BY o.id, o.numero, o.status, o.motivo_cancelamento, c.nome, o.valor_total, o.created_at
ORDER BY o.created_at DESC;
```

### Resultado Esperado
✅ Lista todas ordens canceladas
✅ Exibe motivo de cada cancelamento
✅ Mostra quantidade de movimentos associados

---

## Checklist de Validação

### Backend
- [ ] Coluna `motivo_cancelamento` existe em `ordens_servico`
- [ ] Validação: motivo obrigatório quando status = CANCELADA
- [ ] Movimento SAIDA criado ao mudar para EM_ANDAMENTO/CONCLUIDA
- [ ] Movimento ENTRADA criado ao voltar para PENDENTE/AGUARDANDO_*
- [ ] Movimento ENTRADA com motivo especial ao CANCELAR
- [ ] Observação do movimento inclui motivo do cancelamento
- [ ] Estoque não fica negativo
- [ ] Cálculo correto de devoluções (sem duplicações)

### Frontend
- [ ] Modal de cancelamento abre ao selecionar status CANCELADA
- [ ] Textarea para motivo é obrigatória
- [ ] Validação de campo vazio funciona
- [ ] Modal fecha ao cancelar (volta status anterior)
- [ ] Modal fecha ao confirmar (envia motivo ao backend)
- [ ] Status é atualizado corretamente após confirmação
- [ ] Lista de ordens reflete mudanças imediatamente

### Base de Dados
- [ ] Movimentos registrados com ordem_servico_id correto
- [ ] Valores (preco_unitario, valor_total) preenchidos
- [ ] Campo motivo preenchido corretamente
- [ ] Timestamps (data_movimento) registrados
- [ ] Estoque do produto consistente com movimentos

---

## Comandos Úteis

### Resetar Ordem de Teste
```sql
-- Deletar movimentos
DELETE FROM movimentos_estoque WHERE ordem_servico_id = 10;

-- Resetar ordem
UPDATE ordens_servico 
SET status = 'PENDENTE', motivo_cancelamento = NULL 
WHERE id = 10;

-- Restaurar estoque original
UPDATE produtos SET quantidade_estoque = 18 WHERE id = 10;
```

### Verificar Estado Atual
```bash
# Backend rodando?
curl -s http://localhost:8008/api/ordens/10 | jq .

# Estoque atual?
psql -U autocare -d autocare -c "SELECT id, nome, quantidade_estoque FROM produtos WHERE id = 10;"

# Movimentos da ordem?
psql -U autocare -d autocare -c "SELECT * FROM movimentos_estoque WHERE ordem_servico_id = 10 ORDER BY id;"
```

---

## Resultados dos Testes

### Teste Executado Em: _____/_____/_____

| Cenário | Passou? | Observações |
|---------|---------|-------------|
| 1. PENDENTE → EM_ANDAMENTO | ☐ Sim ☐ Não | |
| 2. EM_ANDAMENTO → AGUARDANDO_PECA | ☐ Sim ☐ Não | |
| 3. AGUARDANDO_PECA → EM_ANDAMENTO | ☐ Sim ☐ Não | |
| 4. EM_ANDAMENTO → CANCELADA | ☐ Sim ☐ Não | |
| 5. Validação Motivo Obrigatório | ☐ Sim ☐ Não | |
| 6. PENDENTE → CONCLUIDA | ☐ Sim ☐ Não | |
| 7. Consulta Ordens Canceladas | ☐ Sim ☐ Não | |

### Problemas Encontrados
1. 
2. 
3. 

### Próximos Passos
1. 
2. 
3. 

---

**Testador:** ___________________________  
**Data:** ____/____/________  
**Versão do Sistema:** 1.0.0
