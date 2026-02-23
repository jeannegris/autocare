from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from db import get_db
from models.autocare_models import Cliente, Veiculo, OrdemServico, Produto

router = APIRouter()

@router.get("/resumo")
def dashboard_resumo(db: Session = Depends(get_db)):
    """Resumo geral do sistema para dashboard"""
    
    try:
        # Contadores gerais
        total_clientes = db.query(Cliente).filter(Cliente.ativo == True).count()
        total_veiculos = db.query(Veiculo).filter(Veiculo.ativo == True).count() 
        total_produtos = db.query(Produto).filter(Produto.ativo == True).count()
        
        # Ordens de serviço
        ordens_abertas = db.query(OrdemServico).filter(OrdemServico.status == "Aberta").count()
        ordens_andamento = db.query(OrdemServico).filter(OrdemServico.status == "Em Andamento").count()
        ordens_concluidas_mes = db.query(OrdemServico).filter(
            and_(
                OrdemServico.status == "Concluída",
                func.extract('month', OrdemServico.data_entrega) == datetime.now().month,
                func.extract('year', OrdemServico.data_entrega) == datetime.now().year
            )
        ).count()
        
        # Produtos com estoque baixo
        produtos_estoque_baixo = db.query(Produto).filter(
            and_(
                Produto.quantidade_estoque <= Produto.estoque_minimo,
                Produto.ativo == True
            )
        ).count()
        
        # Faturamento do mês
        inicio_mes = date.today().replace(day=1)
        faturamento_mes = db.query(func.sum(OrdemServico.valor_final)).filter(
            and_(
                OrdemServico.status == "Concluída",
                OrdemServico.data_entrega >= inicio_mes
            )
        ).scalar() or Decimal('0.00')
        
        return {
            "total_clientes": total_clientes,
            "total_veiculos": total_veiculos,
            "total_produtos": total_produtos,
            "ordens_abertas": ordens_abertas,
            "ordens_andamento": ordens_andamento,
            "ordens_concluidas_mes": ordens_concluidas_mes,
            "produtos_estoque_baixo": produtos_estoque_baixo,
            "faturamento_mes": float(faturamento_mes)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar resumo do dashboard: {str(e)}"
        )

@router.get("/vendas-mensais/{ano}")
def vendas_mensais(ano: int, db: Session = Depends(get_db)):
    """Vendas mensais por ano"""
    
    try:
        vendas = db.query(
            func.extract('month', OrdemServico.data_entrega).label('mes'),
            func.sum(OrdemServico.valor_final).label('total')
        ).filter(
            and_(
                OrdemServico.status == "Concluída",
                func.extract('year', OrdemServico.data_entrega) == ano
            )
        ).group_by(func.extract('month', OrdemServico.data_entrega)).all()
        
        # Criar array com 12 meses
        resultado = [0] * 12
        for venda in vendas:
            mes_idx = int(venda.mes) - 1  # Converter para índice 0-11
            resultado[mes_idx] = float(venda.total or 0)
            
        return {
            "ano": ano,
            "vendas_mensais": resultado
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar vendas mensais: {str(e)}"
        )

@router.get("/status-ordens")
def status_ordens(db: Session = Depends(get_db)):
    """Distribuição de ordens por status"""
    
    try:
        status_count = db.query(
            OrdemServico.status,
            func.count(OrdemServico.id).label('quantidade')
        ).group_by(OrdemServico.status).all()
        
        return [
            {
                "status": status.status,
                "quantidade": status.quantidade
            }
            for status in status_count
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar status das ordens: {str(e)}"
        )

@router.get("/produtos-estoque-baixo")
def produtos_estoque_baixo(db: Session = Depends(get_db)):
    """Produtos com estoque baixo"""
    
    try:
        produtos = db.query(Produto).filter(
            and_(
                Produto.quantidade_estoque <= Produto.estoque_minimo,
                Produto.ativo == True
            )
        ).limit(10).all()
        
        return [
            {
                "id": produto.id,
                "nome": produto.nome,
                "estoque_atual": produto.quantidade_estoque,
                "estoque_minimo": produto.estoque_minimo,
                "descricao": f"Estoque atual: {produto.quantidade_estoque}, Mínimo: {produto.estoque_minimo}"
            }
            for produto in produtos
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar produtos com estoque baixo: {str(e)}"
        )

@router.get("/ordens-recentes")
def ordens_recentes(db: Session = Depends(get_db)):
    """Ordens de serviço mais recentes"""
    
    try:
        ordens = db.query(OrdemServico).join(Cliente).join(Veiculo, isouter=True).order_by(
            OrdemServico.data_abertura.desc()
        ).limit(10).all()
        
        resultado = []
        for ordem in ordens:
            resultado.append({
                "id": ordem.id,
                "numero": ordem.numero,
                "cliente_nome": ordem.cliente.nome,
                "veiculo_info": f"{ordem.veiculo.marca} {ordem.veiculo.modelo}" if ordem.veiculo else "N/A",
                "status": ordem.status,
                "valor_total": float(ordem.valor_final or 0),
                "data_abertura": ordem.data_abertura.isoformat() if ordem.data_abertura else None
            })
        
        return resultado
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar ordens recentes: {str(e)}"
        )