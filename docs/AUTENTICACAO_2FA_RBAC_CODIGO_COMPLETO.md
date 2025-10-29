# 🔐 Sistema de Autenticação, 2FA e RBAC - Código Completo

> **Documentação detalhada com TODO O CÓDIGO necessário para implementar autenticação JWT, autenticação de dois fatores (2FA) com TOTP, gestão completa de usuários (criar, editar, excluir, trocar senha, ativar/desativar) e sistema de perfis com permissões granulares (RBAC) mapeadas para itens de menu.**

---

## 📑 Índice

1. [Introdução e Visão Geral](#introdução-e-visão-geral)
2. [Banco de Dados](#banco-de-dados)
3. [Backend - Modelos SQLAlchemy](#backend---modelos-sqlalchemy)
4. [Backend - Configuração](#backend---configuração)
5. [Backend - Rotas de Autenticação](#backend---rotas-de-autenticação)
6. [Backend - Rotas de Usuários](#backend---rotas-de-usuários)
7. [Backend - Rotas de Perfis](#backend---rotas-de-perfis)
8. [Backend - Bootstrap e Seeds](#backend---bootstrap-e-seeds)
9. [Frontend - Contexto de Autenticação](#frontend---contexto-de-autenticação)
10. [Frontend - Página de Login](#frontend---página-de-login)
11. [Frontend - Página de 2FA](#frontend---página-de-2fa)
12. [Frontend - Gerenciar Usuários](#frontend---gerenciar-usuários)
13. [Frontend - Gerenciar Perfis](#frontend---gerenciar-perfis)
14. [Frontend - Layout e Menu Dinâmico](#frontend---layout-e-menu-dinâmico)
15. [Guia de Implantação Completo](#guia-de-implantação-completo)
16. [Fluxos de Uso](#fluxos-de-uso)
17. [Troubleshooting](#troubleshooting)

---

## Introdução e Visão Geral

### Funcionalidades Implementadas

✅ **Autenticação JWT** com tokens seguros  
✅ **Hash bcrypt** para senhas via Passlib  
✅ **2FA (TOTP)** opcional por usuário com Microsoft Authenticator  
✅ **Gestão Completa de Usuários**: CRUD + ativar/desativar + trocar senha + toggle 2FA  
✅ **RBAC (Role-Based Access Control)**: Perfis com 11 permissões granulares  
✅ **Seeds Automáticos**: 3 perfis padrão (Administrador, Supervisor, Operador)  
✅ **Menu Dinâmico**: Filtrado pelas permissões do perfil do usuário  
✅ **Validações de Negócio**: Dashboards exclusivos, proteção de perfis do sistema  

### Stack Tecnológico

**Backend:**
- Python 3.10+
- FastAPI 0.104+
- SQLAlchemy 2.0+ (ORM)
- Pydantic v2 (Validação)
- python-jose (JWT)
- passlib[bcrypt] (Hash)
- pyotp (TOTP)
- qrcode + Pillow (QR Code)
- PostgreSQL

**Frontend:**
- React 18
- TypeScript
- React Router DOM
- Tailwind CSS
- lucide-react (ícones)
- sonner (toasts)

### Arquitetura

```
Frontend (React/TS)
    ↓ HTTP/JSON (Bearer Token)
Backend (FastAPI)
    ↓ SQL
PostgreSQL
```

**Componentes Principais:**

- **AuthContext**: Gerencia estado global de autenticação
- **ProtectedRoute**: Protege rotas autenticadas
- **Layout**: Menu lateral dinâmico com filtro por permissões
- **Login**: Formulário de login
- **TwoFactorAuth**: Setup e verificação de 2FA
- **GerenciarUsuarios**: CRUD completo de usuários
- **GerenciarPerfis**: CRUD completo de perfis

---

## Banco de Dados

### Estrutura SQL

#### Tabela `perfis`

```sql
CREATE TABLE perfis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    permissoes TEXT NOT NULL,  -- JSON string
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    editavel BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_perfis_nome ON perfis(nome);
CREATE INDEX idx_perfis_ativo ON perfis(ativo);
```

**Exemplo de JSON em `permissoes`:**

```json
{
  "dashboard_gerencial": true,
  "dashboard_operacional": false,
  "clientes": true,
  "veiculos": true,
  "estoque": true,
  "ordens_servico": true,
  "fornecedores": true,
  "relatorios": true,
  "configuracoes": false,
  "usuarios": false,
  "perfis": false
}
```

#### Tabela `usuarios`

```sql
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE NOT NULL,
    usar_2fa BOOLEAN DEFAULT FALSE NOT NULL,
    secret_2fa VARCHAR(32),  -- TOTP secret (base32)
    perfil_id INTEGER NOT NULL DEFAULT 3 REFERENCES perfis(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_perfil_id ON usuarios(perfil_id);
CREATE INDEX idx_usuarios_ativo ON usuarios(ativo);
```

### Mapeamento de Permissões para Menu

| Permissão | Item do Menu | Descrição |
|-----------|--------------|-----------|
| `dashboard_gerencial` | Dashboard | Visão gerencial (métricas, gráficos) |
| `dashboard_operacional` | Dashboard | Visão operacional (ordens, tarefas) |
| `clientes` | Clientes | Gerenciar clientes |
| `veiculos` | Veículos | Gerenciar veículos |
| `estoque` | Estoque | Gerenciar produtos e estoque |
| `ordens_servico` | Ordens de Serviço | Gerenciar ordens de serviço |
| `fornecedores` | Fornecedores | Gerenciar fornecedores |
| `relatorios` | Relatórios | Visualizar e gerar relatórios |
| `configuracoes` | Configurações | Acessar configurações do sistema |
| `usuarios` | Gerenciar Usuários | CRUD de usuários |
| `perfis` | Gerenciar Perfis | CRUD de perfis |

**Regras de Negócio:**

⚠️ **Dashboard Duplo**: Apenas o perfil "Administrador" pode ter ambos `dashboard_gerencial` E `dashboard_operacional` = true. Outros perfis devem escolher apenas um.

⚠️ **Perfil Protegido**: O perfil "Administrador" tem `editavel=false` e não pode ser editado ou excluído.

---

## Backend - Modelos SQLAlchemy

### Arquivo: `backend/models/autocare_models.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db import Base

class Perfil(Base):
    __tablename__ = "perfis"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), unique=True, nullable=False, index=True)
    descricao = Column(Text)
    permissoes = Column(Text, nullable=False)  # JSON string
    ativo = Column(Boolean, default=True)
    editavel = Column(Boolean, default=True)  # False para Administrador
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    usuarios = relationship("Usuario", back_populates="perfil")

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    senha_hash = Column(String(255), nullable=False)
    nome = Column(String(255), nullable=False)
    ativo = Column(Boolean, default=True)
    usar_2fa = Column(Boolean, default=False)
    secret_2fa = Column(String(32), nullable=True)  # Secret TOTP (pyotp)
    perfil_id = Column(Integer, ForeignKey("perfis.id"), nullable=False, default=3)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relacionamentos
    perfil = relationship("Perfil", back_populates="usuarios")
```

### Arquivo: `backend/db.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL do .env
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://autocare:autocare@localhost:5432/autocare")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency para obter sessão do banco"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Criar todas as tabelas do banco"""
    Base.metadata.create_all(bind=engine)
```

---

## Backend - Configuração

### Arquivo: `backend/config.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "sua_chave_secreta_aqui_mude_em_producao")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# CORS Configuration
ALLOWED_ORIGINS = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1",
    "http://127.0.0.1:5173",
]

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://autocare:autocare@localhost:5432/autocare")

# Debug
DEBUG = os.getenv("DEBUG", "True").lower() == "true"

# Uploads
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
```

### Arquivo: `backend/requirements.txt`

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
python-dotenv==1.0.0
pyotp==2.9.0
qrcode[pil]==7.4.2
Pillow==10.1.0
alembic==1.12.1
pydantic==2.5.0
pydantic-settings==2.1.0
```

---

## Backend - Rotas de Autenticação

### Arquivo: `backend/schemas/schemas_usuario.py`

```python
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict

# Request Schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class Verify2FARequest(BaseModel):
    username: str
    token: str  # Código TOTP de 6 dígitos

# Response Schemas
class UserBase(BaseModel):
    id: int
    username: str
    email: str
    nome: str
    ativo: bool
    usar_2fa: bool
    perfil_id: int
    perfil_nome: Optional[str] = None
    permissoes: Optional[Dict[str, bool]] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    requires_2fa: bool
    user: Optional[UserBase] = None

class Verify2FAResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserBase

class Setup2FAResponse(BaseModel):
    secret: str
    qr_code: str  # Data URL (base64)
    provisioning_uri: str

class UserMeResponse(UserBase):
    has_2fa_configured: bool = False

class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str

class UsuarioCreate(BaseModel):
    username: str
    email: EmailStr
    nome: str
    password: str
    ativo: bool = True
    usar_2fa: bool = False
    perfil_id: int = 3

class UsuarioUpdate(BaseModel):
    email: Optional[EmailStr] = None
    nome: Optional[str] = None
    password: Optional[str] = None
    ativo: Optional[bool] = None
    usar_2fa: Optional[bool] = None
    perfil_id: Optional[int] = None

class UsuarioResponse(BaseModel):
    id: int
    username: str
    email: str
    nome: str
    ativo: bool
    usar_2fa: bool
    perfil_id: int
    created_at: str
    
    class Config:
        from_attributes = True

class UsuarioListResponse(UserBase):
    created_at: str

class Toggle2FARequest(BaseModel):
    usar_2fa: bool
```

### Arquivo: `backend/routes/autocare_auth.py` (CÓDIGO COMPLETO)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Optional
import pyotp
import qrcode
import io
import base64
import json

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from db import get_db
from models.autocare_models import Usuario
from schemas.schemas_usuario import (
    LoginRequest, LoginResponse, Verify2FARequest, Verify2FAResponse,
    Setup2FAResponse, UserMeResponse, TokenRefreshResponse
)

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar senha com hash bcrypt"""
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    """Gerar hash bcrypt da senha"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Criar token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Usuario:
    """Obter usuário atual a partir do token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(Usuario).filter(Usuario.username == username).first()
    if user is None:
        raise credentials_exception
    
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    
    return user

def generate_2fa_secret() -> str:
    """Gerar secret aleatório para 2FA (base32)"""
    return pyotp.random_base32()

def generate_qr_code(provisioning_uri: str) -> str:
    """Gerar QR code como imagem base64"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Converter imagem para base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_base64}"

def verify_totp(secret: str, token: str) -> bool:
    """Verificar código TOTP (6 dígitos)"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)  # Aceita 1 janela de tempo antes/depois

@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Fazer login e obter token
    
    - Se o usuário tiver 2FA habilitado, retorna requires_2fa=True e token temporário
    - Se não tiver 2FA, retorna access_token completo e dados do usuário
    """
    user = db.query(Usuario).filter(Usuario.username == login_data.username).first()
    
    if not user or not verify_password(login_data.password, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo"
        )
    
    # Se o usuário tem 2FA habilitado, emite um token temporário
    if user.usar_2fa:
        access_token_expires = timedelta(minutes=10)  # Token temporário de 10 min
        temp_token = create_access_token(
            data={"sub": user.username, "scope": "pre_2fa"},
            expires_delta=access_token_expires
        )
        return {
            "access_token": temp_token,
            "token_type": "bearer",
            "requires_2fa": True,
            "user": None
        }
    
    # Se não tem 2FA, gera o token normalmente
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "nome": user.nome,
            "ativo": user.ativo,
            "usar_2fa": user.usar_2fa,
            "perfil_id": user.perfil_id,
            "perfil_nome": user.perfil.nome if user.perfil else None,
            "permissoes": json.loads(user.perfil.permissoes) if user.perfil and user.perfil.permissoes else None
        }
    }

@router.post("/setup-2fa", response_model=Setup2FAResponse)
def setup_2fa(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Configurar 2FA pela primeira vez
    
    Retorna:
    - secret: Código alfanumérico para entrada manual
    - qr_code: Imagem QR em base64 para escanear
    - provisioning_uri: URI otpauth://
    """
    if not current_user.usar_2fa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA não está habilitado para este usuário"
        )
    
    # Se já existir um secret configurado, reutilizar
    if current_user.secret_2fa:
        secret = current_user.secret_2fa
    else:
        # Gerar novo secret e persistir
        secret = generate_2fa_secret()
        current_user.secret_2fa = secret
        db.commit()

    # Gerar URI de provisionamento para Microsoft Authenticator
    provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email,
        issuer_name="AutoCare"
    )

    # Gerar QR code
    qr_code = generate_qr_code(provisioning_uri)

    return {
        "secret": secret,
        "qr_code": qr_code,
        "provisioning_uri": provisioning_uri
    }

@router.post("/verify-2fa", response_model=Verify2FAResponse)
def verify_2fa(verify_data: Verify2FARequest, db: Session = Depends(get_db)):
    """
    Verificar código 2FA após login
    
    - Se o usuário ainda não configurou 2FA (secret_2fa é None), retorna erro com header X-Requires-Setup
    - Se já configurou, valida o código TOTP e retorna token completo
    """
    user = db.query(Usuario).filter(Usuario.username == verify_data.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado"
        )
    
    if not user.usar_2fa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA não está habilitado para este usuário"
        )
    
    # Se não tem secret configurado, precisa fazer setup primeiro
    if not user.secret_2fa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA não foi configurado ainda. Faça o setup primeiro.",
            headers={"X-Requires-Setup": "true"}
        )
    
    # Verificar código TOTP
    if not verify_totp(user.secret_2fa, verify_data.token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código 2FA inválido"
        )
    
    # Código válido, gerar token de acesso completo
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "nome": user.nome,
            "ativo": user.ativo,
            "usar_2fa": user.usar_2fa,
            "has_2fa_configured": bool(user.secret_2fa),
            "perfil_id": user.perfil_id,
            "perfil_nome": user.perfil.nome if user.perfil else None,
            "permissoes": json.loads(user.perfil.permissoes) if user.perfil and user.perfil.permissoes else None
        }
    }

@router.get("/me", response_model=UserMeResponse)
def get_current_user_info(current_user: Usuario = Depends(get_current_user)):
    """Obter informações do usuário atual (validação de token)"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "nome": current_user.nome,
        "ativo": current_user.ativo,
        "usar_2fa": current_user.usar_2fa,
        "has_2fa_configured": bool(current_user.secret_2fa),
        "perfil_id": current_user.perfil_id,
        "perfil_nome": current_user.perfil.nome if current_user.perfil else None,
        "permissoes": json.loads(current_user.perfil.permissoes) if current_user.perfil and current_user.perfil.permissoes else None
    }

@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_token(current_user: Usuario = Depends(get_current_user)):
    """Renovar token"""
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.username},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout():
    """
    Fazer logout
    
    Nota: Em uma implementação real com blacklist de tokens, 
    invalidaria o token aqui. Por enquanto, apenas confirma o logout.
    """
    return {"message": "Logout realizado com sucesso"}
```

---

*Continua no próximo documento devido ao tamanho...*

