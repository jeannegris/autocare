# Tabela Ordenável e Redimensionável - Ordens de Serviço

## 📋 Resumo das Funcionalidades

Implementação de uma tabela interativa com colunas redimensionáveis e ordenação crescente/decrescente na página de Ordens de Serviço.

## ✨ Funcionalidades Implementadas

### 1. **Ordenação de Colunas**
- **Clique no cabeçalho da coluna** para ordenar
- **Primeiro clique**: Ordena em ordem crescente (A-Z, 0-9, data antiga → recente)
- **Segundo clique**: Ordena em ordem decrescente (Z-A, 9-0, data recente → antiga)
- **Indicadores visuais**:
  - ↑ (seta para cima) = Ordenação crescente ativa
  - ↓ (seta para baixo) = Ordenação decrescente ativa
  - ⇅ (seta dupla opaca) = Coluna não está ordenada

#### Colunas Ordenáveis:
- **Ordem**: Número da ordem de serviço
- **Cliente/Veículo**: Nome do cliente (alfabético)
- **Tipo**: Tipo de ordem (VENDA, SERVICO, VENDA+SERVICO)
- **Status**: Status da ordem
- **Data**: Data de abertura (mais antiga/recente)
- **Valor**: Valor total em R$ (menor/maior)

### 2. **Redimensionamento de Colunas**
- **Arraste a borda direita** de qualquer cabeçalho de coluna para redimensionar
- **Largura mínima**: 80px (garante legibilidade)
- **Feedback visual**: 
  - Borda fica azul ao passar o mouse
  - Cursor muda para `col-resize`
  - Classe `resizing` adicionada ao body durante o arrasto
- **Larguras iniciais padrão**:
  - Ordem: 120px
  - Cliente/Veículo: 220px
  - Tipo: 150px
  - Status: 180px
  - Data: 180px
  - Valor: 140px
  - Ações: 120px

### 3. **Coluna Cliente/Veículo Centralizada**
- Texto centralizado horizontal e verticalmente
- Quebra automática de linha para nomes longos
- Altura da linha aumenta automaticamente quando necessário
- Ícones centralizados

## 🎨 Experiência do Usuário

### Ordenação
1. Clique no título de qualquer coluna para ordenar
2. Observe o ícone de seta indicando a direção da ordenação
3. Clique novamente para inverter a ordem
4. A ordenação é mantida mesmo ao aplicar filtros

### Redimensionamento
1. Passe o mouse sobre a borda direita do cabeçalho da coluna
2. O cursor mudará para indicar que pode redimensionar
3. Clique e arraste para ajustar a largura
4. Solte o mouse para confirmar a nova largura
5. As larguras são mantidas durante a sessão

## 🔧 Implementação Técnica

### Arquivos Modificados

#### 1. `/frontend/src/pages/OrdensServico.tsx`
```typescript
// Novos imports
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useRef } from 'react';

// Novos estados
const [ordenacao, setOrdenacao] = useState<{
  coluna: string | null;
  direcao: 'asc' | 'desc';
}>({
  coluna: null,
  direcao: 'asc'
});

const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
  ordem: 120,
  cliente: 220,
  tipo: 150,
  status: 180,
  data: 180,
  valor: 140,
  acoes: 120
});

const [resizingColumn, setResizingColumn] = useState<string | null>(null);
const tableRef = useRef<HTMLTableElement>(null);
```

**Funções principais:**
- `handleSort(coluna)`: Alterna ordenação da coluna
- `handleMouseDownResize(e, coluna)`: Inicia redimensionamento
- `useEffect()`: Gerencia eventos de mouse durante redimensionamento
- Lógica de ordenação aplicada ao array de ordens

#### 2. `/frontend/src/index.css`
```css
/* Estilos para redimensionamento de colunas */
@layer utilities {
  .table-resizable th {
    position: relative;
    user-select: none;
  }
  
  .resize-handle:hover {
    background-color: rgb(59, 130, 246);
  }
  
  body.resizing {
    cursor: col-resize !important;
    user-select: none !important;
  }
}
```

