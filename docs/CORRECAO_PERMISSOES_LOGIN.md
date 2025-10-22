# Correção - Permissões não carregadas no Login

## 🐛 Problema Identificado

Após a implementação do sistema de perfis, os usuários não conseguiam visualizar nenhum menu na aplicação, mesmo após fazer login.

## 🔍 Causa Raiz

Os endpoints de login (`/api/auth/login` e `/api/auth/verify-2fa`) não estavam retornando as informações de perfil e permissões do usuário junto com o token de acesso.

O objeto `user` retornado no login continha apenas:
- id, username, email, nome, ativo, usar_2fa

Mas **faltava**:
- perfil_id
- perfil_nome  
- permissoes

## ✅ Solução Aplicada

Atualizados os endpoints em `/var/www/autocare/backend/routes/autocare_auth.py`:

### 1. Endpoint `/api/auth/login`
Adicionado ao objeto `user` retornado:
```python
"perfil_id": user.perfil_id,
"perfil_nome": user.perfil.nome if user.perfil else None,
"permissoes": json.loads(user.perfil.permissoes) if user.perfil and user.perfil.permissoes else None
```

### 2. Endpoint `/api/auth/verify-2fa`
Adicionado as mesmas informações ao objeto `user` retornado após verificação 2FA.

## 🔄 Como Aplicar a Correção

1. ✅ Backend foi atualizado e reiniciado via systemd
2. ⚠️ **IMPORTANTE**: Usuários que já estão logados precisam fazer **LOGOUT e LOGIN novamente**
3. No novo login, as permissões serão carregadas corretamente
4. O menu será exibido conforme as permissões do perfil do usuário

## 🧪 Como Testar

1. Faça logout da aplicação
2. Faça login novamente com qualquer usuário
3. Verifique se o menu lateral aparece
4. Apenas os menus permitidos para o perfil do usuário devem aparecer

### Exemplos de Testes:

**Usuário com perfil Administrador:**
- Deve ver TODOS os menus (Dashboard, Clientes, Veículos, Estoque, Ordens de Serviço, Fornecedores, Relatórios, Usuários, Perfis, Configurações)

**Usuário com perfil Supervisor:**
- Deve ver: Dashboard, Clientes, Veículos, Estoque, Ordens de Serviço, Fornecedores, Relatórios
- NÃO deve ver: Usuários, Perfis, Configurações

**Usuário com perfil Operador:**
- Deve ver: Dashboard, Estoque, Ordens de Serviço
- NÃO deve ver os demais menus

## 📝 Verificação no Console do Navegador

Após fazer login, você pode verificar as permissões carregadas abrindo o Console do navegador (F12) e digitando:

```javascript
JSON.parse(localStorage.getItem('user'))
```

Isso deve mostrar um objeto com:
- `perfil_id`: número do perfil
- `perfil_nome`: nome do perfil (ex: "Administrador")
- `permissoes`: objeto com todas as permissões (true/false)

## ✅ Status

- [x] Correção aplicada no backend
- [x] Backend reiniciado
- [ ] Usuários precisam fazer logout/login novamente

---
**Data da Correção:** 22 de Outubro de 2025 - 16:10
**Arquivo Modificado:** `/var/www/autocare/backend/routes/autocare_auth.py`
