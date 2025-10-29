# 🔐 Guia Completo de Autenticação, 2FA e RBAC (Perfis e Permissões)

Este documento consolida, em um único lugar, toda a codificação e configuração do sistema de autenticação de usuários (com 2FA), gestão de usuários, perfis e permissionamento por menus do AutoCare — cobrindo Backend, Frontend e Banco de Dados — para que você replique o mesmo esquema em outro ambiente.


## Visão geral

- Autenticação com JWT e senhas com hash bcrypt
- 2FA opcional por usuário via TOTP (Microsoft Authenticator)
- Gestão de usuários: criar, editar (inclui troca de senha), ativar/desativar, excluir, habilitar/desabilitar 2FA
- RBAC por Perfil, com permissões mapeadas 1:1 aos itens de menu do frontend
- Seeds automáticos de Perfis padrão no startup do backend
- Filtragem de menu no frontend conforme permissões do perfil do usuário logado


## Arquitetura e componentes

Backend (FastAPI + SQLAlchemy):
- Modelos: `Usuario`, `Perfil` em `backend/models/autocare_models.py`
- Rotas:
  - Autenticação: `backend/routes/autocare_auth.py`
  - Usuários (CRUD + status + 2FA): `backend/routes/autocare_usuarios.py`
  - Perfis (CRUD + validações): `backend/routes/autocare_perfis.py`
- Config: JWT e CORS em `backend/config.py`
- App/Bootstrap: registro de rotas, CORS, seed de perfis em `backend/server.py`
- DB/ORM: `backend/db.py` (PostgreSQL) — `create_tables()` cria as tabelas a partir dos modelos

Frontend (React + Vite + Tailwind):
- Contexto de Autenticação: `frontend/src/contexts/AuthContext.tsx`
- Proteção de rotas: `frontend/src/components/ProtectedRoute.tsx`
- Layout e Menu com filtro por permissão: `frontend/src/components/Layout.tsx`
- Páginas:
  - Login: `frontend/src/pages/Login.tsx`
  - 2FA: `frontend/src/pages/TwoFactorAuth.tsx`
  - Gerenciar Usuários: `frontend/src/pages/GerenciarUsuarios.tsx`
  - Gerenciar Perfis: `frontend/src/pages/GerenciarPerfis.tsx`
- Roteamento: `frontend/src/App.tsx` (basename "/autocare")
- Config de API (auto-resolve /api x /autocare-api): `frontend/src/lib/config.ts`

Banco de dados (PostgreSQL):
- Tabelas: `usuarios`, `perfis`
- Relacionamento: `usuarios.perfil_id -> perfis.id`
- Valores de permissões armazenados como JSON (string) em `perfis.permissoes`


## Banco de dados

### Tabela perfis

Campos principais (ver modelo em `models/autocare_models.py`):
- id: integer, PK
- nome: string(100), único, obrigatório
- descricao: text
- permissoes: text — JSON string com as chaves abaixo
- ativo: boolean (default true)
- editavel: boolean (default true; Administrador é false)
- created_at, updated_at: timestamps

Estrutura SQL equivalente:

```sql
CREATE TABLE perfis (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) UNIQUE NOT NULL,
  descricao TEXT,
  permissoes TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  editavel BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);
```

Chaves de permissão suportadas (mapeiam para itens de menu):
- dashboard_gerencial
- dashboard_operacional
- clientes
- veiculos
- estoque
- ordens_servico
- fornecedores
- relatorios
- configuracoes
- usuarios
- perfis

Regra de negócio: somente o perfil "Administrador" pode ter ambos dashboard_gerencial e dashboard_operacional = true.

### Tabela usuarios

Campos principais:
- id: integer, PK
- username: string(100), único
- email: string(255), único
- senha_hash: string(255) — bcrypt (via Passlib)
- nome: string(255)
- ativo: boolean
- usar_2fa: boolean
- secret_2fa: string(32) nullable — secret do TOTP (setado no setup do 2FA)
- perfil_id: int NOT NULL (FK para perfis.id; default 3 — Operador)
- created_at, updated_at: timestamps

Estrutura SQL equivalente:

```sql
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  usar_2fa BOOLEAN DEFAULT FALSE,
  secret_2fa VARCHAR(32),
  perfil_id INTEGER NOT NULL DEFAULT 3 REFERENCES perfis(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);
```

