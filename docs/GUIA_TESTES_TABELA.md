# 🧪 Guia de Testes - Tabela Interativa

## Como Testar as Novas Funcionalidades

### 🎬 Cenários de Teste

---

## 1️⃣ TESTE: Ordenação Crescente

**Objetivo**: Verificar se a ordenação crescente funciona

**Passos**:
1. Abra a página de Ordens de Serviço
2. Localize a tabela com as ordens
3. Clique no cabeçalho **"Cliente/Veículo"**

**Resultado Esperado**:
```
ANTES do clique:
#00012 → Paulo Freitas
#00011 → Ana Silva
#00010 → Carlos Lima

DEPOIS do clique (↑ aparece ao lado do título):
#00011 → Ana Silva
#00010 → Carlos Lima
#00012 → Paulo Freitas
```

**Status**: ✅ Se os clientes aparecerem em ordem alfabética A-Z

---

## 2️⃣ TESTE: Ordenação Decrescente

**Objetivo**: Verificar se consegue inverter a ordenação

**Passos**:
1. Com a ordenação crescente ativa (passo anterior)
2. Clique **novamente** no cabeçalho **"Cliente/Veículo"**

**Resultado Esperado**:
```
ANTES (↑):
Ana Silva
Carlos Lima
Paulo Freitas

DEPOIS (↓ aparece):
Paulo Freitas
Carlos Lima
Ana Silva
```

**Status**: ✅ Se os clientes aparecerem em ordem alfabética Z-A

---

## 3️⃣ TESTE: Ordenação por Valor

**Objetivo**: Verificar ordenação numérica

**Passos**:
1. Clique no cabeçalho **"Valor"** uma vez (ordem crescente)
2. Clique novamente (ordem decrescente)

**Resultado Esperado**:
```
Primeira vez (↑):
R$ 140,00
R$ 200,00
R$ 250,00
R$ 502,00

Segunda vez (↓):
R$ 502,00
R$ 250,00
R$ 200,00
R$ 140,00
```

**Status**: ✅ Se valores forem do menor→maior (↑) ou maior→menor (↓)

---

## 4️⃣ TESTE: Ordenação por Data

**Objetivo**: Verificar ordenação cronológica

**Passos**:
1. Clique no cabeçalho **"Data"** uma vez

**Resultado Esperado**:
```
Com (↑):
16/10/2025 01:22  ← Mais antiga
16/10/2025 14:23
16/10/2025 15:51
16/10/2025 23:52  ← Mais recente

Com (↓):
16/10/2025 23:52  ← Mais recente
16/10/2025 15:51
16/10/2025 14:23
16/10/2025 01:22  ← Mais antiga
```

**Status**: ✅ Se datas forem ordenadas cronologicamente

---

## 5️⃣ TESTE: Redimensionar Coluna para Maior

**Objetivo**: Aumentar largura da coluna

**Passos**:
1. Posicione o mouse na **borda direita** do cabeçalho "Cliente/Veículo"
2. Observe o cursor mudar para **↔** (col-resize)
3. Observe a borda ficar **azul**
4. Clique e **arraste para a direita** (~100px)
5. Solte o mouse

**Resultado Esperado**:
```
ANTES:                    DEPOIS:
┌──────────────┐         ┌────────────────────────┐
│ Cliente/Veí  │   →     │   Cliente/Veículo      │
│ João Silva   │         │      João Silva        │
│ ABC-1234     │         │      ABC-1234          │
└──────────────┘         └────────────────────────┘
    ~220px                      ~320px
```

**Status**: ✅ Se coluna aumentar e texto continuar centralizado

---

## 6️⃣ TESTE: Redimensionar Coluna para Menor

**Objetivo**: Reduzir largura da coluna

**Passos**:
1. Posicione o mouse na borda direita de "Tipo"
2. Arraste para a **esquerda** até ficar bem estreita

**Resultado Esperado**:
```
ANTES:                DEPOIS:
┌───────────┐        ┌─────┐
│   Tipo    │   →    │ Tip │  ← Para em 80px (mínimo)
│   VENDA   │        │ VEN │
└───────────┘        └─────┘
   ~150px              80px
```

**Status**: ✅ Se parar em 80px (largura mínima) e não permitir menor

---

## 7️⃣ TESTE: Ícones de Ordenação

**Objetivo**: Verificar feedback visual correto

**Passos**:
1. Observe os ícones nos cabeçalhos
2. Clique em "Status"
3. Observe mudança de ícone

**Resultado Esperado**:
```
Estado Inicial (sem ordenação):
Status ⇅  ← Seta dupla opaca

Depois do 1º clique (crescente):
Status ↑  ← Seta para cima

Depois do 2º clique (decrescente):
Status ↓  ← Seta para baixo

Depois do 3º clique (volta ao inicial):
Status ⇅  ← Volta à seta dupla
```

**Status**: ✅ Se ícones mudarem conforme cliques

---

## 8️⃣ TESTE: Ordenação + Filtros

**Objetivo**: Verificar compatibilidade com filtros

**Passos**:
1. Digite "João" na busca
2. Clique em "Data" para ordenar por data (↑)
3. Observe apenas ordens de João, ordenadas por data

**Resultado Esperado**:
```
Filtro: "João" → Mostra só ordens do João
Ordenação: Data ↑ → Ordens do João em ordem cronológica
```

**Status**: ✅ Se filtros e ordenação funcionarem juntos

---

## 9️⃣ TESTE: Hover nos Cabeçalhos

