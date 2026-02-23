from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime
import pytz
from db import get_db
from models.autocare_models import Produto, Categoria, MovimentoEstoque, Fornecedor, LoteEstoque, Usuario
from routes.autocare_auth import get_current_user
from schemas.schemas_estoque import (
    ProdutoCreate,
    ProdutoUpdate,
    ProdutoResponse,
    ProdutoList,
    CategoriaCreate,
    CategoriaUpdate,
    CategoriaResponse,
    MovimentacaoEstoqueCreate,
    MovimentacaoEstoqueResponse,
    LoteEstoqueResponse,
    LoteEstoqueList
)

import logging
logger = logging.getLogger(__name__)
router = APIRouter()

# Função para obter usuário opcional (não levanta exceção se não autenticado)
security = HTTPBearer(auto_error=False)

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[Usuario]:
    """Obter usuário atual se autenticado, caso contrário retorna None"""
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except:
        return None

# =============================================================================
# PRODUTOS
# =============================================================================

@router.get("/produtos", response_model=List[ProdutoList])
def listar_produtos(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    categoria: Optional[str] = None,
    fornecedor_id: Optional[int] = None,
    estoque_baixo: bool = False,
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Listar produtos com filtros opcionais"""
    query = db.query(Produto)

    if search:
        query = query.filter(
            or_(
                Produto.codigo.ilike(f"%{search}%"),
                Produto.nome.ilike(f"%{search}%"),
                Produto.descricao.ilike(f"%{search}%")
            )
        )

    if categoria:
        query = query.filter(Produto.categoria == categoria)

    if fornecedor_id:
        query = query.filter(Produto.fornecedor_id == fornecedor_id)

    if estoque_baixo:
        query = query.filter(Produto.quantidade_atual <= Produto.quantidade_minima)

    # Se não for informado `ativo`, por padrão retornamos apenas produtos ativos.
    if ativo is None:
        query = query.filter(Produto.ativo == True)
    else:
        query = query.filter(Produto.ativo == ativo)

    produtos = query.offset(skip).limit(limit).all()

    # Construir lista de saída explicitando os campos esperados pelo schema
    response_list = []
    for p in produtos:
        # Enriquecer com nome do fornecedor (quando presente)
        try:
            if p.fornecedor_id:
                f = db.query(Fornecedor).filter(Fornecedor.id == p.fornecedor_id).first()
                fornecedor_nome = f.nome if f else None
            else:
                fornecedor_nome = None
        except Exception:
            fornecedor_nome = None

        # Obter quantidades com segurança
        qa = getattr(p, 'quantidade_atual', 0) or 0
        qm = getattr(p, 'quantidade_minima', 0) or 0
        try:
            qa_int = int(qa)
        except Exception:
            qa_int = 0
        try:
            qm_int = int(qm)
        except Exception:
            qm_int = 0

        # Calcular status
        if qa_int == 0:
            status_value = 'SEM_ESTOQUE'
        elif qa_int <= qm_int:
            status_value = 'BAIXO_ESTOQUE'
        else:
            status_value = 'DISPONIVEL'

        prod_dict = {
            'id': getattr(p, 'id', None),
            'codigo': getattr(p, 'codigo', None),
            'nome': getattr(p, 'nome', None),
            'descricao': getattr(p, 'descricao', None),
            'categoria': getattr(p, 'categoria', None),
            'unidade': getattr(p, 'unidade', None),
            'fornecedor_id': getattr(p, 'fornecedor_id', None),
            'fornecedor_nome': fornecedor_nome,
            'preco_custo': getattr(p, 'preco_custo', None),
            'preco_venda': getattr(p, 'preco_venda', None),
            'quantidade_atual': getattr(p, 'quantidade_atual', 0),
            'quantidade_minima': getattr(p, 'quantidade_minima', 0),
            'localizacao': getattr(p, 'localizacao', None),
            'ativo': getattr(p, 'ativo', True),
            'status': status_value
        }

        # Log em arquivo e via logger para depuração (não quebra em produção)
        try:
            with open('/var/www/autocare/backend/logs/debug_status.log', 'a') as fh:
                fh.write(f"codigo={getattr(p,'codigo',None)} qa={qa_int} qm={qm_int} status={status_value}\n")
        except Exception:
            pass
        try:
            logger.info(f"[listar_produtos] codigo={getattr(p,'codigo',None)} qa={qa_int} qm={qm_int} status_value={status_value}")
        except Exception:
            pass

        response_list.append(prod_dict)

    return response_list

@router.get("/produtos/{produto_id}", response_model=ProdutoResponse)
def buscar_produto(produto_id: int, db: Session = Depends(get_db)):
    """Buscar produto por ID"""
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado"
        )
    # Enriquecer com nome do fornecedor quando disponível
    try:
        if produto.fornecedor_id:
            f = db.query(Fornecedor).filter(Fornecedor.id == produto.fornecedor_id).first()
            produto.fornecedor_nome = f.nome if f else None
        else:
            produto.fornecedor_nome = None
    except Exception:
        produto.fornecedor_nome = None
    # Garantir que o campo `status` seja calculado e retornado (evitar null)
    try:
        if getattr(produto, 'quantidade_atual', 0) == 0:
            produto.status = 'SEM_ESTOQUE'
        elif getattr(produto, 'quantidade_atual', 0) <= getattr(produto, 'quantidade_minima', 0):
            produto.status = 'BAIXO_ESTOQUE'
        else:
            produto.status = 'DISPONIVEL'
    except Exception:
        # manter valor atual (possivelmente None)
        pass
    return produto

@router.post("/produtos", response_model=ProdutoResponse, status_code=status.HTTP_201_CREATED)
def criar_produto(produto_data: ProdutoCreate, db: Session = Depends(get_db)):
    """Criar novo produto"""
    
    # Verificar se código já existe
    existing = db.query(Produto).filter(Produto.codigo == produto_data.codigo).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código do produto já existe"
        )
    
    # Verificar se fornecedor existe (se fornecido)
    if produto_data.fornecedor_id:
        fornecedor = db.query(Fornecedor).filter(Fornecedor.id == produto_data.fornecedor_id).first()
        if not fornecedor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fornecedor não encontrado"
            )
    
    produto = Produto(**produto_data.dict())
    db.add(produto)
    db.commit()
    db.refresh(produto)
    # Enriquecer com nome do fornecedor (se informado)
    try:
        if produto.fornecedor_id:
            f = db.query(Fornecedor).filter(Fornecedor.id == produto.fornecedor_id).first()
            produto.fornecedor_nome = f.nome if f else None
        else:
            produto.fornecedor_nome = None
    except Exception:
        produto.fornecedor_nome = None
    return produto

@router.put("/produtos/{produto_id}", response_model=ProdutoResponse)
def atualizar_produto(
    produto_id: int,
    produto_data: ProdutoUpdate,
    db: Session = Depends(get_db)
):
    """Atualizar produto existente"""
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado"
        )
    # Verificar se código já existe em outro produto
    if produto_data.codigo:
        existing = db.query(Produto).filter(
            and_(
                Produto.codigo == produto_data.codigo,
                Produto.id != produto_id
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código já existe em outro produto"
            )
    # Atualizar apenas campos não nulos; converter string vazia em None
    update_data = produto_data.dict(exclude_unset=True)
    for k, v in list(update_data.items()):
        if isinstance(v, str) and v.strip() == "":
            update_data[k] = None
    for key, value in update_data.items():
        setattr(produto, key, value)
    db.commit()
    db.refresh(produto)
    # Enriquecer com nome do fornecedor (quando disponível)
    try:
        if produto.fornecedor_id:
            f = db.query(Fornecedor).filter(Fornecedor.id == produto.fornecedor_id).first()
            produto.fornecedor_nome = f.nome if f else None
        else:
            produto.fornecedor_nome = None
    except Exception:
        produto.fornecedor_nome = None
    return produto


@router.delete("/produtos/{produto_id}", response_model=ProdutoResponse)
def deletar_produto(produto_id: int, db: Session = Depends(get_db)):
    """Excluir (soft-delete) produto: marcar como inativo"""
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado"
        )
    # Soft-delete: marcar como inativo
    produto.ativo = False
    db.commit()
    db.refresh(produto)
    try:
        produto.fornecedor_nome = produto.fornecedor.nome if getattr(produto, 'fornecedor', None) else None
    except Exception:
        produto.fornecedor_nome = None
    return produto

# =============================================================================
# CATEGORIAS
# =============================================================================

@router.get("/categorias", response_model=List[CategoriaResponse])
def listar_categorias(
    skip: int = 0,
    limit: int = 100,
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Listar categorias"""
    query = db.query(Categoria)
    
    if ativo is not None:
        query = query.filter(Categoria.ativo == ativo)
    
    categorias = query.offset(skip).limit(limit).all()
    return categorias

@router.post("/categorias", response_model=CategoriaResponse, status_code=status.HTTP_201_CREATED)
def criar_categoria(categoria_data: CategoriaCreate, db: Session = Depends(get_db)):
    """Criar nova categoria"""
    
    # Verificar se nome já existe
    existing = db.query(Categoria).filter(Categoria.nome == categoria_data.nome).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome da categoria já existe"
        )
    
    categoria = Categoria(**categoria_data.dict())
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria

