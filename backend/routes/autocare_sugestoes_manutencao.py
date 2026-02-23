from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging
from db import get_db
from models.autocare_models import SugestaoManutencao
from schemas.schemas_sugestao_manutencao import (
    SugestaoManutencaoCreate,
    SugestaoManutencaoUpdate,
    SugestaoManutencaoResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/", response_model=List[SugestaoManutencaoResponse])
def listar_sugestoes_manutencao(
    skip: int = 0,
    limit: int = 100,
    ativo: bool = None,
    db: Session = Depends(get_db)
):
    """Listar todas as sugestões de manutenção"""
    query = db.query(SugestaoManutencao)
    
    if ativo is not None:
        query = query.filter(SugestaoManutencao.ativo == ativo)
    
    sugestoes = query.order_by(
        SugestaoManutencao.ordem_exibicao.asc(),
        SugestaoManutencao.nome_peca.asc()
    ).offset(skip).limit(limit).all()
    
    return sugestoes

@router.get("/{sugestao_id}", response_model=SugestaoManutencaoResponse)
def obter_sugestao_manutencao(sugestao_id: int, db: Session = Depends(get_db)):
    """Obter uma sugestão de manutenção por ID"""
    sugestao = db.query(SugestaoManutencao).filter(
        SugestaoManutencao.id == sugestao_id
    ).first()
    
    if not sugestao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sugestão de manutenção não encontrada"
        )
    
    return sugestao

@router.post("/", response_model=SugestaoManutencaoResponse, status_code=status.HTTP_201_CREATED)
def criar_sugestao_manutencao(
    sugestao_data: SugestaoManutencaoCreate,
    db: Session = Depends(get_db)
):
    """Criar nova sugestão de manutenção"""
    try:
        sugestao = SugestaoManutencao(**sugestao_data.dict())
        db.add(sugestao)
        db.commit()
        db.refresh(sugestao)
        
        logger.info(f"✅ Sugestão de manutenção criada: {sugestao.nome_peca} (ID: {sugestao.id})")
        return sugestao
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao criar sugestão de manutenção: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao criar sugestão de manutenção: {str(e)}"
        )

@router.put("/{sugestao_id}", response_model=SugestaoManutencaoResponse)
def atualizar_sugestao_manutencao(
    sugestao_id: int,
    sugestao_data: SugestaoManutencaoUpdate,
    db: Session = Depends(get_db)
):
    """Atualizar sugestão de manutenção existente"""
    sugestao = db.query(SugestaoManutencao).filter(
        SugestaoManutencao.id == sugestao_id
    ).first()
    
    if not sugestao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sugestão de manutenção não encontrada"
        )
    
    try:
        # Atualizar apenas os campos fornecidos
        update_data = sugestao_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(sugestao, field, value)
        
        db.commit()
        db.refresh(sugestao)
        
        logger.info(f"✅ Sugestão de manutenção atualizada: {sugestao.nome_peca} (ID: {sugestao.id})")
        return sugestao
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao atualizar sugestão de manutenção: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao atualizar sugestão de manutenção: {str(e)}"
        )

@router.delete("/{sugestao_id}/", status_code=status.HTTP_204_NO_CONTENT)
def deletar_sugestao_manutencao(sugestao_id: int, db: Session = Depends(get_db)):
    """Deletar sugestão de manutenção permanentemente (hard delete)"""
    sugestao = db.query(SugestaoManutencao).filter(
        SugestaoManutencao.id == sugestao_id
    ).first()
    
    if not sugestao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sugestão de manutenção não encontrada"
        )
    
    try:
        # Hard delete - remove permanentemente do banco
        nome_peca = sugestao.nome_peca
        db.delete(sugestao)
        db.commit()
        
        logger.info(f"✅ Sugestão de manutenção deletada permanentemente: {nome_peca} (ID: {sugestao_id})")
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Erro ao deletar sugestão de manutenção: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao deletar sugestão de manutenção: {str(e)}"
        )