### Seed automático de Perfis

No startup do backend (`server.py`, função `lifespan`):
- Se a tabela `perfis` estiver vazia, cria 3 perfis padrão com permissões em JSON:
  - Administrador (id=1, acesso total, editavel=false)
  - Supervisor (id=2, acesso intermediário)
  - Operador (id=3, acesso básico)
- Garante que usuários sem perfil recebam perfil_id=3
- Garante que o usuário `admin` (se existir) esteja vinculado ao perfil Administrador


## Backend — Autenticação e 2FA

### Configurações
- Chave JWT e Expiração: `backend/config.py`
  - SECRET_KEY (env), ALGORITHM=HS256, ACCESS_TOKEN_EXPIRE_MINUTES=30
- Hash de senha: Passlib (bcrypt)
- 2FA: pyotp (TOTP) + qrcode + Pillow

Dependências principais (trecho do `backend/requirements.txt`):
- fastapi, uvicorn, sqlalchemy, psycopg2-binary, alembic
- python-jose[cryptography] (JWT)
- passlib[bcrypt] (hash de senha)
- pyotp, qrcode, Pillow (2FA)

### Contratos (resumo)
- Entrada login: { username, password }
- Saída login:
  - requires_2fa=false: { access_token, token_type, user }
  - requires_2fa=true: { access_token (temporário, escopo pre_2fa), token_type, requires_2fa=true, user=null }
- Setup 2FA (autenticado com token temporário ou válido): { secret, qr_code (dataURL), provisioning_uri }
- Verify 2FA: { username, token } → { access_token, token_type, user }
- Me: Bearer token → dados do usuário + permissoes do perfil

### Endpoints

Arquivo: `backend/routes/autocare_auth.py`

- POST /api/auth/login
  - Verifica credenciais; se usar_2fa=true, retorna requires_2fa=true + token temporário (escopo "pre_2fa", 10min)
  - Caso contrário, retorna access_token válido + user (inclui perfil e permissoes)

- POST /api/auth/setup-2fa
  - Requer Bearer token
  - Se usar_2fa=true e ainda não houver secret, gera secret e QR Code (dataURL) para configurar no Microsoft Authenticator

- POST /api/auth/verify-2fa
  - Body: { username, token }
  - Valida TOTP contra `secret_2fa`
  - Em caso de usuário com usar_2fa=true e secret ausente, retorna 400 (header X-Requires-Setup: true)
  - Sucesso: retorna access_token + user

- GET /api/auth/me
  - Retorna dados do usuário atual, incluindo `permissoes` do perfil como objeto (dict)

- POST /api/auth/refresh
  - Gera novo access_token

- POST /api/auth/logout
  - Resposta informativa (sem blacklist de tokens neste projeto)

### Usuários (CRUD e 2FA)

Arquivo: `backend/routes/autocare_usuarios.py`

- GET /api/usuarios/
- GET /api/usuarios/{id}
- POST /api/usuarios/
  - Campos esperados: username, email, nome, password, ativo, usar_2fa, perfil_id
- PUT /api/usuarios/{id}
  - Permite troca de senha incluindo `password` no payload (mín. 6 chars)
  - Se usar_2fa for alterado para false, zera `secret_2fa`
- DELETE /api/usuarios/{id}
  - Regra: não pode deletar a si mesmo
- PATCH /api/usuarios/{id}/toggle-2fa
  - Alterna `usar_2fa` e zera secret quando desabilitar
- PATCH /api/usuarios/{id}/ativar | /desativar
  - Regra: não pode desativar a si mesmo

### Perfis (CRUD e validações)

Arquivo: `backend/routes/autocare_perfis.py`

- GET /api/perfis/
- GET /api/perfis/{id}
- POST /api/perfis/
  - payload inclui `permissoes` (objeto com as chaves listadas em Banco de dados)
  - Perfis criados manualmente têm `editavel=true`
- PUT /api/perfis/{id}
  - Não permite editar perfis com `editavel=false` (Administrador)
  - Validação: não permitir ambos dashboards em perfis que não sejam Administrador
- DELETE /api/perfis/{id}
  - Não permite deletar perfis não editáveis
  - Não permite deletar perfis em uso por usuários


## Frontend — Fluxos, Menu e Permissões

### Login e 2FA

- Login (`Login.tsx`) chama `AuthContext.login(username, password)`
  - Se `requires_2fa=true`, redireciona para `/2fa` com o username
