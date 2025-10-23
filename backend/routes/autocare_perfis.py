from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

from db import get_db
from models.autocare_models import Perfil, Usuario
from schemas.schemas_perfil import (
    PerfilCreate, PerfilUpdate, PerfilResponse, PerfilListResponse
)
from routes.autocare_auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[PerfilResponse])
def listar_perfis(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Listar todos os perfis"""
    perfis = db.query(Perfil).offset(skip).limit(limit).all()
    
    # Converter permissoes de string para dict
    result = []
    for perfil in perfis:
        perfil_dict = {
            "id": perfil.id,
            "nome": perfil.nome,
            "descricao": perfil.descricao,
            "permissoes": json.loads(perfil.permissoes) if isinstance(perfil.permissoes, str) else perfil.permissoes,
            "ativo": perfil.ativo,
            "editavel": perfil.editavel,
            "created_at": perfil.created_at,
            "updated_at": perfil.updated_at
        }
        result.append(perfil_dict)
    
    return result

@router.get("/{perfil_id}", response_model=PerfilResponse)
def obter_perfil(
    perfil_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obter um perfil específico por ID"""
    perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    
    if not perfil:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil não encontrado"
        )
    
    # Converter permissoes de string para dict
    perfil_dict = {
        "id": perfil.id,
        "nome": perfil.nome,
        "descricao": perfil.descricao,
        "permissoes": json.loads(perfil.permissoes) if isinstance(perfil.permissoes, str) else perfil.permissoes,
        "ativo": perfil.ativo,
        "editavel": perfil.editavel,
        "created_at": perfil.created_at,
        "updated_at": perfil.updated_at
    }
    
    return perfil_dict

@router.post("/", response_model=PerfilResponse, status_code=status.HTTP_201_CREATED)
def criar_perfil(
    perfil: PerfilCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Criar um novo perfil"""
    # Verificar se nome já existe
    existing_perfil = db.query(Perfil).filter(Perfil.nome == perfil.nome).first()
    if existing_perfil:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um perfil com este nome"
        )
    
    # Converter permissões para JSON string
    permissoes_json = json.dumps(perfil.permissoes.model_dump())
    
    # Criar novo perfil
    db_perfil = Perfil(
        nome=perfil.nome,
        descricao=perfil.descricao,
        permissoes=permissoes_json,
        ativo=perfil.ativo,
        editavel=True  # Perfis criados manualmente são sempre editáveis
    )
    
    db.add(db_perfil)
    db.commit()
    db.refresh(db_perfil)
    
    # Retornar com permissões convertidas
    perfil_dict = {
        "id": db_perfil.id,
        "nome": db_perfil.nome,
        "descricao": db_perfil.descricao,
        "permissoes": json.loads(db_perfil.permissoes),
        "ativo": db_perfil.ativo,
        "editavel": db_perfil.editavel,
        "created_at": db_perfil.created_at,
        "updated_at": db_perfil.updated_at
    }
    
    return perfil_dict

@router.put("/{perfil_id}", response_model=PerfilResponse)
def atualizar_perfil(
    perfil_id: int,
    perfil_update: PerfilUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Atualizar um perfil existente"""
    db_perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    
    if not db_perfil:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil não encontrado"
        )
    
    # Não permitir editar perfil Administrador
    if not db_perfil.editavel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este perfil não pode ser editado"
        )
    
    # Atualizar campos fornecidos
    update_data = perfil_update.model_dump(exclude_unset=True)
    
    # Log para debug
    print(f"[DEBUG] Dados recebidos para atualização do perfil {perfil_id}:")
    print(f"[DEBUG] update_data = {update_data}")
    
    # Se está atualizando nome, verificar se já existe
    if "nome" in update_data and update_data["nome"] != db_perfil.nome:
        existing_perfil = db.query(Perfil).filter(
            Perfil.nome == update_data["nome"],
            Perfil.id != perfil_id
        ).first()
        if existing_perfil:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe um perfil com este nome"
            )
    
    # Converter permissões para JSON string se fornecidas
    # model_dump() já converte Permissoes para dict, então apenas fazemos json.dumps
    if "permissoes" in update_data and update_data["permissoes"]:
        print(f"[DEBUG] Permissões antes da conversão: {update_data['permissoes']}")
        update_data["permissoes"] = json.dumps(update_data["permissoes"])
        print(f"[DEBUG] Permissões após conversão JSON: {update_data['permissoes']}")
    
    # Aplicar atualizações
    for key, value in update_data.items():
        setattr(db_perfil, key, value)
    
    # Log antes do commit
    print(f"[DEBUG] Valor no banco antes do commit - permissoes: {db_perfil.permissoes}")
    
    db.commit()
    db.refresh(db_perfil)
    
    # Log após commit
    print(f"[DEBUG] Valor no banco após commit - permissoes: {db_perfil.permissoes}")
    
    # Retornar com permissões convertidas
    perfil_dict = {
        "id": db_perfil.id,
        "nome": db_perfil.nome,
        "descricao": db_perfil.descricao,
        "permissoes": json.loads(db_perfil.permissoes),
        "ativo": db_perfil.ativo,
        "editavel": db_perfil.editavel,
        "created_at": db_perfil.created_at,
        "updated_at": db_perfil.updated_at
    }
    
    print(f"[DEBUG] Resposta sendo enviada: {perfil_dict}")
    
    return perfil_dict

@router.delete("/{perfil_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_perfil(
    perfil_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Deletar um perfil"""
    db_perfil = db.query(Perfil).filter(Perfil.id == perfil_id).first()
    
    if not db_perfil:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil não encontrado"
        )
    
    # Não permitir deletar perfil Administrador
    if not db_perfil.editavel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este perfil não pode ser deletado"
        )
    
    # Verificar se há usuários usando este perfil
    usuarios_count = db.query(Usuario).filter(Usuario.perfil_id == perfil_id).count()
    if usuarios_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não é possível deletar este perfil pois {usuarios_count} usuário(s) estão usando-o"
        )
    
    db.delete(db_perfil)
    db.commit()
    
    return None
