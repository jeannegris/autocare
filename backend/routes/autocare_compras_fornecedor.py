from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime, timezone
from typing import List

from db import get_db
from models.autocare_models import (
    CompraFornecedor, ItemCompraFornecedor, Fornecedor, Produto,
    MovimentoEstoque, LoteEstoque
)
from schemas.schemas_compra_fornecedor import (
    CompraFornecedorCreate, CompraFornecedorResponse,
    CompraFornecedorList, CompraFornecedorUpdate
)

router = APIRouter(
    tags=["compras-fornecedor"]
)


@router.post("/", response_model=CompraFornecedorResponse)
def criar_compra_fornecedor(
    compra_data: CompraFornecedorCreate,
    db: Session = Depends(get_db)
):
    """
    Criar nova compra de fornecedor.
    
    - Valida fornecedor
    - Calcula frete rateado e preços de venda a partir da margem
    - Cria movimentos de entrada e lotes de estoque
    - Atualiza quantidade atual dos produtos
    """
    
    # Validar fornecedor
    fornecedor = db.query(Fornecedor).filter(
        Fornecedor.id == compra_data.fornecedor_id
    ).first()
    if not fornecedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fornecedor não encontrado"
        )
    
    # Validar produtos e calcular totais
    total_quantidade = 0
    total_valor_itens = Decimal('0.00')
    itens_validos = []
    
    for item_data in compra_data.itens:
        produto = db.query(Produto).filter(
            Produto.id == item_data.produto_id
        ).first()
        if not produto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto com ID {item_data.produto_id} não encontrado"
            )
        
        total_quantidade += item_data.quantidade
        
        # Calcular preço de venda baseado em margem (se aplicável)
        preco_venda = item_data.preco_venda_unitario
        if preco_venda is None and item_data.margem_lucro is not None:
            # Fórmula: preco_venda = preco_custo * (1 + margem / 100)
            margem_decimal = item_data.margem_lucro / Decimal('100')
            preco_venda = item_data.preco_custo_unitario * (Decimal('1') + margem_decimal)
        
        valor_item = (item_data.preco_custo_unitario or Decimal('0.00')) * Decimal(item_data.quantidade)
        total_valor_itens += valor_item
        
        itens_validos.append({
            'produto': produto,
            'quantidade': item_data.quantidade,
            'preco_custo_unitario': item_data.preco_custo_unitario,
            'preco_venda_unitario': preco_venda,
            'margem_lucro': item_data.margem_lucro,
            'valor_item': valor_item
        })
    
    if total_quantidade == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantidade total deve ser maior que zero"
        )
    
    # Calcular frete rateado por unidade
    frete_unitario = Decimal('0.00')
    if compra_data.valor_frete and compra_data.valor_frete > 0:
        frete_unitario = compra_data.valor_frete / Decimal(total_quantidade)
    
    valor_total = total_valor_itens + (compra_data.valor_frete or Decimal('0.00'))
    
    # Criar registro de compra
    compra = CompraFornecedor(
        numero_nota=compra_data.numero_nota,
        fornecedor_id=compra_data.fornecedor_id,
        data_compra=datetime.now(timezone.utc),
        valor_total_itens=total_valor_itens,
        valor_frete=compra_data.valor_frete or Decimal('0.00'),
        valor_total=valor_total,
        observacoes=compra_data.observacoes,
        usuario_id=None,  # Será preenchido pelo frontend se houver autenticação
        usuario_nome="Sistema"  # Padrão
    )
    
    db.add(compra)
    db.flush()  # Para obter o ID da compra
    
    # Criar itens e movimentos de estoque
    for item_info in itens_validos:
        produto = item_info['produto']
        quantidade = item_info['quantidade']
        preco_custo_unit = item_info['preco_custo_unitario']
        preco_venda = item_info['preco_venda_unitario']
        margem = item_info['margem_lucro']
        
        # Custo total com frete incluído
        preco_custo_total = preco_custo_unit + frete_unitario
        
        # Valor total do item (quantidade * preço de venda ou custo)
        valor_item_total = (
            quantidade * preco_venda if preco_venda 
            else quantidade * preco_custo_total
        )
        
        # Criar item de compra
        item_compra = ItemCompraFornecedor(
            compra_id=compra.id,
            produto_id=produto.id,
            quantidade=quantidade,
            preco_custo_unitario=preco_custo_unit,
            preco_venda_unitario=preco_venda,
            margem_lucro=margem,
            frete_unitario_rateado=frete_unitario,
            preco_custo_total=preco_custo_total,
            valor_total=valor_item_total
        )
        db.add(item_compra)
        
        # Criar movimento de estoque (ENTRADA)
        movimento = MovimentoEstoque(
            item_id=produto.id,
            fornecedor_id=fornecedor.id,
            tipo='ENTRADA',
            quantidade=quantidade,
            preco_unitario=preco_custo_unit,
            preco_custo=preco_custo_total,  # Custo com frete incluído
            preco_venda=preco_venda,
            margem_lucro=margem,
            valor_total=quantidade * preco_custo_total,
            motivo='Compra de fornecedor',
            observacoes=f"Nota: {compra_data.numero_nota}" if compra_data.numero_nota else None,
            usuario_nome="Sistema",
            data_movimentacao=datetime.now(timezone.utc)
        )
        db.add(movimento)
        db.flush()  # Para obter o ID do movimento
        
        # Criar lote de estoque
        lote = LoteEstoque(
            produto_id=produto.id,
            movimento_entrada_id=movimento.id,
            fornecedor_id=fornecedor.id,
            quantidade_inicial=quantidade,
            saldo_atual=quantidade,
            preco_custo_unitario=preco_custo_total,  # Com frete
            preco_venda_unitario=preco_venda,
            margem_lucro=margem,
            data_entrada=datetime.now(timezone.utc),
            numero_lote=compra_data.numero_nota
        )
        db.add(lote)
        
        # Atualizar quantidade atual do produto
        produto.quantidade_atual += quantidade
        produto.preco_custo = preco_custo_total
        if preco_venda:
            produto.preco_venda = preco_venda
        db.add(produto)
    
    db.commit()
    db.refresh(compra)
    
    return compra


