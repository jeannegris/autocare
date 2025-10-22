# Correção: Validação de Desconto no onBlur

## 📋 Problema Identificado

A validação de desconto acima do limite estava sendo acionada a cada dígito digitado no campo "Desconto (%)", causando:

- Modal de confirmação aparecendo prematuramente
- Interrupção da digitação do usuário
- Má experiência de usuário

**Exemplo do problema:**
- Desconto máximo configurado: 15%
- Usuário quer digitar: 20%
- Ao digitar "2", já aparecia o modal (pois 2 < 15, mas ao tentar digitar "0" depois, já havia sido bloqueado)
- Ou ao digitar "1" primeiro, quando digitasse "6" para fazer 16%, o modal já aparecia

## ✅ Solução Implementada

A validação agora acontece apenas quando o usuário **sai do campo** (evento `onBlur`), garantindo que ele termine de digitar todo o valor do desconto antes da validação.

### Mudanças no Código

#### 1. Remoção da Validação no `handleInputChange`

**Antes:**
```tsx
const handleInputChange = async (field: keyof OrdemServicoNova, value: any) => {
  // Validação especial para desconto
  if (field === 'percentual_desconto' && value) {
    const descontoNovo = Number(value);
    if (descontoNovo > descontoMaximoConfig) {
      setMostrarModalDescontoAlto(true);
      return; // Não atualiza ainda - BLOQUEIA DIGITAÇÃO!
    }
  }

  setFormData(prev => ({ ...prev, [field]: value }));
};
```

**Depois:**
```tsx
const handleInputChange = async (field: keyof OrdemServicoNova, value: any) => {
  setFormData(prev => ({ ...prev, [field]: value }));
};
```

#### 2. Nova Função `handleDescontoBlur`

```tsx
// Validar desconto quando o usuário sair do campo (onBlur)
const handleDescontoBlur = () => {
  const descontoNovo = Number(formData.percentual_desconto);
  
  if (descontoNovo > descontoMaximoConfig) {
    // Armazenar o desconto informado
    setDescontoInformado(descontoNovo);
    // Desconto acima do limite - mostrar modal de senha
    setMostrarModalDescontoAlto(true);
    // Reverter o valor para o máximo permitido
    setFormData(prev => ({ ...prev, percentual_desconto: descontoMaximoConfig }));
  }
};
```

**Características:**
- ✅ Valida apenas quando usuário sai do campo
- ✅ Armazena valor informado em estado separado (`descontoInformado`)
- ✅ Reverte campo para o máximo permitido enquanto aguarda confirmação
- ✅ Exibe modal de confirmação

#### 3. Estado Adicional para Armazenar Desconto Informado

```tsx
const [descontoInformado, setDescontoInformado] = useState(0);
```

**Por quê?** 
- Ao reverter o campo para o máximo permitido (15%), perdemos o valor que o usuário digitou (ex: 20%)
- Precisamos armazenar o valor original para:
  - Exibir no modal ("O desconto informado (20%) é maior...")
  - Aplicar após senha validada

#### 4. Atualização da Função `confirmarDescontoAlto`

**Antes:**
```tsx
// Senha válida - permitir desconto
setMostrarModalDescontoAlto(false);
setSenhaDesconto('');
toast.success('Desconto autorizado pelo supervisor');
// ❌ Não aplicava o desconto informado!
```

**Depois:**
```tsx
// Senha válida - aplicar o desconto informado
setFormData(prev => ({ ...prev, percentual_desconto: descontoInformado }));
setMostrarModalDescontoAlto(false);
setSenhaDesconto('');
setDescontoInformado(0);
toast.success('Desconto autorizado pelo supervisor');
// ✅ Aplica o desconto que o usuário digitou (20%)
```

#### 5. Atualização do Input de Desconto

**Antes:**
```tsx
<input
  type="number"
  value={formData.percentual_desconto || ''}
  onChange={(e) => handleInputChange('percentual_desconto', Number(e.target.value))}
  onBlur={(e) => {
    const valor = parseFloat(e.target.value) || 0;
    handleInputChange('percentual_desconto', parseFloat(valor.toFixed(2)));
    // ❌ Não validava
  }}
/>
```

**Depois:**
```tsx
<input
  type="number"
  value={formData.percentual_desconto || ''}
  onChange={(e) => handleInputChange('percentual_desconto', Number(e.target.value))}
  onBlur={(e) => {
    const valor = parseFloat(e.target.value) || 0;
    handleInputChange('percentual_desconto', parseFloat(valor.toFixed(2)));
    // ✅ Validar desconto após formatar
    handleDescontoBlur();
  }}
/>
```

#### 6. Atualização do Modal

**Antes:**
```tsx
<p className="text-sm text-gray-700 mb-2">
  O desconto informado (<strong>{formData.percentual_desconto}%</strong>) é maior...
  {/* ❌ Exibe o valor revertido (15%), não o informado (20%) */}
</p>
```

**Depois:**
```tsx
<p className="text-sm text-gray-700 mb-2">
  O desconto informado (<strong>{descontoInformado}%</strong>) é maior...
  {/* ✅ Exibe o valor que o usuário digitou (20%) */}
</p>
```

## 🎯 Comportamento Atual

### Fluxo Normal (Desconto Dentro do Limite)

1. Desconto máximo configurado: 15%
2. Usuário digita no campo: `10`
3. Usuário sai do campo (clica fora ou Tab)
4. Sistema valida: 10% ≤ 15% ✅
5. Valor aceito, sem modal

