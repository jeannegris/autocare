# 🔐 Sistema de Autenticação com 2FA - AutoCare

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Instalação](#instalação)
3. [Configuração](#configuração)
4. [Uso do Sistema](#uso-do-sistema)
5. [Gerenciamento de Usuários](#gerenciamento-de-usuários)
6. [Autenticação de Dois Fatores (2FA)](#autenticação-de-dois-fatores-2fa)
7. [Estrutura Técnica](#estrutura-técnica)
8. [Fluxos de Autenticação](#fluxos-de-autenticação)
9. [API Endpoints](#api-endpoints)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Sistema completo de autenticação implementado no AutoCare com suporte a:
- Login com usuário e senha
- Autenticação de Dois Fatores (2FA) opcional via Microsoft Authenticator
- Gerenciamento completo de usuários
- Controle de acesso baseado em tokens JWT
- Rotas protegidas no frontend

### Principais Funcionalidades

✅ **Login e Senha**: Autenticação básica com credenciais
✅ **2FA Opcional**: Cada usuário pode ter 2FA habilitado ou não
✅ **Setup Automático do 2FA**: Na primeira vez, o sistema gera QR Code para o Microsoft Authenticator
✅ **Gerenciamento de Usuários**: CRUD completo acessível via menu Configurações
✅ **Reset de 2FA**: Ao desabilitar o 2FA, o secret é zerado para nova configuração
✅ **Segurança**: Senhas com hash bcrypt, tokens JWT, validações de entrada

---

## 🚀 Instalação

### Passo 1: Executar Script de Instalação

```bash
cd /var/www/autocare
./install_auth.sh
```

O script automaticamente:
1. Instala as dependências Python (pyotp, qrcode, Pillow)
2. Executa a migration do banco de dados (cria tabela `usuarios`)
3. Cria o usuário administrador padrão

### Passo 2: Reiniciar Backend

```bash
pm2 restart autocare-backend
```

### Passo 3: Primeiro Acesso

1. Acesse a aplicação: `http://seu-servidor/autocare/login`
2. Faça login com as credenciais padrão:
   - **Username**: `admin`
   - **Senha**: `admin123`
3. **IMPORTANTE**: Altere a senha padrão imediatamente!

---

## ⚙️ Configuração

### Variáveis de Ambiente

No arquivo `/var/www/autocare/backend/.env`, certifique-se de ter:

```env
SECRET_KEY=sua-chave-secreta-aqui-mude-em-producao
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**IMPORTANTE**: Em produção, altere o `SECRET_KEY` para um valor único e seguro.

### Frontend

O frontend usa a variável de ambiente:

```env
VITE_API_URL=/api
```

---

## 🔑 Uso do Sistema

### Login Normal (sem 2FA)

1. Acesse `/login`
2. Digite usuário e senha
3. Clique em "Entrar"
4. → Você será redirecionado para o Dashboard

### Login com 2FA (primeira vez)

1. Acesse `/login`
2. Digite usuário e senha
3. Clique em "Entrar"
4. → Você será redirecionado para `/2fa`
5. **Setup do 2FA:**
   - Um QR Code será exibido
   - Abra o Microsoft Authenticator no celular
   - Escaneie o QR Code
   - Digite o código de 6 dígitos gerado
6. → Você será autenticado e redirecionado para o Dashboard

### Login com 2FA (já configurado)

1. Acesse `/login`
2. Digite usuário e senha
3. Clique em "Entrar"
4. → Você será redirecionado para `/2fa`
5. Abra o Microsoft Authenticator
6. Digite o código de 6 dígitos exibido
7. → Você será autenticado e redirecionado para o Dashboard

---

## 👥 Gerenciamento de Usuários

### Acessar Tela de Gerenciamento

1. Faça login no sistema
2. Vá em **Configurações** (menu lateral)
3. Clique no botão **"Gerenciar Usuários"** (canto superior direito)

### Criar Novo Usuário

1. Na tela de usuários, clique em **"Novo Usuário"**
2. Preencha os dados:
   - **Nome Completo**: Nome do usuário
   - **Nome de Usuário**: Login único (sem espaços, minúsculas)
   - **Email**: Email válido
   - **Senha**: Mínimo 6 caracteres
   - **Usuário ativo**: Marque para ativar
   - **Habilitar 2FA**: Marque se desejar que o usuário use 2FA
3. Clique em **"Criar Usuário"**

**Observação**: Se você habilitar o 2FA na criação, o usuário precisará configurar o Microsoft Authenticator no primeiro login.

### Editar Usuário

1. Clique no ícone de **Editar** (lápis) ao lado do usuário
2. Altere os dados desejados
3. **Senha**: Deixe em branco para manter a senha atual
4. Clique em **"Salvar Alterações"**

### Excluir Usuário

1. Clique no ícone de **Excluir** (lixeira) ao lado do usuário
2. Confirme a exclusão

**Observação**: Você não pode excluir seu próprio usuário.

### Habilitar/Desabilitar 2FA

Existem duas formas:

**Forma 1: Através da edição**
1. Edite o usuário
2. Marque ou desmarque "Habilitar 2FA"
3. Salve

**Forma 2: Através do botão de status**
1. Clique no badge de 2FA (verde = habilitado, cinza = desabilitado)
2. O status será alternado automaticamente

**IMPORTANTE**: Ao desabilitar o 2FA, o secret é zerado. Se reabilitar, o usuário precisará configurar novamente como se fosse a primeira vez.

### Ativar/Desativar Usuário

1. Clique no badge de Status (verde = ativo, vermelho = inativo)
2. O status será alternado automaticamente

**Observação**: Você não pode desativar seu próprio usuário.

---

## 🔐 Autenticação de Dois Fatores (2FA)

### O que é 2FA?

O 2FA adiciona uma camada extra de segurança ao login. Mesmo que alguém descubra sua senha, ainda precisará do código gerado pelo seu celular.

### Como Funciona?

1. **Primeiro Login com 2FA**:
   - Sistema gera um "secret" único
   - Exibe QR Code
   - Você escaneia com Microsoft Authenticator
   - App passa a gerar códigos de 6 dígitos a cada 30 segundos

2. **Logins Seguintes**:
   - Após digitar usuário/senha
   - Digite o código atual do app
   - Sistema valida e autentica

### Microsoft Authenticator

**Download:**
- Android: Google Play Store
- iOS: App Store

**Como Adicionar:**
1. Abra o app
2. Toque em "+"
3. Escolha "Conta corporativa ou de estudante" ou "Outra conta"
4. Escanear QR Code
5. Pronto! O app começará a gerar códigos

### Resetar 2FA

Se um usuário perder acesso ao celular:

1. Acesse Gerenciar Usuários
2. Edite o usuário afetado
3. Desmarque "Habilitar 2FA"
4. Salve
5. Marque novamente "Habilitar 2FA"
6. Salve novamente
7. No próximo login, um novo QR Code será gerado

---

## 🏗️ Estrutura Técnica

### Backend

**Arquivos Criados/Modificados:**

```
backend/
├── models/autocare_models.py           # Modelo Usuario
├── schemas/schemas_usuario.py          # Schemas Pydantic
├── routes/
│   ├── autocare_auth.py               # Rotas de autenticação (REESCRITO)
│   └── autocare_usuarios.py           # Rotas de gerenciamento de usuários
├── alembic/versions/
│   └── 27f1b6baf96f_criar_tabela_usuarios.py  # Migration
├── requirements.txt                    # Dependências atualizadas
└── server.py                          # Registro de rotas
```

**Dependências Adicionadas:**
- `pyotp==2.9.0`: Geração de códigos TOTP
- `qrcode==7.4.2`: Geração de QR Codes
- `Pillow==10.1.0`: Manipulação de imagens

### Frontend

**Arquivos Criados/Modificados:**

```
frontend/src/
├── contexts/
│   └── AuthContext.tsx                # Context de autenticação
├── components/
│   └── ProtectedRoute.tsx            # Wrapper para rotas protegidas
├── pages/
│   ├── Login.tsx                     # Tela de login
│   ├── TwoFactorAuth.tsx            # Tela de 2FA
│   ├── GerenciarUsuarios.tsx        # Gerenciamento de usuários
│   └── Configuracoes.tsx            # Link para gerenciar usuários
└── App.tsx                           # Rotas e AuthProvider
```

### Banco de Dados

**Tabela `usuarios`:**

| Campo       | Tipo                 | Descrição                              |
|-------------|----------------------|----------------------------------------|
| id          | INTEGER (PK)         | ID único                               |
| username    | VARCHAR(100) UNIQUE  | Nome de usuário                        |
| email       | VARCHAR(255) UNIQUE  | Email                                  |
| senha_hash  | VARCHAR(255)         | Senha com hash bcrypt                  |
| nome        | VARCHAR(255)         | Nome completo                          |
| ativo       | BOOLEAN              | Se o usuário está ativo                |
| usar_2fa    | BOOLEAN              | Se o 2FA está habilitado               |
| secret_2fa  | VARCHAR(32)          | Secret TOTP (NULL se 2FA não configurado) |
| created_at  | TIMESTAMP            | Data de criação                        |
| updated_at  | TIMESTAMP            | Data da última atualização             |

---

## 🔄 Fluxos de Autenticação

### Fluxo 1: Login sem 2FA

```
[Usuário] → digita username/senha
    ↓
[POST /api/auth/login]
    ↓
[Backend] verifica credenciais
    ↓
[Backend] verifica usar_2fa = false
    ↓
[Backend] gera JWT token
    ↓
[Frontend] salva token no localStorage
    ↓
[Redirect] → /dashboard
```

### Fluxo 2: Login com 2FA (Primeira Vez)

```
[Usuário] → digita username/senha
    ↓
[POST /api/auth/login]
    ↓
[Backend] verifica credenciais
    ↓
[Backend] verifica usar_2fa = true
    ↓
[Backend] retorna requires_2fa = true
    ↓
[Redirect] → /2fa
    ↓
[Frontend] detecta secret_2fa = NULL
    ↓
[POST /api/auth/setup-2fa]
    ↓
[Backend] gera secret e QR Code
    ↓
[Frontend] exibe QR Code
    ↓
[Usuário] escaneia com Microsoft Authenticator
    ↓
[Usuário] digita código de 6 dígitos
    ↓
[POST /api/auth/verify-2fa]
    ↓
[Backend] valida código TOTP
    ↓
[Backend] gera JWT token
    ↓
[Frontend] salva token no localStorage
    ↓
[Redirect] → /dashboard
```

### Fluxo 3: Login com 2FA (Já Configurado)

```
[Usuário] → digita username/senha
    ↓
[POST /api/auth/login]
    ↓
[Backend] verifica credenciais
    ↓
[Backend] verifica usar_2fa = true
    ↓
[Backend] retorna requires_2fa = true
    ↓
[Redirect] → /2fa
    ↓
[Usuário] abre Microsoft Authenticator
    ↓
[Usuário] digita código de 6 dígitos
    ↓
[POST /api/auth/verify-2fa]
    ↓
[Backend] valida código TOTP com secret_2fa
    ↓
[Backend] gera JWT token
    ↓
[Frontend] salva token no localStorage
    ↓
[Redirect] → /dashboard
```

---

## 🔌 API Endpoints

### Autenticação

#### POST /api/auth/login
Login inicial (username e senha)

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (sem 2FA):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "requires_2fa": false,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@autocare.com",
    "nome": "Administrador",
    "ativo": true,
    "usar_2fa": false
  }
}
```

**Response (com 2FA):**
```json
{
  "access_token": "",
  "token_type": "bearer",
  "requires_2fa": true,
  "user": null
}
```

#### POST /api/auth/setup-2fa
Configurar 2FA pela primeira vez

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGgo...",
  "provisioning_uri": "otpauth://totp/AutoCare:user@email.com?secret=..."
}
```

#### POST /api/auth/verify-2fa
Verificar código 2FA

**Request:**
```json
{
  "username": "admin",
  "token": "123456"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@autocare.com",
    "nome": "Administrador",
    "ativo": true,
    "usar_2fa": true
  }
}
```

#### GET /api/auth/me
Obter informações do usuário atual

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@autocare.com",
  "nome": "Administrador",
  "ativo": true,
  "usar_2fa": false
}
```

#### POST /api/auth/refresh
Renovar token

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

#### POST /api/auth/logout
Fazer logout

**Response:**
```json
{
  "message": "Logout realizado com sucesso"
}
```

### Gerenciamento de Usuários

#### GET /api/usuarios
Listar todos os usuários

#### GET /api/usuarios/{id}
Obter usuário específico

#### POST /api/usuarios
Criar novo usuário

**Request:**
```json
{
  "username": "joao",
  "email": "joao@email.com",
  "nome": "João Silva",
  "password": "senha123",
  "ativo": true,
  "usar_2fa": false
}
```

#### PUT /api/usuarios/{id}
Atualizar usuário

#### DELETE /api/usuarios/{id}
Excluir usuário

#### PATCH /api/usuarios/{id}/toggle-2fa
Habilitar/desabilitar 2FA

**Request:**
```json
{
  "usar_2fa": true
}
```

#### PATCH /api/usuarios/{id}/ativar
Ativar usuário

#### PATCH /api/usuarios/{id}/desativar
Desativar usuário

---

## 🔧 Troubleshooting

### Problema: Não consigo fazer login

**Solução:**
1. Verifique se o backend está rodando: `pm2 status`
2. Verifique os logs: `pm2 logs autocare-backend`
3. Tente com as credenciais padrão: `admin / admin123`
4. Verifique se a migration foi executada: `alembic current`

### Problema: QR Code não aparece no 2FA

**Possíveis causas:**
1. Dependências não instaladas
   ```bash
   pip install pyotp qrcode Pillow
   ```
2. Erro no backend - verifique logs

### Problema: Código 2FA sempre inválido

**Solução:**
1. Verifique a hora do servidor:
   ```bash
   date
   ```
   O TOTP depende de sincronização de tempo
2. Certifique-se de digitar o código atual (não o anterior)
3. Tente resetar o 2FA do usuário

### Problema: Token JWT expirado

**Solução:**
1. O token expira em 30 minutos (padrão)
2. Faça login novamente
3. Para alterar o tempo de expiração, modifique `ACCESS_TOKEN_EXPIRE_MINUTES` no `.env`

### Problema: Usuário admin não existe

**Solução:**
Execute manualmente a criação:
```bash
cd /var/www/autocare/backend
python3 << EOF
from db import SessionLocal
from models.autocare_models import Usuario
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()

admin = Usuario(
    username="admin",
    email="admin@autocare.com",
    nome="Administrador",
    senha_hash=pwd_context.hash("admin123"),
    ativo=True,
    usar_2fa=False
)
db.add(admin)
db.commit()
db.close()
print("Admin criado!")
EOF
```

### Problema: Erro ao importar pyotp

**Solução:**
```bash
cd /var/www/autocare/backend
pip install --force-reinstall pyotp qrcode Pillow
pm2 restart autocare-backend
```

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs do backend: `pm2 logs autocare-backend`
2. Verifique os logs do navegador (Console F12)
3. Consulte este documento
4. Entre em contato com o suporte técnico

---

## 🔒 Segurança

**Boas Práticas:**
- ✅ Altere a senha padrão do admin imediatamente
- ✅ Use senhas fortes (mínimo 8 caracteres, letras, números, símbolos)
- ✅ Habilite 2FA para usuários com permissões críticas
- ✅ Altere o SECRET_KEY em produção
- ✅ Use HTTPS em produção
- ✅ Mantenha o sistema atualizado
- ✅ Faça backups regulares do banco de dados
- ✅ Desative usuários que não estão mais na empresa

---

**Documentação criada em:** 22 de Outubro de 2025  
**Versão do Sistema:** AutoCare 1.0.0  
**Última atualização:** 22/10/2025