@router.get("/", response_model=List[CompraFornecedorList])
def listar_compras_fornecedor(
    fornecedor_id: int = Query(None),
    data_inicio: str = Query(None),
    data_fim: str = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Listar compras de fornecedores com filtros opcionais.
    """
    query = db.query(CompraFornecedor)
    
    if fornecedor_id:
        query = query.filter(CompraFornecedor.fornecedor_id == fornecedor_id)
    
    if data_inicio:
        try:
            inicio = datetime.fromisoformat(data_inicio)
            query = query.filter(CompraFornecedor.data_compra >= inicio)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de data_inicio inválido (use ISO format)"
            )
    
    if data_fim:
        try:
            fim = datetime.fromisoformat(data_fim)
            query = query.filter(CompraFornecedor.data_compra <= fim)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de data_fim inválido (use ISO format)"
            )
    
    # Ordenar por data desc (mais recentes primeiro)
    query = query.order_by(CompraFornecedor.data_compra.desc())
    
    total = query.count()
    compras = query.limit(limit).offset(offset).all()
    
    resultado = []
    for compra in compras:
        resultado.append({
            'id': compra.id,
            'numero_nota': compra.numero_nota,
            'fornecedor_id': compra.fornecedor_id,
            'fornecedor_nome': compra.fornecedor.nome,
            'data_compra': compra.data_compra,
            'valor_total_itens': compra.valor_total_itens,
            'valor_frete': compra.valor_frete,
            'valor_total': compra.valor_total,
            'quantidade_itens': len(compra.itens),
            'usuario_nome': compra.usuario_nome
        })
    
    return resultado


@router.get("/{compra_id}", response_model=CompraFornecedorResponse)
def obter_compra_fornecedor(
    compra_id: int,
    db: Session = Depends(get_db)
):
    """
    Obter detalhes de uma compra de fornecedor com informações dos produtos.
    """
    compra = db.query(CompraFornecedor).filter(
        CompraFornecedor.id == compra_id
    ).first()
    
    if not compra:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compra não encontrada"
        )
    
    # Enriquecer os itens com nomes dos produtos
    compra_dict = {
        'id': compra.id,
        'numero_nota': compra.numero_nota,
        'fornecedor_id': compra.fornecedor_id,
        'data_compra': compra.data_compra,
        'valor_total_itens': compra.valor_total_itens,
        'valor_frete': compra.valor_frete,
        'valor_total': compra.valor_total,
        'observacoes': compra.observacoes,
        'usuario_nome': compra.usuario_nome,
        'created_at': compra.created_at,
        'updated_at': compra.updated_at,
        'itens': [
            {
                'id': item.id,
                'produto_id': item.produto_id,
                'quantidade': item.quantidade,
                'preco_custo_unitario': item.preco_custo_unitario,
                'preco_venda_unitario': item.preco_venda_unitario,
                'margem_lucro': item.margem_lucro,
                'frete_unitario_rateado': item.frete_unitario_rateado,
                'preco_custo_total': item.preco_custo_total,
                'valor_total': item.valor_total,
                'produto_nome': item.produto.nome if item.produto else None
            }
            for item in compra.itens
        ]
    }
    
    return compra_dict


@router.delete("/{compra_id}")
def deletar_compra_fornecedor(
    compra_id: int,
    db: Session = Depends(get_db)
):
    """
    Deletar uma compra de fornecedor.
    
    ATENÇÃO: Esta operação também desfaz os movimentos de estoque e lotes criados.
    """
    compra = db.query(CompraFornecedor).filter(
        CompraFornecedor.id == compra_id
    ).first()
    
    if not compra:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compra não encontrada"
        )
    
    # Reverter movimentos de estoque e lotes
    for item in compra.itens:
        # Encontrar movimento de entrada associado
        movimento = db.query(MovimentoEstoque).filter(
            MovimentoEstoque.item_id == item.produto_id,
            MovimentoEstoque.tipo == 'ENTRADA',
            MovimentoEstoque.created_at == compra.created_at  # Aproximado
        ).first()
        
        if movimento:
            # Encontrar e deletar lote
            lote = db.query(LoteEstoque).filter(
                LoteEstoque.movimento_entrada_id == movimento.id
            ).first()
            
            if lote:
                # Revertir quantidade do produto
                produto = db.query(Produto).filter(
                    Produto.id == item.produto_id
                ).first()
                if produto:
                    produto.quantidade_atual -= item.quantidade
                    db.add(produto)
                
                db.delete(lote)
            
            db.delete(movimento)
    
    db.delete(compra)
    db.commit()
    
    return {"message": "Compra deletada com sucesso"}