- 2FA (`TwoFactorAuth.tsx`)
  - Se for primeira configuração, chama `/auth/setup-2fa` (usa token temporário do login) e exibe QR Code e secret
  - Envia o código digitado para `/auth/verify-2fa` e, em sucesso, navega para `/dashboard`

### Contexto de Autenticação (`AuthContext.tsx`)

- Armazena `token` e `user` no localStorage
- Valida token em `/auth/me` na inicialização
- Funções:
  - `login`, `verify2FA`, `logout`, `refreshToken`
  - `hasPermission(permissao: string)`: usa `user.permissoes` (quando enviado pelo backend)
    - Fallbacks: se perfil Administrador (id=1/nome) ou username `admin`, concede todas as permissões

### Proteção de rotas e Menu

- `ProtectedRoute.tsx`: bloqueia acesso se não autenticado
- `Layout.tsx`:
  - Define os itens do menu lateral com a chave `permission` (e `permissionAlt` para dashboard):
    - Dashboard → `dashboard_gerencial` ou `dashboard_operacional`
    - Clientes → `clientes`
    - Veículos → `veiculos`
    - Estoque → `estoque`
    - Ordens de Serviço → `ordens_servico`
    - Fornecedores → `fornecedores`
    - Relatórios → `relatorios`
    - Usuários → `usuarios`
    - Perfis → `perfis`
    - Configurações → `configuracoes`
  - O menu exibido é filtrado por `hasPermission`

### Gestão de Usuários (UI)

- Página: `GerenciarUsuarios.tsx`
- Ações suportadas:
  - Listar usuários (mostra badges de 2FA ON/OFF, Ativo/Inativo e Perfil)
  - Criar usuário (formulário com username, email, nome, senha, perfil e flags Ativo/2FA)
  - Editar usuário (troca de senha: basta preencher o campo Senha; vazio mantém a atual)
  - Excluir usuário (confirmação)
  - Alternar 2FA por usuário (badge 2FA)
  - Ativar/Desativar usuário (badge de status)

### Gestão de Perfis (UI)

- Página: `GerenciarPerfis.tsx`
- Ações suportadas:
  - Listar perfis (cards, contadores de permissões)
  - Criar perfil (nome, descrição, checkboxes de permissões)
  - Editar perfil (respeitando `editavel=false` para Administrador)
  - Excluir perfil (se não estiver em uso)
  - Valida em UI a regra dos dashboards (evita marcar os dois para não-Admin)


## Implantação em outro ambiente

### Requisitos
- Banco PostgreSQL disponível e credenciais
- Redis (opcional; usado em outras features do projeto)
- Python 3.10+ e Node 18+

### Variáveis de ambiente (backend)
Arquivo `.env` no diretório `backend/`:

```env
DATABASE_URL=postgresql://autocare:autocare@localhost:5432/autocare
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=altere-para-um-valor-seguro
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=false
HOST=0.0.0.0
PORT=8008
```

### Instalação do backend

1) Instalar dependências Python (em venv recomendado):
- ver `backend/requirements.txt`

2) Criar o banco (se ainda não existir) e rodar a aplicação:
- O backend executa `create_tables()` no startup, criando `perfis` e `usuarios` conforme os modelos
- No primeiro start, seeds de perfis serão aplicados

3) Usuário admin:
- Se um usuário `admin` existir, ele será vinculado ao perfil Administrador automaticamente no startup
- Caso não exista, crie via endpoint de usuários ou diretamente no banco (hash de senha via bcrypt/Passlib)

### Instalação do frontend

- `frontend/package.json` contém scripts de build
- O app usa `Router` com `basename="/autocare"` e resolve API em `lib/config.ts`:
  - Em dev (servido em /), chama `/api`
  - Em produção (servido em `/autocare`), chama `/autocare-api`
- Garanta que o proxy do servidor web aponte `/autocare-api` para o backend

### Mapeamento de proxy sugerido (exemplo Nginx)

```
location /autocare/ {
  try_files $uri /autocare/index.html;
}

location /autocare-api/ {
  proxy_pass http://127.0.0.1:8008/; # backend FastAPI
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```


## Exemplos de chamadas (API)