**Objetivo**: Verificar feedback visual ao passar mouse

**Passos**:
1. Passe o mouse sobre qualquer cabeçalho de coluna
2. NÃO clique, apenas observe

**Resultado Esperado**:
- ✅ Fundo do cabeçalho fica levemente cinza (hover)
- ✅ Cursor muda para ponteiro (cursor: pointer)
- ✅ Ícone de ordenação fica visível

**Status**: ✅ Se hover funcionar em todos os cabeçalhos

---

## 🔟 TESTE: Redimensionamento Durante Ordenação

**Objetivo**: Verificar que larguras se mantêm após ordenar

**Passos**:
1. Redimensione "Cliente/Veículo" para 300px
2. Clique em "Cliente/Veículo" para ordenar
3. Observe se largura se manteve

**Resultado Esperado**:
- ✅ Coluna mantém 300px após ordenação
- ✅ Ordenação funciona normalmente
- ✅ Conteúdo continua centralizado

**Status**: ✅ Se largura personalizada for mantida

---

## 1️⃣1️⃣ TESTE: Múltiplas Colunas Redimensionadas

**Objetivo**: Redimensionar várias colunas ao mesmo tempo

**Passos**:
1. Redimensione "Ordem" para 100px
2. Redimensione "Cliente/Veículo" para 250px
3. Redimensione "Valor" para 160px
4. Navegue pela tabela

**Resultado Esperado**:
```
┌────────┬─────────────────────┬─────────┬────────────┐
│ Ordem  │  Cliente/Veículo    │  Tipo   │   Valor    │
│ 100px  │      250px          │ 150px   │   160px    │
└────────┴─────────────────────┴─────────┴────────────┘
```

**Status**: ✅ Se todas as larguras personalizadas forem mantidas

---

## 1️⃣2️⃣ TESTE: Texto Longo com Quebra de Linha

**Objetivo**: Verificar comportamento com nomes muito longos

**Passos**:
1. Localize uma ordem com nome de cliente longo
2. Redimensione a coluna "Cliente/Veículo" para estreita (~150px)
3. Observe a quebra de linha

**Resultado Esperado**:
```
ANTES (coluna larga):
┌─────────────────────────┐
│  Maria Santos Oliveira  │
│       ABC-1234          │
└─────────────────────────┘
    Altura: 1 linha

DEPOIS (coluna estreita):
┌───────────────┐
│ Maria Santos  │
│   Oliveira    │  ← Quebrou em 2 linhas
│   ABC-1234    │
└───────────────┘
    Altura: 2+ linhas
```

**Status**: ✅ Se texto quebrar e altura aumentar automaticamente

---

## 📊 Checklist de Testes

### Ordenação
- [ ] Ordenação crescente (A→Z, 0→9, antiga→recente)
- [ ] Ordenação decrescente (Z→A, 9→0, recente→antiga)
- [ ] Alternância de direção funciona
- [ ] Ícones mudam corretamente (⇅ ↑ ↓)
- [ ] Funciona em todas as colunas
- [ ] Funciona com filtros ativos

### Redimensionamento
- [ ] Cursor muda para col-resize na borda
- [ ] Borda fica azul ao passar mouse
- [ ] Arraste para direita aumenta largura
- [ ] Arraste para esquerda diminui largura
- [ ] Largura mínima de 80px é respeitada
- [ ] Larguras são mantidas após ordenar
- [ ] Múltiplas colunas podem ser redimensionadas

### Visual
- [ ] Hover nos cabeçalhos funciona
- [ ] Texto permanece centralizado em Cliente/Veículo
- [ ] Quebra de linha funciona para textos longos
- [ ] Altura da linha aumenta automaticamente
- [ ] Ícones estão alinhados corretamente

---

## 🐛 Problemas Comuns e Soluções

### "Não consigo redimensionar"
**Solução**: Certifique-se de estar arrastando na **borda direita** do cabeçalho, não no meio do texto

### "Ordenação não está funcionando"
**Solução**: Verifique se há dados na coluna. Colunas vazias podem não ordenar visivelmente

### "Coluna voltou ao tamanho original"
**Solução**: As larguras são resetadas ao recarregar a página (comportamento esperado)

### "Texto ficou cortado"
**Solução**: Aumente a largura da coluna arrastando para a direita

---

## ✅ Teste Passou Se...

1. **Ordenação**: Clique nos cabeçalhos alterna corretamente entre ⇅ → ↑ → ↓
2. **Redimensionamento**: Arrastar bordas altera largura das colunas
3. **Visual**: Ícones aparecem e mudam conforme esperado
4. **Responsivo**: Texto quebra e centraliza corretamente
5. **Performance**: Tudo funciona instantaneamente sem travamentos

---

## 🎯 Teste Completo Rápido (5 minutos)

1. **Abra a página** de Ordens de Serviço
2. **Clique em "Cliente"** → Deve ordenar A-Z (↑)
3. **Clique novamente** → Deve ordenar Z-A (↓)
4. **Clique em "Valor"** → Deve ordenar do menor ao maior (↑)
5. **Arraste borda de "Cliente/Veículo"** para direita → Deve aumentar
6. **Arraste borda de "Tipo"** para esquerda → Deve diminuir até 80px
7. **Passe mouse nas bordas** → Deve ficar azul e cursor mudar
8. **Digite na busca** e ordene → Deve funcionar junto

**Se todos passaram**: ✅ Implementação funcionando perfeitamente!

---

**Última Atualização**: 16/10/2025  
**Versão**: 1.0.0
