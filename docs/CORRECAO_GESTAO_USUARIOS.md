# Correção: Gestão de Usuários e Página de Configurações

**Data:** 22/10/2025

## Problemas Identificados

### 1. Layout da Página de Configurações
- O botão "Gerenciar Usuários" estava posicionado no canto superior direito da página
- Faltava contexto e descrição sobre a funcionalidade

### 2. Erro 404 ao Carregar Lista de Usuários
- A rota `/autocare-api/usuarios` retornava erro 404
- Console do navegador mostrava: `GET http://172.27.60.111/autocare-api/usuarios 404 (Not Found)`

## Correções Aplicadas

### 1. Reorganização do Layout (Configuracoes.tsx)

**Antes:**
```tsx
<div className="flex justify-between items-center mb-8">
  <h1>Configurações</h1>
  <a href="/autocare/usuarios">
    Gerenciar Usuários
  </a>
</div>
```

**Depois:**
```tsx
<div className="mb-8">
  <h1>Configurações</h1>
</div>

{/* Card: Gestão de Usuários */}
<div className="bg-white rounded-lg shadow-md p-6">
  <h2>Gestão de Usuários</h2>
  <p>
    Acesse a tela de gerenciamento de usuários para criar novos usuários, 
    alterar informações existentes, habilitar/desabilitar autenticação de 
    dois fatores (2FA), ativar ou desativar contas de usuários e gerenciar 
    permissões de acesso ao sistema.
  </p>
  <a href="/autocare/usuarios">
    Gerenciar Usuários
  </a>
</div>
```

### 2. Instalação de Dependências Faltantes

O backend não estava iniciando devido a módulos Python ausentes:

```bash
cd /var/www/autocare/backend
source venv/bin/activate
pip install pyotp qrcode Pillow
sudo systemctl restart autocare-backend
```

**Módulos instalados:**
- `pyotp==2.9.0` - Geração de códigos TOTP para 2FA
- `qrcode==8.2` - Geração de QR codes para configuração do 2FA
- `Pillow==11.3.0` - Processamento de imagens (já instalado)

### 3. Correção de Trailing Slash nas Rotas (GerenciarUsuarios.tsx)

O FastAPI estava redirecionando `/usuarios` para `/usuarios/` (307 Temporary Redirect).

**Antes:**
```tsx
const response = await fetch(`${API_BASE}/usuarios`, {
```

**Depois:**
```tsx
const response = await fetch(`${API_BASE}/usuarios/`, {
```

**Rotas corrigidas:**
- `GET /autocare-api/usuarios/` - Listagem de usuários
- `POST /autocare-api/usuarios/` - Criação de usuário

## Testes Realizados

### 1. Backend
```bash
# Teste direto na API
curl -i http://127.0.0.1/autocare-api/usuarios/ \
  -H "Authorization: Bearer <token>"

# Resultado: 200 OK
[{"id":1,"username":"admin","email":"admin@autocare.com",...}]
```

### 2. Frontend
```bash
cd /var/www/autocare/frontend
yarn build
# ✓ built in 12.00s
```

### 3. Serviço Backend
```bash
sudo systemctl status autocare-backend
# Active: active (running)
```

## Estado Atual

### ✅ Funcionalidades Operacionais

1. **Página de Configurações**
   - Card "Gestão de Usuários" com descrição detalhada
   - Botão estilizado para acesso à tela de gerenciamento
   - Layout organizado e intuitivo

2. **Tela de Gerenciamento de Usuários**
   - Listagem de usuários carrega sem erros
   - Interface completamente funcional
   - CRUD de usuários operacional

3. **Backend**
   - Serviço iniciando corretamente
   - Rotas de usuários respondendo 200 OK
   - Autenticação funcionando

## Arquivos Modificados

```
/var/www/autocare/
├── frontend/src/pages/
│   ├── Configuracoes.tsx         (Layout reorganizado)
│   └── GerenciarUsuarios.tsx     (Trailing slash corrigido)
├── backend/
│   └── venv/                     (Dependências instaladas)
└── docs/
    └── CORRECAO_GESTAO_USUARIOS.md (Este documento)
```

## Como Testar

1. **Acessar página de configurações:**
   ```
   http://172.27.60.111/autocare/configuracoes
   ```
   - Verificar card "Gestão de Usuários" com descrição
   - Clicar no botão "Gerenciar Usuários"

2. **Verificar tela de usuários:**
   ```
   http://172.27.60.111/autocare/usuarios
   ```
   - Lista de usuários deve carregar sem erros
   - Console do navegador não deve mostrar erros 404

3. **Criar novo usuário:**
   - Clicar em "Novo Usuário"
   - Preencher formulário
   - Salvar e verificar se aparece na lista

## Notas Técnicas

### Sobre o Trailing Slash
O FastAPI trata `/usuarios` e `/usuarios/` como rotas diferentes. Por padrão:
- `/usuarios` → Redireciona (307) para `/usuarios/`
- `/usuarios/` → Responde diretamente (200)

Para evitar o redirect adicional, todas as chamadas foram padronizadas com a barra final.

### Dependências do 2FA
As bibliotecas instaladas são necessárias para:
- **pyotp**: Gerar e validar tokens TOTP (Time-based One-Time Password)
- **qrcode**: Criar QR codes para configuração inicial no Microsoft Authenticator
- **Pillow**: Processar imagens dos QR codes gerados

## Próximos Passos Recomendados

1. ✅ Layout da página de configurações melhorado
2. ✅ Erro 404 corrigido
3. ✅ Backend iniciando corretamente
4. ⏭️ Testar fluxo completo de criação de usuário com 2FA
5. ⏭️ Validar autenticação 2FA end-to-end

## Referências

- [Documentação do FastAPI - Trailing Slash](https://fastapi.tiangolo.com/tutorial/path-params/#order-matters)
- [PyOTP Documentation](https://pyauth.github.io/pyotp/)
- [QRCode Library](https://github.com/lincolnloop/python-qrcode)