# =============================================================================
# MOVIMENTAÇÃO DE ESTOQUE
# =============================================================================

@router.get("/movimentos", response_model=List[MovimentacaoEstoqueResponse])
def listar_movimentos_estoque(
    skip: int = 0,
    limit: int = 100,
    produto_id: Optional[int] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar movimentações de estoque"""
    query = db.query(MovimentoEstoque)
    
    if produto_id:
        query = query.filter(MovimentoEstoque.item_id == produto_id)
    
    if tipo:
        query = query.filter(MovimentoEstoque.tipo == tipo)
    
    movimentos = query.order_by(MovimentoEstoque.data_movimentacao.desc()).offset(skip).limit(limit).all()
    
    # Enriquecer com nome do fornecedor
    for mov in movimentos:
        if mov.fornecedor_id:
            fornecedor = db.query(Fornecedor).filter(Fornecedor.id == mov.fornecedor_id).first()
            mov.fornecedor_nome = fornecedor.nome if fornecedor else None
        else:
            mov.fornecedor_nome = None
    
    return movimentos

@router.post("/movimentos", response_model=MovimentacaoEstoqueResponse, status_code=status.HTTP_201_CREATED)
def criar_movimento_estoque(
    movimento_data: MovimentacaoEstoqueCreate, 
    db: Session = Depends(get_db),
    current_user: Optional[Usuario] = Depends(get_current_user_optional)
):
    """Registrar movimento de estoque com controle de lotes FIFO"""
    
    # Verificar se produto existe
    produto = db.query(Produto).filter(Produto.id == movimento_data.item_id).first()
    if not produto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado"
        )
    
    # Verificar se fornecedor existe (se fornecido)
    if movimento_data.fornecedor_id:
        fornecedor = db.query(Fornecedor).filter(Fornecedor.id == movimento_data.fornecedor_id).first()
        if not fornecedor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fornecedor não encontrado"
            )
    
    # Criar movimento com timezone correto
    tz = pytz.timezone('America/Sao_Paulo')
    movimento_dict = movimento_data.dict()
    movimento_dict['data_movimentacao'] = datetime.now(tz)
    # Adicionar informações do usuário se autenticado
    if current_user:
        movimento_dict['usuario_id'] = current_user.id
        movimento_dict['usuario_nome'] = current_user.nome
    movimento = MovimentoEstoque(**movimento_dict)
    db.add(movimento)
    db.flush()  # Para obter o ID do movimento
    
    if movimento_data.tipo == "ENTRADA":
        # ENTRADA: Criar novo lote
        quantidade_entrada = movimento_data.quantidade
        produto.quantidade_atual += quantidade_entrada
        
        # Atualizar preços do produto se fornecidos na movimentação
        if movimento_data.preco_custo and movimento_data.preco_custo > 0:
            produto.preco_custo = movimento_data.preco_custo
        if movimento_data.preco_venda and movimento_data.preco_venda > 0:
            produto.preco_venda = movimento_data.preco_venda
        
        # Criar novo lote
        novo_lote = LoteEstoque(
            produto_id=produto.id,
            movimento_entrada_id=movimento.id,
            fornecedor_id=movimento_data.fornecedor_id,
            quantidade_inicial=quantidade_entrada,
            saldo_atual=quantidade_entrada,
            preco_custo_unitario=movimento_data.preco_custo or 0,
            preco_venda_unitario=movimento_data.preco_venda,
            margem_lucro=movimento_data.margem_lucro,
            data_entrada=datetime.now(tz),
            numero_lote=f"LOTE-{produto.id}-{datetime.now(tz).strftime('%Y%m%d%H%M%S')}",
            ativo=True
        )
        db.add(novo_lote)
        
    elif movimento_data.tipo == "SAIDA":
        # SAIDA: Consumir dos lotes mais antigos (FIFO)
        quantidade_saida = movimento_data.quantidade
        
        # Buscar lotes disponíveis ordenados por data de entrada (FIFO)
        lotes_disponiveis = db.query(LoteEstoque).filter(
            and_(
                LoteEstoque.produto_id == produto.id,
                LoteEstoque.saldo_atual > 0,
                LoteEstoque.ativo == True
            )
        ).order_by(LoteEstoque.data_entrada.asc()).all()
        
        # Verificar se há estoque suficiente
        estoque_total = sum(lote.saldo_atual for lote in lotes_disponiveis)
        if estoque_total < quantidade_saida:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Estoque insuficiente. Disponível: {estoque_total}, Solicitado: {quantidade_saida}"
            )
        
        # Consumir dos lotes (FIFO)
        quantidade_restante = quantidade_saida
        custo_total = 0
        
        for lote in lotes_disponiveis:
            if quantidade_restante <= 0:
                break
                
            if lote.saldo_atual >= quantidade_restante:
                # Este lote tem estoque suficiente
                consumo = quantidade_restante
                lote.saldo_atual -= consumo
                custo_total += consumo * lote.preco_custo_unitario
                quantidade_restante = 0
            else:
                # Este lote será consumido completamente
                consumo = lote.saldo_atual
                custo_total += consumo * lote.preco_custo_unitario
                quantidade_restante -= consumo
                lote.saldo_atual = 0
        
        # Atualizar quantidade do produto
        produto.quantidade_atual -= quantidade_saida
        
        # Atualizar o custo no movimento baseado no custo FIFO
        if quantidade_saida > 0:
            movimento.preco_custo = custo_total / quantidade_saida
    
    db.commit()
    db.refresh(movimento)
    return movimento

@router.get("/produtos/estoque-baixo", response_model=List[ProdutoList])
def produtos_estoque_baixo(db: Session = Depends(get_db)):
    """Listar produtos com estoque baixo"""
    produtos = db.query(Produto).filter(
        and_(
            Produto.quantidade_atual <= Produto.quantidade_minima,
            Produto.ativo == True
        )
    ).all()
    for p in produtos:
        try:
            if p.fornecedor_id:
                f = db.query(Fornecedor).filter(Fornecedor.id == p.fornecedor_id).first()
                p.fornecedor_nome = f.nome if f else None
            else:
                p.fornecedor_nome = None
        except Exception:
            p.fornecedor_nome = None
    return produtos

@router.post("/produtos/{produto_id}/ajuste-estoque")
def ajustar_estoque(
    produto_id: int,
    novo_estoque: int,
    motivo: str = "Ajuste manual",
    db: Session = Depends(get_db)
):
    """Ajustar estoque de um produto"""
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado"
        )
    
    if novo_estoque < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Estoque não pode ser negativo"
        )
    
    estoque_anterior = produto.quantidade_atual
    diferenca = novo_estoque - estoque_anterior
    
    if diferenca != 0:
        # Criar movimento de ajuste
        tipo = "ENTRADA" if diferenca > 0 else "SAIDA"
        quantidade = abs(diferenca)
        
        tz = pytz.timezone('America/Sao_Paulo')
        movimento = MovimentoEstoque(
            item_id=produto_id,
            tipo=tipo,
            quantidade=quantidade,
            motivo=motivo,
            observacoes=f"Ajuste de estoque: {estoque_anterior} → {novo_estoque}",
            data_movimentacao=datetime.now(tz)
        )
        db.add(movimento)
        
        # Atualizar estoque do produto
        produto.quantidade_atual = novo_estoque
        db.commit()
    
    return {
        "message": "Estoque ajustado com sucesso",
        "estoque_anterior": estoque_anterior,
        "novo_estoque": novo_estoque,
        "diferenca": diferenca
    }

# =============================================================================
# LOTES DE ESTOQUE
# =============================================================================

@router.get("/produtos/{produto_id}/lotes", response_model=List[LoteEstoqueList])
def listar_lotes_produto(
    produto_id: int,
    apenas_disponiveis: bool = True,
    db: Session = Depends(get_db)
):
    """Listar lotes de um produto específico"""
    
    # Verificar se produto existe
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado"
        )
    
    # Consultar lotes
    query = db.query(LoteEstoque).filter(LoteEstoque.produto_id == produto_id)
    
    if apenas_disponiveis:
        query = query.filter(
            and_(
                LoteEstoque.saldo_atual > 0,
                LoteEstoque.ativo == True
            )
        )
    
    lotes = query.order_by(LoteEstoque.data_entrada.asc()).all()
    
    # Enriquecer com nome do fornecedor
    for lote in lotes:
        if lote.fornecedor_id:
            fornecedor = db.query(Fornecedor).filter(Fornecedor.id == lote.fornecedor_id).first()
            lote.fornecedor_nome = fornecedor.nome if fornecedor else None
        else:
            lote.fornecedor_nome = None
    
    return lotes

@router.get("/lotes/{lote_id}", response_model=LoteEstoqueResponse)
def buscar_lote(lote_id: int, db: Session = Depends(get_db)):
    """Buscar detalhes de um lote específico"""
    
    lote = db.query(LoteEstoque).filter(LoteEstoque.id == lote_id).first()
    if not lote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote não encontrado"
        )
    
    # Enriquecer com dados adicionais
    if lote.produto_id:
        produto = db.query(Produto).filter(Produto.id == lote.produto_id).first()
        lote.produto_nome = produto.nome if produto else None
    
    if lote.fornecedor_id:
        fornecedor = db.query(Fornecedor).filter(Fornecedor.id == lote.fornecedor_id).first()
        lote.fornecedor_nome = fornecedor.nome if fornecedor else None
    
    return lote

@router.get("/lotes", response_model=List[LoteEstoqueList])
def listar_todos_lotes(
    skip: int = 0,
    limit: int = 100,
    apenas_disponiveis: bool = True,
    fornecedor_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Listar todos os lotes do estoque"""
    
    query = db.query(LoteEstoque)
    
    if apenas_disponiveis:
        query = query.filter(
            and_(
                LoteEstoque.saldo_atual > 0,
                LoteEstoque.ativo == True
            )
        )
    
    if fornecedor_id:
        query = query.filter(LoteEstoque.fornecedor_id == fornecedor_id)
    
    lotes = query.order_by(LoteEstoque.data_entrada.desc()).offset(skip).limit(limit).all()
    
    # Enriquecer com nome do fornecedor
    for lote in lotes:
        if lote.fornecedor_id:
            fornecedor = db.query(Fornecedor).filter(Fornecedor.id == lote.fornecedor_id).first()
            lote.fornecedor_nome = fornecedor.nome if fornecedor else None
        else:
            lote.fornecedor_nome = None
    
    return lotes
