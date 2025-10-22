from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

from db import get_db
from models.autocare_models import Usuario, Perfil
from schemas.schemas_usuario import (
    UsuarioCreate, UsuarioUpdate, UsuarioResponse, UsuarioListResponse, Toggle2FARequest
)
from routes.autocare_auth import get_current_user, hash_password

router = APIRouter()

@router.get("/", response_model=List[UsuarioListResponse])
def listar_usuarios(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Listar todos os usuários"""
    usuarios = db.query(Usuario).offset(skip).limit(limit).all()
    
    # Adicionar informações do perfil
    result = []
    for usuario in usuarios:
        usuario_dict = {
            "id": usuario.id,
            "username": usuario.username,
            "email": usuario.email,
            "nome": usuario.nome,
            "ativo": usuario.ativo,
            "usar_2fa": usuario.usar_2fa,
            "perfil_id": usuario.perfil_id,
            "perfil_nome": usuario.perfil.nome if usuario.perfil else None,
            "permissoes": json.loads(usuario.perfil.permissoes) if usuario.perfil and usuario.perfil.permissoes else None,
            "created_at": usuario.created_at
        }
        result.append(usuario_dict)
    
    return result

@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obter_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obter um usuário específico por ID"""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    return usuario

@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def criar_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Criar um novo usuário"""
    # Verificar se username já existe
    existing_user = db.query(Usuario).filter(Usuario.username == usuario.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username já está em uso"
        )
    
    # Verificar se email já existe
    existing_email = db.query(Usuario).filter(Usuario.email == usuario.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email já está em uso"
        )
    
    # Verificar se perfil existe
    perfil = db.query(Perfil).filter(Perfil.id == usuario.perfil_id).first()
    if not perfil:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Perfil não encontrado"
        )
    
    # Criar novo usuário
    senha_hash = hash_password(usuario.password)
    
    db_usuario = Usuario(
        username=usuario.username,
        email=usuario.email,
        nome=usuario.nome,
        senha_hash=senha_hash,
        ativo=usuario.ativo,
        usar_2fa=usuario.usar_2fa,
        perfil_id=usuario.perfil_id,
        secret_2fa=None  # Será configurado depois se usar_2fa=True
    )
    
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    
    return db_usuario

@router.put("/{usuario_id}", response_model=UsuarioResponse)
def atualizar_usuario(
    usuario_id: int,
    usuario_update: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Atualizar um usuário existente"""
    db_usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not db_usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    # Atualizar campos fornecidos
    update_data = usuario_update.model_dump(exclude_unset=True)
    
    # Se está atualizando email, verificar se já existe
    if "email" in update_data and update_data["email"] != db_usuario.email:
        existing_email = db.query(Usuario).filter(
            Usuario.email == update_data["email"],
            Usuario.id != usuario_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email já está em uso"
            )
    
    # Se está atualizando senha, fazer hash
    if "password" in update_data and update_data["password"]:
        update_data["senha_hash"] = hash_password(update_data["password"])
        del update_data["password"]
    
    # Se está desabilitando 2FA, zerar o secret
    if "usar_2fa" in update_data and not update_data["usar_2fa"]:
        update_data["secret_2fa"] = None
    
    # Aplicar atualizações
    for key, value in update_data.items():
        setattr(db_usuario, key, value)
    
    db.commit()
    db.refresh(db_usuario)
    
    return db_usuario

@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Deletar um usuário"""
    db_usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not db_usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    # Não permitir deletar a si mesmo
    if db_usuario.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível deletar seu próprio usuário"
        )
    
    db.delete(db_usuario)
    db.commit()
    
    return None

@router.patch("/{usuario_id}/toggle-2fa", response_model=UsuarioResponse)
def toggle_2fa(
    usuario_id: int,
    toggle_data: Toggle2FARequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Habilitar ou desabilitar 2FA para um usuário
    Se desabilitar, o secret é zerado
    """
    db_usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not db_usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    db_usuario.usar_2fa = toggle_data.usar_2fa
    
    # Se está desabilitando 2FA, zerar o secret
    if not toggle_data.usar_2fa:
        db_usuario.secret_2fa = None
    
    db.commit()
    db.refresh(db_usuario)
    
    return db_usuario

@router.patch("/{usuario_id}/ativar", response_model=UsuarioResponse)
def ativar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Ativar um usuário inativo"""
    db_usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not db_usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    db_usuario.ativo = True
    db.commit()
    db.refresh(db_usuario)
    
    return db_usuario

@router.patch("/{usuario_id}/desativar", response_model=UsuarioResponse)
def desativar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Desativar um usuário ativo"""
    db_usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    
    if not db_usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado"
        )
    
    # Não permitir desativar a si mesmo
    if db_usuario.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível desativar seu próprio usuário"
        )
    
    db_usuario.ativo = False
    db.commit()
    db.refresh(db_usuario)
    
    return db_usuario