### Fluxo com Desconto Acima do Limite

1. Desconto máximo configurado: 15%
2. Usuário digita no campo: `20`
3. Usuário sai do campo (clica fora ou Tab)
4. Sistema valida: 20% > 15% ⚠️
5. **Modal aparece** solicitando senha do supervisor
6. Campo reverte temporariamente para: 15%
7. Modal exibe: "O desconto informado (20%) é maior que o permitido (15%)"
8. Duas opções:
   - **Cancelar:** Campo permanece com 15%
   - **Confirmar (com senha):** Campo atualiza para 20%

## 📊 Eventos JavaScript Utilizados

### `onChange`
- **Quando dispara:** A cada tecla digitada
- **Uso:** Atualizar o estado `formData.percentual_desconto` em tempo real
- **Validação:** Não realiza validação de desconto

### `onBlur`
- **Quando dispara:** Quando o campo perde o foco
- **Casos de disparo:**
  - Usuário clica fora do campo
  - Usuário pressiona Tab
  - Usuário pressiona Enter (em alguns casos)
- **Uso:** 
  1. Formatar valor (2 casas decimais)
  2. Validar desconto completo digitado

## 🧪 Testes

### Caso de Teste 1: Desconto Dentro do Limite
```
Desconto Máximo: 15%
Ação: Digite 10 e saia do campo
Resultado: ✅ Aceito sem modal
```

### Caso de Teste 2: Desconto Acima do Limite
```
Desconto Máximo: 15%
Ação: Digite 20 e saia do campo
Resultado: ⚠️ Modal de confirmação aparece
```

### Caso de Teste 3: Digitação Incompleta
```
Desconto Máximo: 15%
Ação: Digite "2" e continue digitando "0" (sem sair do campo)
Resultado: ✅ Nenhum modal aparece durante a digitação
```

### Caso de Teste 4: Desconto Igual ao Limite
```
Desconto Máximo: 15%
Ação: Digite 15.00 e saia do campo
Resultado: ✅ Aceito sem modal (15 não é maior que 15)
```

### Caso de Teste 5: Confirmação com Senha
```
Desconto Máximo: 15%
Ação: 
  1. Digite 20 e saia do campo
  2. Modal aparece
  3. Digite senha: admin123
  4. Confirme
Resultado: ✅ Desconto 20% aplicado, toast de sucesso
```

### Caso de Teste 6: Cancelamento
```
Desconto Máximo: 15%
Ação:
  1. Digite 20 e saia do campo
  2. Modal aparece
  3. Clique em "Cancelar"
Resultado: ✅ Campo permanece com 15%, modal fecha
```

## 📝 Fluxo de Estados

### Estado Inicial
```typescript
percentual_desconto: 0
descontoInformado: 0
mostrarModalDescontoAlto: false
```

### Usuário Digita 20%
```typescript
percentual_desconto: 20  // onChange atualiza em tempo real
descontoInformado: 0
mostrarModalDescontoAlto: false
```

### Usuário Sai do Campo (onBlur)
```typescript
// handleDescontoBlur() é chamado
percentual_desconto: 15  // Revertido para o máximo
descontoInformado: 20    // Armazena valor original
mostrarModalDescontoAlto: true  // Exibe modal
```

### Usuário Confirma com Senha
```typescript
// confirmarDescontoAlto() é chamado
percentual_desconto: 20  // Aplica o descontoInformado
descontoInformado: 0     // Limpa
mostrarModalDescontoAlto: false  // Fecha modal
```

## 🔧 Código Completo das Funções

### handleDescontoBlur
```typescript
const handleDescontoBlur = () => {
  const descontoNovo = Number(formData.percentual_desconto);
  
  if (descontoNovo > descontoMaximoConfig) {
    setDescontoInformado(descontoNovo);
    setMostrarModalDescontoAlto(true);
    setFormData(prev => ({ ...prev, percentual_desconto: descontoMaximoConfig }));
  }
};
```

### confirmarDescontoAlto
```typescript
const confirmarDescontoAlto = async () => {
  if (!senhaDesconto) {
    toast.error('Digite a senha do supervisor');
    return;
  }

  try {
    const response = await apiFetch('/configuracoes/validar-senha', {
      method: 'POST',
      body: JSON.stringify({ senha: senhaDesconto })
    });

    if (!response.valida) {
      toast.error('Senha do supervisor inválida');
      return;
    }

    setFormData(prev => ({ ...prev, percentual_desconto: descontoInformado }));
    setMostrarModalDescontoAlto(false);
    setSenhaDesconto('');
    setDescontoInformado(0);
    toast.success('Desconto autorizado pelo supervisor');
  } catch (error: any) {
    toast.error(error.message || 'Erro ao validar senha');
  }
};
```

## 🚀 Deploy

**Arquivos Modificados:**
- `/frontend/src/components/ModalNovaOrdem.tsx`

**Mudanças:**
- Removida validação do `handleInputChange`
- Adicionada função `handleDescontoBlur`
- Adicionado estado `descontoInformado`
- Atualizada função `confirmarDescontoAlto`
- Atualizado evento `onBlur` do input
- Atualizado texto do modal

**Compilação:**
```bash
cd /var/www/autocare/frontend && yarn build
```

**Status:** ✅ Compilado com sucesso (0 erros)

**Build Output:**
- `dist/assets/index-a1c3721c.js` - 312.67 kB

---

**Data:** 15/10/2025  
**Versão:** 1.3  
**Status:** ✅ Produção
