# Componente Accordion

Componente de acordeão (expand/collapse) reutilizável criado para o AutoCare.

## Localização
`/var/www/autocare/frontend/src/components/ui/Accordion.tsx`

## Características

- ✅ Expansão/colapso suave com animação CSS
- ✅ Múltiplas variantes visuais (default, warning, danger, info, success)
- ✅ Suporte a badges no título
- ✅ Ícone animado de chevron
- ✅ Estado inicial configurável (aberto/fechado)
- ✅ Bordas laterais coloridas por variante
- ✅ Hover effects
- ✅ Totalmente responsivo
- ✅ TypeScript tipado

## Uso Básico

```tsx
import Accordion from '../components/ui/Accordion'

function MyComponent() {
  return (
    <Accordion title="Meu Título">
      <p>Conteúdo que será expandido/colapsado</p>
    </Accordion>
  )
}
```

## Props do Accordion

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `title` | `string \| ReactNode` | obrigatório | Título do acordeão (sempre visível) |
| `children` | `ReactNode` | obrigatório | Conteúdo a ser expandido/colapsado |
| `defaultOpen` | `boolean` | `false` | Define se inicia aberto ou fechado |
| `variant` | `'default' \| 'warning' \| 'danger' \| 'info' \| 'success'` | `'default'` | Estilo visual do acordeão |
| `badge` | `string \| number` | - | Badge opcional ao lado do título |
| `className` | `string` | `''` | Classes CSS adicionais |

## Variantes Visuais

### Default
```tsx
<Accordion title="Informações Gerais" variant="default">
  <p>Conteúdo padrão</p>
</Accordion>
```
- Fundo: Cinza claro
- Borda: Cinza
- Uso: Informações gerais

### Warning (Aviso)
```tsx
<Accordion title="Atenção" variant="warning" badge="3">
  <p>Avisos importantes</p>
</Accordion>
```
- Fundo: Amarelo claro
- Borda: Amarelo (esquerda destacada)
- Uso: Alertas, sugestões, avisos

### Danger (Perigo)
```tsx
<Accordion title="Urgente" variant="danger" badge="!">
  <p>Ações urgentes necessárias</p>
</Accordion>
```
- Fundo: Vermelho claro
- Borda: Vermelho (esquerda destacada)
- Uso: Erros, problemas críticos, ações urgentes

### Info (Informação)
```tsx
<Accordion title="Saiba Mais" variant="info">
  <p>Informações adicionais</p>
</Accordion>
```
- Fundo: Azul claro
- Borda: Azul (esquerda destacada)
- Uso: Dicas, informações complementares

### Success (Sucesso)
```tsx
<Accordion title="Concluído" variant="success">
  <p>Tudo certo!</p>
</Accordion>
```
- Fundo: Verde claro
- Borda: Verde (esquerda destacada)
- Uso: Confirmações, status de sucesso

## Exemplo com Badge

```tsx
<Accordion 
  title="Notificações" 
  badge={5}
  variant="warning"
  defaultOpen={false}
>
  <ul>
    <li>Notificação 1</li>
    <li>Notificação 2</li>
    <li>Notificação 3</li>
    <li>Notificação 4</li>
    <li>Notificação 5</li>
  </ul>
</Accordion>
```

## Exemplo com Título Customizado

```tsx
import { AlertTriangle } from 'lucide-react'

<Accordion
  title={
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-5 w-5" />
      <span>🔔 Manutenções Sugeridas</span>
    </div>
  }
  badge={3}
  variant="warning"
>
  <p>Lista de manutenções...</p>
</Accordion>
```

## AccordionGroup (Múltiplos Acordeões)

Para agrupar múltiplos acordeões com espaçamento adequado:

```tsx
import { AccordionGroup } from '../components/ui/Accordion'

<AccordionGroup>
  <Accordion title="Seção 1" variant="info">
    <p>Conteúdo 1</p>
  </Accordion>
  
  <Accordion title="Seção 2" variant="warning" badge={2}>
    <p>Conteúdo 2</p>
  </Accordion>
  
  <Accordion title="Seção 3" variant="success">
    <p>Conteúdo 3</p>
  </Accordion>
</AccordionGroup>
```

### Props do AccordionGroup

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `children` | `ReactNode` | obrigatório | Componentes Accordion |
| `className` | `string` | `''` | Classes CSS adicionais |
| `allowMultiple` | `boolean` | `true` | Permite múltiplos acordeões abertos (reservado para implementação futura) |

## Caso de Uso Real: Sugestões de Manutenção

Exemplo de uso no sistema AutoCare para exibir sugestões de manutenção:

```tsx
{sugestoes && sugestoes.sugestoes.length > 0 && (
  <Accordion
    title={
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        <span>🔔 Manutenções Sugeridas</span>
      </div>
    }
    badge={sugestoes.total_sugestoes}
    variant="warning"
    defaultOpen={false}
  >
    <div className="space-y-3">
      <p className="text-xs text-gray-700">
        KM atual: <strong>{sugestoes.km_atual.toLocaleString()} km</strong>
      </p>
      
      {sugestoes.sugestoes.map((sugestao, index) => (
        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">
            ⚠️ {sugestao.tipo}
          </p>
          <p className="text-xs text-gray-600">
            Última: {sugestao.ultima_realizacao.km.toLocaleString()} km
          </p>
          <p className="text-xs text-gray-600">
            Prevista: {sugestao.proxima_prevista.km.toLocaleString()} km
          </p>
        </div>
      ))}
    </div>
  </Accordion>
)}
```

## Animação

O acordeão usa transições CSS para animação suave:
- **Duração**: 300ms
- **Easing**: ease-in-out
- **Propriedades animadas**: 
  - `max-height` (0 → 2000px)
  - `opacity` (0 → 1)
  - `transform` do ícone (rotação 0° → 180°)

## Acessibilidade

- ✅ Botão clicável com área grande
- ✅ Estados de hover visuais
- ✅ Indicador visual de estado (chevron)
- ✅ Cores com contraste adequado
- ⚠️ TODO: Adicionar atributos ARIA para leitores de tela

## Melhorias Futuras

1. **Controle de múltiplos acordeões**: Implementar `allowMultiple={false}` no AccordionGroup para fechar outros ao abrir um
2. **Keyboard navigation**: Suporte a navegação por teclado (Tab, Enter, Space)
3. **ARIA attributes**: `aria-expanded`, `aria-controls`, `aria-labelledby`
4. **Callbacks**: `onOpen`, `onClose` para tracking/analytics
5. **Velocidade customizável**: Prop `animationDuration`
6. **Ícone customizável**: Permitir trocar o chevron por outro ícone
7. **Variante compacta**: Versão menor para espaços reduzidos

## Dependências

- `react` - Hooks (useState)
- `lucide-react` - Ícone ChevronDown
- Tailwind CSS - Estilos utilitários

## Compatibilidade

- ✅ React 18+
- ✅ TypeScript 4+
- ✅ Navegadores modernos (Chrome, Firefox, Safari, Edge)
- ✅ Mobile responsivo

---

**Criado em**: 15/10/2025  
**Autor**: AutoCare Development Team  
**Versão**: 1.0
