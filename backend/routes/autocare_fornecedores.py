from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from db import get_db
from models.autocare_models import Fornecedor
from schemas.schemas_fornecedor import (
    FornecedorCreate,
    FornecedorUpdate,
    FornecedorResponse,
    FornecedorList
)

router = APIRouter()

@router.get("/", response_model=List[FornecedorList])
def listar_fornecedores(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Listar fornecedores com filtros opcionais"""
    query = db.query(Fornecedor)
    
    if search:
        query = query.filter(
            Fornecedor.nome.ilike(f"%{search}%") |
            Fornecedor.cnpj.ilike(f"%{search}%") |
            Fornecedor.email.ilike(f"%{search}%")
        )
    
    # Se não for informado `ativo`, por padrão retornamos apenas fornecedores ativos.
    # Se o caller fornecer explicitamente `ativo=True` ou `ativo=False`, respeitamos.
    if ativo is None:
        query = query.filter(Fornecedor.ativo == True)
    else:
        query = query.filter(Fornecedor.ativo == ativo)
    
    fornecedores = query.offset(skip).limit(limit).all()
    return fornecedores

@router.get("/{fornecedor_id}", response_model=FornecedorResponse)
def buscar_fornecedor(fornecedor_id: int, db: Session = Depends(get_db)):
    """Buscar fornecedor por ID"""
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado"
        )
    return fornecedor

@router.post("/", response_model=FornecedorResponse, status_code=status.HTTP_201_CREATED)
def criar_fornecedor(fornecedor_data: FornecedorCreate, db: Session = Depends(get_db)):
    """Criar novo fornecedor"""
    
    # Verificar se CNPJ já existe
    if fornecedor_data.cnpj:
        existing = db.query(Fornecedor).filter(Fornecedor.cnpj == fornecedor_data.cnpj).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CNPJ já cadastrado"
            )
    
    # Verificar se email já existe
    if fornecedor_data.email:
        existing = db.query(Fornecedor).filter(Fornecedor.email == fornecedor_data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail já cadastrado"
            )
    
    fornecedor = Fornecedor(**fornecedor_data.dict())
    db.add(fornecedor)
    db.commit()
    db.refresh(fornecedor)
    return fornecedor

@router.put("/{fornecedor_id}", response_model=FornecedorResponse)
def atualizar_fornecedor(
    fornecedor_id: int,
    fornecedor_data: FornecedorUpdate,
    db: Session = Depends(get_db)
):
    """Atualizar fornecedor existente"""
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado"
        )
    # Verificar se CNPJ já existe em outro fornecedor
    if fornecedor_data.cnpj:
        existing = db.query(Fornecedor).filter(
            Fornecedor.cnpj == fornecedor_data.cnpj,
            Fornecedor.id != fornecedor_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CNPJ já cadastrado em outro fornecedor"
            )
    # Verificar se email já existe em outro fornecedor
    if fornecedor_data.email:
        existing = db.query(Fornecedor).filter(
            Fornecedor.email == fornecedor_data.email,
            Fornecedor.id != fornecedor_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail já cadastrado em outro fornecedor"
            )
    # Atualizar apenas campos não nulos; converter string vazia em None
    update_data = fornecedor_data.dict(exclude_unset=True)
    for k, v in list(update_data.items()):
        if isinstance(v, str) and v.strip() == "":
            update_data[k] = None
    for key, value in update_data.items():
        setattr(fornecedor, key, value)
    db.commit()
    db.refresh(fornecedor)
    return fornecedor

@router.delete("/{fornecedor_id}", response_model=FornecedorResponse)
def deletar_fornecedor(fornecedor_id: int, db: Session = Depends(get_db)):
    """Deletar fornecedor (soft delete) e retornar o registro atualizado."""
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado"
        )
    
    fornecedor.ativo = False
    db.commit()
    db.refresh(fornecedor)
    return fornecedor

@router.post("/{fornecedor_id}/reativar")
def reativar_fornecedor(fornecedor_id: int, db: Session = Depends(get_db)):
    """Reativar fornecedor"""
    fornecedor = db.query(Fornecedor).filter(Fornecedor.id == fornecedor_id).first()
    if not fornecedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado"
        )
    
    fornecedor.ativo = True
    db.commit()
    return {"message": "Fornecedor reativado com sucesso"}