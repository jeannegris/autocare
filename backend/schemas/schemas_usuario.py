from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Dict
from datetime import datetime
import json

# Schemas para Login e Autenticação
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    requires_2fa: bool
    user: Optional[dict] = None

class Verify2FARequest(BaseModel):
    username: str
    token: str  # Código TOTP de 6 dígitos

class Verify2FAResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict  # inclui has_2fa_configured no payload

class Setup2FAResponse(BaseModel):
    secret: str
    qr_code: str  # Base64 encoded QR code image
    provisioning_uri: str

# Schemas para CRUD de Usuários
class UsuarioBase(BaseModel):
    username: str
    email: EmailStr
    nome: str
    ativo: Optional[bool] = True
    usar_2fa: Optional[bool] = False
    perfil_id: Optional[int] = 3  # Padrão: Operador

class UsuarioCreate(UsuarioBase):
    password: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('A senha deve ter no mínimo 6 caracteres')
        return v
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('O username deve ter no mínimo 3 caracteres')
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('O username deve conter apenas letras, números, _ ou -')
        return v

class UsuarioUpdate(BaseModel):
    email: Optional[EmailStr] = None
    nome: Optional[str] = None
    ativo: Optional[bool] = None
    usar_2fa: Optional[bool] = None
    password: Optional[str] = None
    perfil_id: Optional[int] = None
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if v is not None and len(v) < 6:
            raise ValueError('A senha deve ter no mínimo 6 caracteres')
        return v

class UsuarioResponse(UsuarioBase):
    id: int
    perfil_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UsuarioListResponse(BaseModel):
    id: int
    username: str
    email: str
    nome: str
    ativo: bool
    usar_2fa: bool
    perfil_id: int
    perfil_nome: Optional[str] = None
    permissoes: Optional[Dict] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class Toggle2FARequest(BaseModel):
    usar_2fa: bool

class UserMeResponse(BaseModel):
    id: int
    username: str
    email: str
    nome: str
    ativo: bool
    usar_2fa: bool
    has_2fa_configured: bool
    perfil_id: int
    perfil_nome: Optional[str] = None
    permissoes: Optional[Dict] = None
    
    class Config:
        from_attributes = True

class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str
