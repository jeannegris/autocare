# Correção: Pré-seleção de Veículo na Ordem de Serviço

## 📋 Problema Identificado

Data: 15 de outubro de 2025

### Descrição do Bug
Quando o usuário cria uma nova Ordem de Serviço através da busca por placa do veículo:
1. Digita a placa do veículo (ex: KVS-7I59)
2. Sistema encontra o veículo e seu proprietário
3. Usuário clica em **"Sim, é o mesmo"**
4. **PROBLEMA**: No formulário da OS, aparece **outro veículo** do mesmo cliente em vez do veículo buscado

### Cenário de Teste
- **Cliente**: Jean Negris (possui 2 veículos)
  - Veículo 1: KIA CERATO - KVS-7I59
  - Veículo 2: FORD FIESTA - LUN-5874
  
- **Ação**: Buscar por placa **KVS-7I59**
- **Resultado Esperado**: Formulário deve abrir com **KIA CERATO - KVS-7I59** pré-selecionado
- **Resultado Anterior**: Formulário abria com **FORD FIESTA - LUN-5874** (primeiro veículo da lista)

---

## 🔍 Causa Raiz

### Fluxo Anterior (Incorreto)
```
1. Usuário busca placa → KVS-7I59
2. Sistema encontra veículo e proprietário
3. Usuário confirma: "Sim, é o mesmo"
4. Callback: onClienteEncontrado(cliente) ← ❌ SÓ PASSA O CLIENTE
5. Modal Nova OS: usa primeiro veículo da lista ← ❌ IGNORA A PLACA BUSCADA
```

### Problema no Código

**ModalBuscaClienteVeiculo.tsx** (Linha ~95):
```tsx
const handleConfirmarProprietario = () => {
  if (resultadoVeiculo?.cliente) {
    onClienteEncontrado(resultadoVeiculo.cliente);  // ❌ Não passa o veículo!
    onClose();
  }
};
```

**ModalNovaOrdem.tsx** (Linha ~80):
```tsx
setFormData(prev => ({
  ...prev,
  cliente_id: clienteParaProcessar.id,
  veiculo_id: clienteParaProcessar.veiculos[0].id  // ❌ Sempre pega o primeiro!
}));
```

---

## ✅ Solução Implementada

### Alterações Realizadas

#### 1. Interface `ModalBuscaClienteVeiculoProps`
**Arquivo**: `/var/www/autocare/frontend/src/components/ModalBuscaClienteVeiculo.tsx`

```tsx
// ANTES
onClienteEncontrado: (cliente: ClienteBuscaResponse['cliente']) => void;

// DEPOIS
onClienteEncontrado: (
  cliente: ClienteBuscaResponse['cliente'], 
  veiculoPreSelecionado?: VeiculoBuscaResponse['veiculo']
) => void;
```

**Impacto**: Agora a função pode receber o veículo que deve ser pré-selecionado.

#### 2. Função `handleConfirmarProprietario`
**Arquivo**: `/var/www/autocare/frontend/src/components/ModalBuscaClienteVeiculo.tsx`

```tsx
// ANTES
const handleConfirmarProprietario = () => {
  if (resultadoVeiculo?.cliente) {
    onClienteEncontrado(resultadoVeiculo.cliente);
    onClose();
  }
};

// DEPOIS
const handleConfirmarProprietario = () => {
  if (resultadoVeiculo?.cliente) {
    // Passar o veículo encontrado pela placa como pré-selecionado
    onClienteEncontrado(resultadoVeiculo.cliente, resultadoVeiculo.veiculo);
    onClose();
  }
};
```

**Impacto**: Agora passa o veículo correto junto com o cliente.

#### 3. Seleção de Veículo ao Buscar Cliente
**Arquivo**: `/var/www/autocare/frontend/src/components/ModalBuscaClienteVeiculo.tsx` (Linha ~350)

```tsx
// ANTES
onClick={() => {
  const clienteComVeiculo = {
    ...resultadoCliente.cliente!,
    veiculos: [veiculo]
  };
  onClienteEncontrado(clienteComVeiculo);
  onClose();
}}

// DEPOIS
onClick={() => {
  // Passar o veículo selecionado como segundo parâmetro
  onClienteEncontrado(resultadoCliente.cliente!, veiculo);
  onClose();
}}
```

**Impacto**: Quando o usuário busca por cliente e seleciona um veículo, também passa o veículo correto.

#### 4. Função `handleClienteEncontrado`
**Arquivo**: `/var/www/autocare/frontend/src/pages/OrdensServico.tsx`

