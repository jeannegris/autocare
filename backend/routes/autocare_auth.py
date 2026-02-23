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
    """Verificar senha"""
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    """Hash de senha"""
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
    """Obter usuário atual a partir do token"""
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
    """Gerar secret para 2FA"""
    return pyotp.random_base32()

def generate_qr_code(provisioning_uri: str) -> str:
    """Gerar QR code como base64"""
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
    """Verificar código TOTP"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)  # Aceita 1 janela de tempo antes/depois

@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Fazer login e obter token
    Se o usuário tiver 2FA habilitado, retorna requires_2fa=True
    Se não tiver 2FA, retorna o token de acesso completo
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
    
    # Se o usuário tem 2FA habilitado, emite um token temporário para permitir setup/verify
    # Esse token é de curta duração e só deve ser usado para concluir o desafio 2FA
    if user.usar_2fa:
        access_token_expires = timedelta(minutes=10)
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
    Configurar 2FA pela primeira vez ou resetar
    Retorna o secret e QR code para configuração no Microsoft Authenticator
    """
    if not current_user.usar_2fa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA não está habilitado para este usuário"
        )
    
    # Se já existir um secret configurado, reutilizar (não regenerar) para evitar reset acidental
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
    Se o usuário ainda não configurou 2FA (secret_2fa é None), redireciona para setup
    Se já configurou, valida o código TOTP
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
    
    # Código válido, gerar token de acesso
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
    """Obter informações do usuário atual"""
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
    Em uma implementação real com blacklist de tokens, 
    invalidaria o token aqui. Por enquanto, apenas confirma o logout.
    """
    return {"message": "Logout realizado com sucesso"}