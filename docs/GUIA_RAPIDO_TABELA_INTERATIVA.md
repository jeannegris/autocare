# Guia Rápido - Tabela Interativa de Ordens de Serviço

## 🎯 Funcionalidades Principais

### 1️⃣ ORDENAÇÃO DE COLUNAS

```
┌─────────────────────────────────────────────────────┐
│  Ordem ⇅  │  Cliente ↑  │  Tipo ⇅  │  Status ⇅     │
├─────────────────────────────────────────────────────┤
│  #00010   │  Ana Silva  │  VENDA   │  Concluída    │
│  #00011   │  Carlos L.  │  SERVICO │  Pendente     │
│  #00012   │  Maria S.   │  VENDA   │  Em Andamento │
└─────────────────────────────────────────────────────┘

Clique em "Cliente" → Ordena A-Z (↑)
Clique novamente  → Ordena Z-A (↓)
Clique outra vez  → Remove ordenação (⇅)
```

**Exemplo Prático:**

| Ação | Resultado |
|------|-----------|
| Clica em "Valor ⇅" | Ordena do menor → maior valor (Valor ↑) |
| Clica em "Valor ↑" | Ordena do maior → menor valor (Valor ↓) |
| Clica em "Data ⇅" | Ordena data mais antiga → mais recente (Data ↑) |

### 2️⃣ REDIMENSIONAMENTO DE COLUNAS

```
         Arraste aqui →  ║
                        ║
┌─────────┬────────────║──┬──────────┐
│  Ordem  │  Cliente   ║  │   Tipo   │
│         │            ║  │          │
└─────────┴────────────║──┴──────────┘
                        ║
            Borda fica azul ao passar mouse
```

**Passos:**
1. Posicione o cursor na **borda direita** do cabeçalho
2. Cursor muda para **↔** (resize)
3. **Clique e arraste** para a esquerda ou direita
4. **Solte** para confirmar a nova largura

**Limites:**
- ✅ Largura mínima: 80px
- ✅ Largura máxima: Ilimitada
- ✅ Todas as colunas são redimensionáveis (exceto Ações)

### 3️⃣ COLUNA CLIENTE/VEÍCULO ESPECIAL

```
┌─────────────────────┐
│   Cliente/Veículo   │ ← Centralizado
├─────────────────────┤
│    👤 João Silva    │ ← Ícone + Nome
│    🚗 ABC-1234      │ ← Ícone + Placa
│                     │
│  👤 Maria Santos    │
│     de Oliveira     │ ← Quebra automática
│    🚗 XYZ-9876      │
└─────────────────────┘
```

**Características:**
- ✅ Texto centralizado
- ✅ Quebra automática para nomes longos
- ✅ Altura da linha aumenta automaticamente
- ✅ Ícones alinhados ao centro

## 🎨 Indicadores Visuais

### Ícones de Ordenação

| Ícone | Significado | Ação ao Clicar |
|-------|-------------|----------------|
| ⇅ | Sem ordenação | Ordena crescente (↑) |
| ↑ | Ordenação crescente (A-Z, 0-9, antiga→recente) | Inverte para decrescente (↓) |
| ↓ | Ordenação decrescente (Z-A, 9-0, recente→antiga) | Remove ordenação (⇅) |

### Estados da Borda de Redimensionamento

| Estado | Cor | Cursor |
|--------|-----|--------|
| Normal | Transparente | default |
| Hover | Azul claro | ↔ col-resize |
| Arrastando | Azul escuro | ↔ col-resize |

## 💡 Casos de Uso

### Caso 1: Encontrar ordem com maior valor
1. Clique em **"Valor"**
2. Clique novamente para ordem decrescente (↓)
3. A ordem de maior valor aparece no topo

### Caso 2: Ver ordens mais recentes primeiro
1. Clique em **"Data"**
2. Clique novamente para ordem decrescente (↓)
3. Ordens mais recentes aparecem primeiro

### Caso 3: Organizar por cliente
1. Clique em **"Cliente/Veículo"**
2. Lista ordenada alfabeticamente
3. Facilita encontrar ordens de um cliente específico

### Caso 4: Ajustar visualização
1. Arraste a borda da coluna **"Cliente/Veículo"** para ampliar
2. Nomes longos ficam mais legíveis
3. Arraste a coluna **"Tipo"** para reduzir se não precisar de espaço

## 🔄 Combinando Funcionalidades

```
Filtro: Status = "Em Andamento"
   ↓
Ordenação: Data ↓ (mais recente primeiro)
   ↓
Redimensionar: Cliente ↔ (ampliar)
   ↓
RESULTADO: Ordens em andamento, mais recentes primeiro,
           com nomes de clientes bem visíveis
```

## ⚠️ Observações Importantes

1. **Larguras não são salvas**: As larguras voltam ao padrão ao recarregar a página
2. **Ordenação + Filtros**: A ordenação funciona junto com os filtros de busca
3. **Performance**: Ordenação é instantânea, mesmo com muitas ordens
4. **Responsividade**: Em telas pequenas, use scroll horizontal

## 🖱️ Atalhos e Dicas

| Ação | Resultado |
|------|-----------|
| **Clique simples** no cabeçalho | Ordena/inverte ordenação |
| **Duplo clique** na borda | (Futuro) Ajusta automaticamente ao conteúdo |
| **Arraste** na borda | Redimensiona coluna |
| **Hover** na borda | Mostra indicador de redimensionamento |

## 📱 Compatibilidade

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ⚠️ Mobile: Redimensionamento limitado (use scroll horizontal)

## 🎓 Exemplo Completo

**Cenário**: "Quero ver as 5 ordens mais caras de outubro que estão pendentes"

**Passos:**
1. **Filtrar**: Data início = 01/10/2025, Data fim = 31/10/2025
2. **Filtrar**: Status = "Pendente"
3. **Ordenar**: Clique em "Valor" duas vezes (↓)
4. **Visualizar**: As 5 primeiras linhas são as mais caras

**Cenário 2**: "Preciso ver melhor os nomes dos clientes"

**Passos:**
1. Posicione o mouse na borda direita de "Cliente/Veículo"
2. Arraste para a direita até ~300px
3. Nomes ficam mais espaçados e legíveis

---

## 🆘 Resolução de Problemas

**P: A ordenação não está funcionando**
- R: Verifique se não há filtros ativos que estejam escondendo os dados

**P: Não consigo redimensionar uma coluna**
- R: Certifique-se de estar arrastando na borda direita do cabeçalho, não no meio

**P: A coluna ficou muito estreita**
- R: Arraste novamente para a direita. Largura mínima é 80px automaticamente

**P: Como voltar às larguras padrão?**
- R: Recarregue a página (F5 ou Ctrl+R)

**P: Posso ordenar por múltiplas colunas?**
- R: Não na versão atual. Está planejado para versão futura.

---

**💡 Dica Final**: Experimente clicar em diferentes colunas e ajustar larguras até encontrar a visualização ideal para seu fluxo de trabalho!
