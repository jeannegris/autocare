# Correção: Validação de KM no onBlur

## 📋 Problema Identificado

A validação de KM inferior estava sendo acionada a cada dígito digitado no campo "KM Atual do Veículo", o que causava:

- Modal de confirmação aparecendo prematuramente
- Interrupção da digitação do usuário
- Má experiência de usuário

**Exemplo do problema:**
- KM atual do veículo: 190.100
- Usuário quer digitar: 185.000
- Ao digitar "1", já aparecia o modal (pois 1 < 190.100)

## ✅ Solução Implementada

A validação agora acontece apenas quando o usuário **sai do campo** (evento `onBlur`), garantindo que ele termine de digitar todo o valor da kilometragem antes da validação.

### Mudanças no Código

#### 1. Remoção da Validação no `handleInputChange`

**Antes:**
```tsx
const handleInputChange = async (field: keyof OrdemServicoNova, value: any) => {
  // Validação especial para KM do veículo
  if (field === 'km_veiculo' && value) {
    const kmNovo = Number(value);
    const veiculoAtual = clienteParaUsar?.veiculos.find(v => v.id === formData.veiculo_id);
    
    if (veiculoAtual && kmNovo < veiculoAtual.km_atual) {
      setKmInformado(kmNovo);
      setMostrarModalKmMenor(true);
      return; // Não atualiza ainda
    }
  }
  // ... resto do código
}
```

**Depois:**
```tsx
const handleInputChange = async (field: keyof OrdemServicoNova, value: any) => {
  // Validação de desconto permanece
  if (field === 'percentual_desconto' && value) {
    const descontoNovo = Number(value);
    if (descontoNovo > descontoMaximoConfig) {
      setMostrarModalDescontoAlto(true);
      return;
    }
  }

  setFormData(prev => ({ ...prev, [field]: value }));
};
```

#### 2. Nova Função `handleKmBlur`

```tsx
// Validar KM quando o usuário sair do campo (onBlur)
const handleKmBlur = () => {
  const kmNovo = Number(formData.km_veiculo);
  const veiculoAtual = clienteParaUsar?.veiculos.find(v => v.id === formData.veiculo_id);
  
  if (veiculoAtual && kmNovo > 0 && kmNovo < veiculoAtual.km_atual) {
    // KM menor - mostrar modal de confirmação
    setKmInformado(kmNovo);
    setMostrarModalKmMenor(true);
    // Reverter o valor no campo para o KM atual do veículo
    setFormData(prev => ({ ...prev, km_veiculo: veiculoAtual.km_atual }));
  }
};
```

**Características:**
- ✅ Valida apenas quando `kmNovo > 0` (campo não vazio)
- ✅ Compara com KM atual do veículo
- ✅ Exibe modal de confirmação se KM menor
- ✅ Reverte campo para KM atual enquanto aguarda confirmação

#### 3. Adição do Evento `onBlur` no Input

**Antes:**
```tsx
<input
  type="number"
  value={formData.km_veiculo || ''}
  onChange={(e) => handleInputChange('km_veiculo', Number(e.target.value))}
  placeholder={veiculoSelecionado ? `Atual: ${veiculoSelecionado.km_atual}` : ''}
  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
  required={mostrarServicos}
/>
```

**Depois:**
```tsx
<input
  type="number"
  value={formData.km_veiculo || ''}
  onChange={(e) => handleInputChange('km_veiculo', Number(e.target.value))}
  onBlur={handleKmBlur}  // ← NOVO
  placeholder={veiculoSelecionado ? `Atual: ${veiculoSelecionado.km_atual}` : ''}
  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
  required={mostrarServicos}
/>
```

## 🎯 Comportamento Atual

### Fluxo Normal (KM Maior ou Igual)

1. Usuário seleciona veículo (KM atual: 190.100)
2. Usuário digita no campo KM: `195000`
3. Usuário sai do campo (clica fora ou pressiona Tab)
4. Sistema valida: 195.000 > 190.100 ✅
5. Valor aceito, sem modal

### Fluxo com KM Menor

1. Usuário seleciona veículo (KM atual: 190.100)
2. Usuário digita no campo KM: `185000`
3. Usuário sai do campo (clica fora ou pressiona Tab)
4. Sistema valida: 185.000 < 190.100 ⚠️
5. **Modal aparece** solicitando senha do supervisor
6. Campo reverte temporariamente para: 190.100
7. Duas opções:
   - **Cancelar:** Campo permanece com 190.100
   - **Confirmar (com senha):** Campo atualiza para 185.000

## 📊 Eventos JavaScript Utilizados

### `onChange`
- **Quando dispara:** A cada tecla digitada
- **Uso:** Atualizar o estado `formData.km_veiculo` em tempo real
- **Validação:** Não realiza validação de KM

### `onBlur`
- **Quando dispara:** Quando o campo perde o foco
- **Casos de disparo:**
  - Usuário clica fora do campo
  - Usuário pressiona Tab
  - Usuário pressiona Enter (em alguns casos)
- **Uso:** Validar o KM completo digitado

## 🧪 Testes

### Caso de Teste 1: KM Maior
```
KM Atual: 190.100
Ação: Digite 195000 e saia do campo
Resultado: ✅ Aceito sem modal
```

### Caso de Teste 2: KM Menor
```
KM Atual: 190.100
Ação: Digite 185000 e saia do campo
Resultado: ⚠️ Modal de confirmação aparece
```

### Caso de Teste 3: Digitação Incompleta
```
KM Atual: 190.100
Ação: Digite "1" e continue digitando "85000" (sem sair do campo)
Resultado: ✅ Nenhum modal aparece durante a digitação
```

### Caso de Teste 4: Campo Vazio
```
KM Atual: 190.100
Ação: Deixe o campo vazio e saia
Resultado: ✅ Nenhum modal (validação ignora valor 0)
```

## 📝 Notas Técnicas

### Por que `onBlur` e não `onKeyDown` (Enter)?

- `onBlur` captura **qualquer forma** de sair do campo
- Usuário pode clicar fora ao invés de pressionar Enter
- Melhor UX em formulários longos

### Reversão Temporária do Valor

Quando o modal aparece, o campo reverte para o KM atual para:
- Evitar confusão visual (mostrar valor "inválido")
- Dar contexto claro ao usuário
- Facilitar cancelamento (já está no valor correto)

### Validação `kmNovo > 0`

Ignora validação quando:
- Campo está vazio
- Usuário ainda não digitou nada
- Evita modal desnecessário ao limpar o campo

## 🚀 Deploy

**Arquivos Modificados:**
- `/frontend/src/components/ModalNovaOrdem.tsx`

**Compilação:**
```bash
cd /var/www/autocare/frontend && yarn build
```

**Status:** ✅ Compilado com sucesso (0 erros)

**Build Output:**
- `dist/assets/index-c233b74c.js` - 312.38 kB

---

**Data:** 15/10/2025  
**Versão:** 1.1  
**Status:** ✅ Produção
