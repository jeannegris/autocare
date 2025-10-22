# Lógica de Movimentação de Estoque - AutoCare

## Visão Geral

O sistema AutoCare implementa uma lógica robusta de movimentação de estoque baseada no ciclo de vida das ordens de serviço. A movimentação é **automática** e acontece quando o status da ordem muda.

## Regras de Movimentação

### 1. Criação de Movimentos de SAÍDA (Baixa de Estoque)

**Quando:** O status da ordem muda para `EM_ANDAMENTO` ou `CONCLUIDA` (vindo de qualquer outro status)

**Ação:**
- Cria movimento de `SAIDA` para cada item do tipo `PRODUTO`
- Reduz `quantidade_atual` do produto no estoque
- Registra no histórico (`movimentos_estoque`) com:
  - `tipo`: "SAIDA"
  - `motivo`: "Ordem de Serviço"
  - `observacoes`: "OS {numero} - {descrição} - Status: {status}"
  - `ordem_servico_id`: ID da ordem

**Validação:**
- Verifica se há estoque disponível antes de criar a saída
- Se estoque insuficiente: retorna erro HTTP 400

### 2. Criação de Movimentos de ENTRADA (Devolução ao Estoque)

**Quando:** O status da ordem muda DE (`EM_ANDAMENTO` ou `CONCLUIDA`) PARA:
- `PENDENTE`
- `AGUARDANDO_PECA`
- `AGUARDANDO_APROVACAO`
- `CANCELADA`

**Ação:**
- Cria movimento de `ENTRADA` para cada item do tipo `PRODUTO`
- Aumenta `quantidade_atual` do produto no estoque
- Registra no histórico com:
  - `tipo`: "ENTRADA"
  - `motivo`: 
    - "Devolução Ordem de Serviço" (para PENDENTE/AGUARDANDO_*)
    - "Cancelamento de Ordem" (para CANCELADA)
  - `observacoes`: Inclui o status novo e, se CANCELADA, o motivo do cancelamento
  - `ordem_servico_id`: ID da ordem

**Importante:**
- O sistema calcula automaticamente quanto ainda precisa ser devolvido
- Evita devoluções duplicadas comparando:
  - Total de SAÍDA registrado para a ordem/produto
  - Total de ENTRADA já registrado (devoluções anteriores)
  - Devolve apenas a diferença (`ainda_devolver`)

### 3. Cancelamento de Ordem

**Quando:** Status muda para `CANCELADA`

**Requisitos:**
- Campo `motivo_cancelamento` é **obrigatório**
- Se não fornecido: retorna erro HTTP 400

**Ação Adicional:**
- Além da devolução ao estoque (movimento ENTRADA)
- Salva o `motivo_cancelamento` na tabela `ordens_servico`
- Inclui o motivo na observação do movimento de estoque

## Fluxos Possíveis

### Fluxo Normal (Venda/Serviço Concluído)

```
PENDENTE → EM_ANDAMENTO → CONCLUIDA
           ↓               
        SAIDA           (mantém saída)
      (baixa estoque)
```

### Fluxo com Pausa/Ajuste

```
PENDENTE → EM_ANDAMENTO → AGUARDANDO_PECA → EM_ANDAMENTO → CONCLUIDA
           ↓              ↓                  ↓
        SAIDA          ENTRADA            SAIDA
      (baixa)        (devolve)         (baixa novamente)
```

### Fluxo com Cancelamento

```
PENDENTE → EM_ANDAMENTO → CANCELADA
           ↓              ↓
        SAIDA          ENTRADA (com motivo)
      (baixa)        (devolve + registra motivo)
```

## Estrutura de Dados

### Tabela: `movimentos_estoque`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | ID único do movimento |
| `produto_id` | INTEGER | ID do produto (FK) |
| `tipo` | VARCHAR(20) | "ENTRADA" ou "SAIDA" |
| `quantidade` | INTEGER | Quantidade movimentada |
| `preco_unitario` | NUMERIC(10,2) | Preço unitário no momento |
| `valor_total` | NUMERIC(10,2) | Valor total (qtd × preço) |
| `motivo` | VARCHAR(100) | Motivo da movimentação |
| `observacoes` | TEXT | Detalhes adicionais |
| `usuario_id` | INTEGER | ID do usuário (futuro) |
| `usuario_nome` | VARCHAR(255) | Nome do usuário (futuro) |
| `ordem_servico_id` | INTEGER | ID da ordem relacionada (FK) |
| `data_movimento` | TIMESTAMP | Data/hora do movimento |

### Tabela: `ordens_servico` (campos relevantes)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status` | VARCHAR(30) | Status atual da ordem |
| `motivo_cancelamento` | TEXT | Motivo (obrigatório se CANCELADA) |

## Estados de Status

| Status | Descrição | Movimentação |
|--------|-----------|--------------|
| `PENDENTE` | Aguardando início | Nenhuma |
| `EM_ANDAMENTO` | Em execução | SAIDA (se vindo de PENDENTE/AGUARDANDO_*) |
| `AGUARDANDO_PECA` | Aguardando peça | ENTRADA (se vindo de EM_ANDAMENTO/CONCLUIDA) |
| `AGUARDANDO_APROVACAO` | Aguardando aprovação | ENTRADA (se vindo de EM_ANDAMENTO/CONCLUIDA) |
| `CONCLUIDA` | Finalizada | SAIDA (se vindo de PENDENTE/AGUARDANDO_*) |
| `CANCELADA` | Cancelada (com motivo) | ENTRADA + registro de motivo |