### Login (sem 2FA)
Request:
```json
{ "username": "admin", "password": "admin123" }
```
Response (200):
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "requires_2fa": false,
  "user": { "id": 1, "username": "admin", "email": "...", "nome": "Administrador", "ativo": true, "usar_2fa": false, "perfil_id": 1, "perfil_nome": "Administrador", "permissoes": {"...": true} }
}
```

### Login (com 2FA habilitado)
Response (200):
```json
{ "access_token": "<pre_2fa_token>", "token_type": "bearer", "requires_2fa": true, "user": null }
```

### Setup 2FA
Headers: `Authorization: Bearer <pre_2fa_token>`
Response (200):
```json
{ "secret": "JBSWY3DPEHPK3PXP", "qr_code": "data:image/png;base64,....", "provisioning_uri": "otpauth://totp/AutoCare:email@dominio?..." }
```

### Verify 2FA
Request:
```json
{ "username": "admin", "token": "123456" }
```
Response (200):
```json
{ "access_token": "<jwt>", "token_type": "bearer", "user": { "id": 1, "username": "admin", "usar_2fa": true, "has_2fa_configured": true, "perfil_id": 1, "permissoes": {"...": true} } }
```
Erro (400) quando precisa configurar primeiro: header `X-Requires-Setup: true`.

### CRUD Usuários (resumo)
- Criar: POST /api/usuarios/
```json
{ "username": "joao", "email": "joao@x.com", "nome": "João Silva", "password": "senha123", "ativo": true, "usar_2fa": false, "perfil_id": 3 }
```
- Atualizar (troca de senha): PUT /api/usuarios/{id} — incluir `password` no payload para atualizar
- Alternar 2FA: PATCH /api/usuarios/{id}/toggle-2fa { "usar_2fa": true|false }
- Ativar/Desativar: PATCH /api/usuarios/{id}/ativar | /desativar
- Excluir: DELETE /api/usuarios/{id} (não pode excluir a si próprio)

### CRUD Perfis (resumo)
- Criar: POST /api/perfis/
```json
{ "nome": "Gerente", "descricao": "...", "ativo": true, "permissoes": { "dashboard_gerencial": true, "clientes": true, "veiculos": false, "estoque": true, "ordens_servico": true, "fornecedores": false, "relatorios": true, "configuracoes": false, "usuarios": false, "perfis": false, "dashboard_operacional": false } }
```
- Atualizar: PUT /api/perfis/{id}
  - Valida dashboards (somente Administrador pode ter ambos)
- Excluir: DELETE /api/perfis/{id}
  - Não exclui se estiver em uso por usuários


## Boas práticas e segurança

- Altere SECRET_KEY em produção e use HTTPS
- Exija 2FA para perfis críticos (Administrador/Supervisor)
- Senhas mín. 6 caracteres (ideal reforçar política)
- Tokens curtos (30min) e refresh periódico
- Restrinja quem pode acessar rotas de gestão (via menu e permissões)


## Troubleshooting (alvos comuns)

- 2FA sempre inválido → verifique sincronização de hora do servidor
- QR Code não aparece → confirme instalação de pyotp/qrcode/Pillow e confira logs do backend
- Menu não mostra itens esperados → confira se `/auth/me` retorna `permissoes` e o `perfil_id/nome`; revise perfil e permissões no banco
- Não consigo editar/deletar Perfil Administrador → é by-design (`editavel=false`)
- Usuário não consegue trocar senha → a troca é feita pela tela de edição do usuário, preenchendo o campo "Senha" e salvando


## Referências de código

- Modelos: `backend/models/autocare_models.py` (classes `Usuario`, `Perfil`)
- Autenticação/2FA: `backend/routes/autocare_auth.py`
- Usuários: `backend/routes/autocare_usuarios.py`
- Perfis: `backend/routes/autocare_perfis.py`
- Bootstrap e seeds: `backend/server.py`
- Contexto Auth (frontend): `frontend/src/contexts/AuthContext.tsx`
- Menu e permissões: `frontend/src/components/Layout.tsx`
- Telas: `frontend/src/pages/Login.tsx`, `TwoFactorAuth.tsx`, `GerenciarUsuarios.tsx`, `GerenciarPerfis.tsx`


## Conclusão

Com este guia e os arquivos citados, você consegue implantar o mesmo esquema de autenticação, 2FA e RBAC do AutoCare em outro ambiente, mantendo paridade de comportamento entre frontend, backend e banco de dados.