```tsx
// ANTES
const handleClienteEncontrado = (cliente: ClienteBuscaResponse['cliente']) => {
  setClienteSelecionado(cliente);
  setModalOrdem(true);
};

// DEPOIS
const handleClienteEncontrado = (
  cliente: ClienteBuscaResponse['cliente'], 
  veiculoPreSelecionado?: VeiculoBuscaResponse['veiculo']
) => {
  setClienteSelecionado(cliente);
  // Se um veículo foi pré-selecionado (busca por placa), defini-lo
  if (veiculoPreSelecionado) {
    setVeiculoSelecionado(veiculoPreSelecionado);
  }
  setModalOrdem(true);
};
```

**Impacto**: Agora armazena o veículo pré-selecionado no estado.

#### 5. Interface `ModalNovaOrdemProps`
**Arquivo**: `/var/www/autocare/frontend/src/components/ModalNovaOrdem.tsx`

```tsx
// ANTES
interface ModalNovaOrdemProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteBuscaResponse['cliente'];
  onSuccess: () => void;
}

// DEPOIS
interface ModalNovaOrdemProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteBuscaResponse['cliente'];
  onSuccess: () => void;
  veiculoPreSelecionado?: any; // Veículo já selecionado (busca por placa)
}
```

**Impacto**: Modal de nova ordem agora recebe o veículo pré-selecionado.

#### 6. UseEffect no ModalNovaOrdem
**Arquivo**: `/var/www/autocare/frontend/src/components/ModalNovaOrdem.tsx` (Linha ~70)

```tsx
// ANTES
setFormData(prev => ({
  ...prev,
  cliente_id: clienteParaProcessar.id,
  veiculo_id: clienteParaProcessar.veiculos[0].id
}));

// DEPOIS
// Definir veículo: priorizar veículo pré-selecionado, senão usar o primeiro da lista
let veiculoId = null;
if (veiculoPreSelecionado && veiculoPreSelecionado.id) {
  // Usar veículo pré-selecionado (busca por placa)
  veiculoId = veiculoPreSelecionado.id;
} else if (clienteParaProcessar.veiculos && clienteParaProcessar.veiculos.length > 0) {
  // Usar primeiro veículo da lista
  veiculoId = clienteParaProcessar.veiculos[0].id;
}

setFormData(prev => ({
  ...prev,
  cliente_id: clienteParaProcessar.id,
  veiculo_id: veiculoId
}));
```

**Impacto**: Agora prioriza o veículo pré-selecionado sobre o primeiro da lista.

#### 7. Passagem do Veículo no Render
**Arquivo**: `/var/www/autocare/frontend/src/pages/OrdensServico.tsx` (Linha ~649)

```tsx
// ANTES
<ModalNovaOrdem
  isOpen={modalOrdem}
  onClose={() => {
    setModalOrdem(false);
    setClienteSelecionado(null);
  }}
  cliente={clienteSelecionado}
  onSuccess={handleOrdemCriada}
/>

// DEPOIS
<ModalNovaOrdem
  isOpen={modalOrdem}
  onClose={() => {
    setModalOrdem(false);
    setClienteSelecionado(null);
    setVeiculoSelecionado(null); // Limpar veículo selecionado
  }}
  cliente={clienteSelecionado}
  onSuccess={handleOrdemCriada}
  veiculoPreSelecionado={veiculoSelecionado}
/>
```

**Impacto**: Passa o veículo selecionado para o modal e limpa ao fechar.

---

## 🎯 Fluxo Corrigido

### Busca por Placa
```
1. Usuário busca placa → KVS-7I59
2. Sistema encontra veículo + proprietário
3. Usuário confirma: "Sim, é o mesmo"
4. Callback: onClienteEncontrado(cliente, veiculo) ← ✅ PASSA AMBOS
5. Estado: setVeiculoSelecionado(veiculo) ← ✅ ARMAZENA VEÍCULO
6. Modal Nova OS: usa veiculoPreSelecionado ← ✅ CORRETO!
```

### Busca por Cliente
```
1. Usuário busca CPF/telefone
2. Sistema encontra cliente com múltiplos veículos
3. Usuário seleciona veículo específico
4. Callback: onClienteEncontrado(cliente, veiculo) ← ✅ PASSA AMBOS
5. Estado: setVeiculoSelecionado(veiculo) ← ✅ ARMAZENA VEÍCULO
6. Modal Nova OS: usa veiculoPreSelecionado ← ✅ CORRETO!
```

---

## 📊 Arquivos Modificados

1. **`/var/www/autocare/frontend/src/components/ModalBuscaClienteVeiculo.tsx`**
   - Interface `ModalBuscaClienteVeiculoProps`
   - Função `handleConfirmarProprietario`
   - Seleção de veículo ao buscar por cliente

2. **`/var/www/autocare/frontend/src/pages/OrdensServico.tsx`**
   - Função `handleClienteEncontrado`
   - Passagem do `veiculoPreSelecionado` para `ModalNovaOrdem`
   - Limpeza do `veiculoSelecionado` ao fechar modal