## 📊 Estrutura da Tabela

```tsx
<table ref={tableRef} style={{ tableLayout: 'fixed' }}>
  <thead>
    <tr>
      <th 
        onClick={() => handleSort('ordem')}
        style={{ width: `${columnWidths.ordem}px` }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center">
            Ordem
            {/* Ícone de ordenação */}
          </span>
          <div 
            onMouseDown={(e) => handleMouseDownResize(e, 'ordem')}
            className="resize-handle"
          />
        </div>
      </th>
      {/* Outras colunas... */}
    </tr>
  </thead>
  <tbody>
    {ordensOrdenadas.map((ordem) => (
      <tr>
        {/* Células da tabela */}
      </tr>
    ))}
  </tbody>
</table>
```

## 🚀 Como Usar

### Para o Usuário Final

1. **Ordenar dados:**
   - Clique no título de qualquer coluna
   - Veja o ícone de seta indicando a direção
   - Clique novamente para inverter

2. **Redimensionar colunas:**
   - Posicione o mouse na borda direita do cabeçalho
   - Arraste para a esquerda ou direita
   - Solte para confirmar

3. **Combinar funcionalidades:**
   - Use filtros + ordenação + redimensionamento juntos
   - As preferências de largura são mantidas na sessão

### Para Desenvolvedores

**Adicionar nova coluna ordenável:**
```typescript
// 1. Adicionar largura inicial
const [columnWidths, setColumnWidths] = useState({
  ...existing,
  novaColuna: 150
});

// 2. Adicionar lógica de ordenação
switch (ordenacao.coluna) {
  case 'novaColuna':
    valorA = a.novaColuna || '';
    valorB = b.novaColuna || '';
    break;
}

// 3. Adicionar cabeçalho no JSX
<th 
  onClick={() => handleSort('novaColuna')}
  style={{ width: `${columnWidths.novaColuna}px` }}
>
  {/* Conteúdo do cabeçalho */}
</th>
```

## 🎯 Benefícios

1. **Usabilidade**: Interface intuitiva e responsiva
2. **Flexibilidade**: Usuário controla visualização dos dados
3. **Performance**: Ordenação rápida em memória
4. **Acessibilidade**: Indicadores visuais claros
5. **Persistência**: Larguras mantidas durante a sessão

## 🐛 Tratamento de Casos Especiais

- **Valores nulos**: Tratados como strings vazias na ordenação
- **Datas inválidas**: Convertidas para timestamp numérico
- **Valores monetários**: Convertidos para float antes da comparação
- **Largura mínima**: 80px para evitar colunas ilegíveis
- **Redimensionamento**: Previne seleção de texto durante arrasto

## 📝 Observações

- As larguras das colunas **não são persistidas** entre sessões (podem ser salvas em localStorage se necessário)
- A ordenação **não afeta as estatísticas** no topo da página
- O redimensionamento funciona em **todas as colunas exceto Ações**
- A coluna Cliente/Veículo mantém centralização mesmo após redimensionar

## 🔄 Próximas Melhorias (Opcionais)

1. Persistir larguras das colunas em localStorage
2. Adicionar botão "Resetar larguras padrão"
3. Implementar ordenação multi-coluna (Shift + Click)
4. Adicionar indicador de qual coluna está ordenada no topo
5. Opção de ocultar/mostrar colunas
6. Exportar dados ordenados para CSV/Excel

## ✅ Status

- ✅ Ordenação implementada e funcional
- ✅ Redimensionamento implementado e funcional
- ✅ Coluna Cliente/Veículo centralizada com quebra de linha
- ✅ Build compilado com sucesso
- ✅ Feedback visual implementado
- ✅ Documentação completa

---

**Data de Implementação**: 16/10/2025
**Versão**: 1.0.0
**Desenvolvido para**: Sistema AutoCare - Gestão de Oficinas