## Exemplo Prático

### Cenário 1: Ordem Iniciada e Concluída

1. **Criação da Ordem**
   - Status inicial: `PENDENTE`
   - 2 litros de óleo Shell no estoque: 18 unidades

2. **Início do Serviço**
   - PUT: `status: "EM_ANDAMENTO"`
   - Sistema cria movimento SAIDA: 2 unidades
   - Estoque atualizado: 16 unidades

3. **Conclusão**
   - PUT: `status: "CONCLUIDA"`
   - Nenhuma movimentação adicional (já foi baixado)
   - Estoque permanece: 16 unidades

### Cenário 2: Ordem Cancelada

1. **Criação e Início**
   - Status: `PENDENTE` → `EM_ANDAMENTO`
   - Movimento SAIDA: 2 unidades
   - Estoque: 18 → 16

2. **Cancelamento**
   - PUT: `status: "CANCELADA", motivo_cancelamento: "Cliente desistiu"`
   - Sistema cria movimento ENTRADA: 2 unidades
   - Estoque: 16 → 18 (devolvido)
   - Motivo registrado na ordem e no movimento

### Cenário 3: Ordem Pausada e Retomada

1. **Início**
   - `PENDENTE` → `EM_ANDAMENTO`
   - SAIDA: 2 unidades (18 → 16)

2. **Pausa (falta peça)**
   - `EM_ANDAMENTO` → `AGUARDANDO_PECA`
   - ENTRADA: 2 unidades (16 → 18) - devolução

3. **Retomada**
   - `AGUARDANDO_PECA` → `EM_ANDAMENTO`
   - SAIDA: 2 unidades (18 → 16) - nova baixa

4. **Conclusão**
   - `EM_ANDAMENTO` → `CONCLUIDA`
   - Nenhuma movimentação (já baixado)
   - Estoque final: 16

## Garantias do Sistema

✅ **Não há saída sem estoque disponível**
✅ **Devoluções não duplicam** (cálculo baseado em saldo)
✅ **Histórico completo** de todas as movimentações
✅ **Motivo obrigatório** para cancelamentos
✅ **Rastreabilidade** total por `ordem_servico_id`

## API Endpoints

### PUT `/api/ordens/{id}`

**Payload para mudança de status:**

```json
{
  "status": "EM_ANDAMENTO"  // ou "CONCLUIDA", "CANCELADA", etc.
}
```

**Para cancelamento (obrigatório):**

```json
{
  "status": "CANCELADA",
  "motivo_cancelamento": "Cliente desistiu da compra"
}
```

**Resposta de erro (estoque insuficiente):**

```json
{
  "detail": "Estoque insuficiente para o produto {nome_produto}"
}
```

**Resposta de erro (cancelamento sem motivo):**

```json
{
  "detail": "Motivo do cancelamento é obrigatório ao cancelar uma ordem de serviço"
}
```

## Consultas Úteis

### Ver movimentos de uma ordem específica

```sql
SELECT 
    m.id, m.tipo, m.quantidade, m.motivo, m.observacoes,
    p.nome as produto_nome,
    m.data_movimento
FROM movimentos_estoque m
JOIN produtos p ON p.id = m.produto_id
WHERE m.ordem_servico_id = {ordem_id}
ORDER BY m.data_movimento DESC;
```

### Ver ordens canceladas com motivos

```sql
SELECT 
    o.id, o.numero, o.status, o.motivo_cancelamento,
    c.nome as cliente_nome,
    o.valor_total,
    o.created_at
FROM ordens_servico o
JOIN clientes c ON c.id = o.cliente_id
WHERE o.status = 'CANCELADA'
ORDER BY o.created_at DESC;
```

### Verificar saldo de movimentações por produto/ordem

```sql
SELECT 
    produto_id,
    SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE 0 END) as total_saida,
    SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade ELSE 0 END) as total_entrada,
    SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE -quantidade END) as saldo
FROM movimentos_estoque
WHERE ordem_servico_id = {ordem_id}
GROUP BY produto_id;
```

## Manutenção e Troubleshooting

### Problema: Estoque negativo

**Causa possível:** Movimentação manual no banco de dados

**Solução:**
```sql
-- Verificar produtos com estoque negativo
SELECT id, nome, quantidade_estoque 
FROM produtos 
WHERE quantidade_estoque < 0;

-- Recalcular estoque baseado nos movimentos
UPDATE produtos p
SET quantidade_estoque = (
    SELECT COALESCE(SUM(
        CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade 
             WHEN m.tipo = 'SAIDA' THEN -m.quantidade 
        END
    ), 0)
    FROM movimentos_estoque m
    WHERE m.produto_id = p.id
)
WHERE p.id = {produto_id};
```

### Problema: Devolução não aconteceu

**Verificar:**
1. Status anterior era `EM_ANDAMENTO` ou `CONCLUIDA`?
2. Existe movimento de SAIDA registrado?
3. Já foi devolvido anteriormente?

**Query de diagnóstico:**
```sql
SELECT * FROM movimentos_estoque 
WHERE ordem_servico_id = {ordem_id} 
ORDER BY data_movimento;
```

---

**Última atualização:** 08/10/2025  
**Versão do sistema:** 1.0.0  
**Autor:** AutoCare Development Team