3. **`/var/www/autocare/frontend/src/components/ModalNovaOrdem.tsx`**
   - Interface `ModalNovaOrdemProps`
   - Parâmetro `veiculoPreSelecionado`
   - UseEffect para priorizar veículo pré-selecionado

---

## 🧪 Como Testar

### Teste 1: Busca por Placa
1. Acesse **Ordens de Serviço**
2. Clique em **"+ Nova OS"**
3. Selecione busca por **"Placa"**
4. Digite: **KVS-7I59**
5. Clique em **Buscar** 🔍
6. Verifique: Sistema encontra **KIA CERATO**
7. Clique em **"✓ Sim, é o mesmo"**
8. **Verifique**: Combobox de veículo deve mostrar **KIA CERATO - KVS7I59** selecionado ✅

### Teste 2: Busca por Cliente com Múltiplos Veículos
1. Acesse **Ordens de Serviço**
2. Clique em **"+ Nova OS"**
3. Busque por CPF: **088.908.967-10**
4. Sistema mostra Jean Negris com 2 veículos
5. Clique no **segundo veículo** (FORD FIESTA)
6. **Verifique**: Combobox deve mostrar **FORD FIESTA - LUN5874** selecionado ✅

### Teste 3: Busca por Cliente com 1 Veículo
1. Busque um cliente com apenas 1 veículo
2. **Verifique**: Veículo único é selecionado automaticamente ✅

---

## 🎯 Benefícios

### Para o Usuário
- ✅ **Menos cliques**: Não precisa trocar o veículo manualmente
- ✅ **Menos erros**: Sistema seleciona o veículo correto automaticamente
- ✅ **Mais rápido**: Fluxo mais eficiente de criação de OS
- ✅ **Intuitivo**: Comportamento esperado funciona corretamente

### Para o Sistema
- ✅ **Consistência**: Busca por placa agora funciona como esperado
- ✅ **Confiabilidade**: Reduz risco de erro humano
- ✅ **Código limpo**: Solução elegante e bem tipada
- ✅ **Manutenível**: Fácil entender o fluxo de dados

---

## 📝 Casos de Uso Corrigidos

| Cenário | Antes | Depois |
|---------|-------|--------|
| Busca por placa (cliente com 2+ veículos) | ❌ Seleciona 1º veículo | ✅ Seleciona veículo buscado |
| Busca por cliente → seleciona veículo | ❌ Solução workaround | ✅ Solução nativa |
| Busca por placa (cliente com 1 veículo) | ✅ Funciona | ✅ Continua funcionando |
| Busca por cliente (1 veículo) | ✅ Funciona | ✅ Continua funcionando |

---

## 🔧 Detalhes Técnicos

### Tipagem TypeScript
```typescript
// Interface atualizada com segundo parâmetro opcional
onClienteEncontrado: (
  cliente: ClienteBuscaResponse['cliente'], 
  veiculoPreSelecionado?: VeiculoBuscaResponse['veiculo']
) => void;
```

### Prioridade de Seleção
```typescript
let veiculoId = null;

// 1ª prioridade: Veículo pré-selecionado pela busca
if (veiculoPreSelecionado && veiculoPreSelecionado.id) {
  veiculoId = veiculoPreSelecionado.id;
}
// 2ª prioridade: Primeiro veículo da lista
else if (clienteParaProcessar.veiculos?.length > 0) {
  veiculoId = clienteParaProcessar.veiculos[0].id;
}
```

### Estado do Veículo
```typescript
const [veiculoSelecionado, setVeiculoSelecionado] = useState<...>(null);

// Definir ao encontrar cliente
setVeiculoSelecionado(veiculoPreSelecionado);

// Limpar ao fechar modal
setVeiculoSelecionado(null);
```

---

## 🚀 Impacto

### Sem Breaking Changes
- ✅ Parâmetro `veiculoPreSelecionado` é **opcional**
- ✅ Código existente continua funcionando
- ✅ Apenas adiciona funcionalidade nova
- ✅ Backward compatible

### Casos de Uso Mantidos
- ✅ Cliente sem veículo → continua funcionando
- ✅ VENDA (sem veículo) → não afetado
- ✅ Cadastro de novo veículo → não afetado

---

## 📞 Suporte

- **Arquivos modificados**: 3 arquivos TypeScript
- **Linhas alteradas**: ~50 linhas
- **Complexidade**: Baixa
- **Risco**: Mínimo (opcional + backward compatible)

---

**Corrigido em**: 15/10/2025  
**Status**: ✅ Implementado e Testado  
**Versão**: 1.0  
**Prioridade**: Alta (bug crítico de UX)  
**Impacto**: Melhoria significativa na experiência do usuário
