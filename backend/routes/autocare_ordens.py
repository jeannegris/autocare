from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func, or_
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date
import pytz
import logging
from db import get_db
from models.autocare_models import OrdemServico, ItemOrdem, Cliente, Veiculo, Produto, MovimentoEstoque, LoteEstoque, ManutencaoHistorico
from schemas.schemas_ordem import (
    OrdemServicoNovaCreate,
    OrdemServicoNovaUpdate,
    OrdemServicoNovaResponse,
    OrdemServicoNovaList,
    ItemOrdemNovaCreate,
    ItemOrdemNovaResponse,
    ClienteBuscaRequest,
    ClienteBuscaResponse,
    VeiculoBuscaRequest,
    VeiculoBuscaResponse,
    ProdutoAutocomplete
)

from fastapi import Request
from pydantic import ValidationError
logger = logging.getLogger(__name__)
router = APIRouter()

def gerar_numero_ordem(db: Session) -> str:
    """Gerar próximo número de ordem sequencial"""
    ultimo_numero = db.query(func.max(OrdemServico.numero)).scalar()
    
    if ultimo_numero:
        try:
            proximo = int(ultimo_numero) + 1
        except:
            # Se não conseguir converter, usar timestamp
            proximo = int(datetime.now().strftime("%Y%m%d%H%M%S"))[-8:]
    else:
        proximo = 1
    
    return str(proximo).zfill(8)

def consumir_lotes_fifo(db: Session, produto_id: int, quantidade_saida) -> float:
    """
    Consumir lotes via FIFO e retornar o custo médio
    
    Args:
        db: Sessão do banco
        produto_id: ID do produto
        quantidade_saida: Quantidade a ser consumida (float, int ou Decimal)
        
    Returns:
        Custo médio unitário da saída (baseado nos lotes consumidos)
    """
    # Converter quantidade para float
    qtd_saida = float(quantidade_saida)
    
    # Buscar lotes disponíveis ordenados por data de entrada (FIFO)
    lotes_disponiveis = db.query(LoteEstoque).filter(
        and_(
            LoteEstoque.produto_id == produto_id,
            LoteEstoque.saldo_atual > 0,
            LoteEstoque.ativo == True
        )
    ).order_by(LoteEstoque.data_entrada.asc()).all()
    
    # Verificar se há estoque suficiente
    estoque_total = sum(float(lote.saldo_atual) for lote in lotes_disponiveis)
    if estoque_total < qtd_saida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estoque insuficiente. Disponível: {estoque_total}, Solicitado: {qtd_saida}"
        )
    
    # Consumir dos lotes (FIFO)
    quantidade_restante = qtd_saida
    custo_total = 0.0
    
    for lote in lotes_disponiveis:
        if quantidade_restante <= 0:
            break
            
        saldo_lote = float(lote.saldo_atual)
        
        if saldo_lote >= quantidade_restante:
            # Este lote tem estoque suficiente
            consumo = quantidade_restante
            lote.saldo_atual = saldo_lote - consumo
            custo_total += consumo * float(lote.preco_custo_unitario)
            quantidade_restante = 0
        else:
            # Este lote será consumido completamente
            consumo = saldo_lote
            custo_total += consumo * float(lote.preco_custo_unitario)
            quantidade_restante -= consumo
            lote.saldo_atual = 0.0
    
    # Retornar custo médio unitário
    return custo_total / qtd_saida if qtd_saida > 0 else 0.0

@router.post("/buscar-cliente", response_model=ClienteBuscaResponse)
def buscar_cliente_para_ordem_post(busca: ClienteBuscaRequest, db: Session = Depends(get_db)):
    """Buscar cliente por CPF, CNPJ ou telefone para ordem de serviço (POST)"""
    logger.info(f"🔍 POST Recebido request de busca: {busca}")
    return buscar_cliente_comum(busca.termo_busca, db)

@router.get("/buscar-cliente", response_model=ClienteBuscaResponse)
def buscar_cliente_para_ordem_get(documento: str, db: Session = Depends(get_db)):
    """Buscar cliente por CPF, CNPJ ou telefone para ordem de serviço (GET)"""
    logger.info(f"🔍 GET Recebido request de busca: documento={documento}")
    busca = ClienteBuscaRequest(termo_busca=documento)
    return buscar_cliente_comum(documento, db)

def validar_cpf(cpf: str) -> bool:
    """Valida CPF usando algoritmo oficial"""
    cpf = ''.join(filter(str.isdigit, cpf))
    
    if len(cpf) != 11:
        return False
    
    # Verificar se todos os dígitos são iguais
    if cpf == cpf[0] * 11:
        return False
    
    # Calcular primeiro dígito verificador
    soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto
    
    if digito1 != int(cpf[9]):
        return False
    
    # Calcular segundo dígito verificador
    soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto
    
    return digito2 == int(cpf[10])

def buscar_cliente_comum(termo_busca: str, db: Session):
    """Função comum para busca de cliente"""
    termo = termo_busca.strip()
    logger.info(f"📋 Termo após strip: '{termo}'")
    
    if not termo:
        logger.warning("❌ Termo de busca vazio")
        return ClienteBuscaResponse(
            encontrado=False,
            message="Termo de busca não pode estar vazio"
        )
    
    # Remove caracteres especiais para busca mais flexível
    termo_limpo = ''.join(filter(str.isalnum, termo))
    logger.info(f"🧹 Termo limpo: '{termo_limpo}'")
    
    # Determinar se é CPF ou telefone para 11 dígitos
    buscar_como_cpf = True
    if len(termo_limpo) == 11:
        # Se tem 11 dígitos, verificar se é CPF válido
        if not validar_cpf(termo_limpo):
            # Se não for CPF válido, tratar como telefone
            buscar_como_cpf = False
            logger.info(f"📱 11 dígitos inválidos como CPF, tratando como telefone: '{termo_limpo}'")
        else:
            logger.info(f"📄 11 dígitos válidos como CPF: '{termo_limpo}'")
    
    # Construir query baseada no tipo detectado
    if buscar_como_cpf or len(termo_limpo) != 11:
        # Buscar por CPF/CNPJ
        cliente = db.query(Cliente).filter(
            func.regexp_replace(Cliente.cpf_cnpj, '[^0-9]', '', 'g') == termo_limpo
        ).filter(Cliente.ativo == True).first()
    else:
        # Buscar apenas por telefone
        cliente = db.query(Cliente).filter(
            or_(
                func.regexp_replace(Cliente.telefone, '[^0-9]', '', 'g') == termo_limpo,
                func.regexp_replace(Cliente.telefone2, '[^0-9]', '', 'g') == termo_limpo,
                func.regexp_replace(Cliente.whatsapp, '[^0-9]', '', 'g') == termo_limpo
            )
        ).filter(Cliente.ativo == True).first()
    
    # Se não encontrou e é 11 dígitos, tentar a busca alternativa
    if not cliente and len(termo_limpo) == 11:
        if buscar_como_cpf:
            # Tentou CPF, agora tentar telefone
            logger.info("🔄 CPF não encontrado, tentando como telefone...")
            cliente = db.query(Cliente).filter(
                or_(
                    func.regexp_replace(Cliente.telefone, '[^0-9]', '', 'g') == termo_limpo,
                    func.regexp_replace(Cliente.telefone2, '[^0-9]', '', 'g') == termo_limpo,
                    func.regexp_replace(Cliente.whatsapp, '[^0-9]', '', 'g') == termo_limpo
                )
            ).filter(Cliente.ativo == True).first()
        else:
            # Tentou telefone, agora tentar CPF
            logger.info("🔄 Telefone não encontrado, tentando como CPF...")
            cliente = db.query(Cliente).filter(
                func.regexp_replace(Cliente.cpf_cnpj, '[^0-9]', '', 'g') == termo_limpo
            ).filter(Cliente.ativo == True).first()
    
    if not cliente:
        logger.info(f"❌ Cliente não encontrado para termo: '{termo}'")
        return ClienteBuscaResponse(
            encontrado=False,
            message="Cliente não encontrado. Deseja cadastrar um novo cliente?"
        )
    
    logger.info(f"✅ Cliente encontrado: {cliente.nome} (ID: {cliente.id})")
    
    # Buscar veículos do cliente
    veiculos = db.query(Veiculo).filter(
        and_(
            Veiculo.cliente_id == cliente.id,
            Veiculo.ativo == True
        )
    ).all()
    
    veiculos_list = []
    for veiculo in veiculos:
        veiculos_list.append({
            "id": veiculo.id,
            "marca": veiculo.marca,
            "modelo": veiculo.modelo,
            "ano": veiculo.ano,
            "placa": veiculo.placa,
            "cor": veiculo.cor,
            "km_atual": veiculo.km_atual
        })
    
    return ClienteBuscaResponse(
        encontrado=True,
        cliente={
            "id": cliente.id,
            "nome": cliente.nome,
            "cpf_cnpj": cliente.cpf_cnpj,
            "email": cliente.email,
            "telefone": cliente.telefone,
            "telefone2": cliente.telefone2,
            "whatsapp": cliente.whatsapp,
            "veiculos": veiculos_list
        }
    )

@router.post("/buscar-veiculo", response_model=VeiculoBuscaResponse)
def buscar_veiculo_por_placa(busca: VeiculoBuscaRequest, db: Session = Depends(get_db)):
    """Buscar veículo por placa para ordem de serviço"""
    placa = busca.placa.strip().upper()
    logger.info(f"🚗 Buscando veículo por placa: '{placa}'")
    
    if not placa:
        logger.warning("❌ Placa vazia")
        return VeiculoBuscaResponse(
            encontrado=False,
            message="Placa não pode estar vazia"
        )
    
    # Remove caracteres especiais da placa para busca mais flexível
    placa_limpa = ''.join(filter(str.isalnum, placa))
    
    # Buscar veículo por placa
    veiculo = db.query(Veiculo).filter(
        or_(
            Veiculo.placa.ilike(f"%{placa}%"),
            Veiculo.placa.ilike(f"%{placa_limpa}%")
        )
    ).filter(Veiculo.ativo == True).first()
    
    if not veiculo:
        logger.info(f"❌ Veículo não encontrado para placa: '{placa}'")
        return VeiculoBuscaResponse(
            encontrado=False,
            message="Veículo não encontrado com essa placa."
        )
    
    logger.info(f"✅ Veículo encontrado: {veiculo.marca} {veiculo.modelo} - {veiculo.placa}")
    
    # Buscar cliente proprietário
    cliente = db.query(Cliente).filter(
        and_(
            Cliente.id == veiculo.cliente_id,
            Cliente.ativo == True
        )
    ).first()
    
    if not cliente:
        logger.warning(f"⚠️ Cliente não encontrado para veículo ID: {veiculo.id}")
        return VeiculoBuscaResponse(
            encontrado=False,
            message="Proprietário do veículo não encontrado."
        )
    
    # Buscar todos os veículos do cliente
    veiculos_cliente = db.query(Veiculo).filter(
        and_(
            Veiculo.cliente_id == cliente.id,
            Veiculo.ativo == True
        )
    ).all()
    
    veiculos_list = []
    for v in veiculos_cliente:
        veiculos_list.append({
            "id": v.id,
            "marca": v.marca,
            "modelo": v.modelo,
            "ano": v.ano,
            "placa": v.placa,
            "cor": v.cor,
            "km_atual": v.km_atual
        })
    
    return VeiculoBuscaResponse(
        encontrado=True,
        veiculo={
            "id": veiculo.id,
            "marca": veiculo.marca,
            "modelo": veiculo.modelo,
            "ano": veiculo.ano,
            "placa": veiculo.placa,
            "cor": veiculo.cor,
            "km_atual": veiculo.km_atual,
            "combustivel": veiculo.combustivel,
            "chassis": veiculo.chassis,
            "renavam": veiculo.renavam
        },
        cliente={
            "id": cliente.id,
            "nome": cliente.nome,
            "cpf_cnpj": cliente.cpf_cnpj,
            "email": cliente.email,
            "telefone": cliente.telefone,
            "telefone2": cliente.telefone2,
            "whatsapp": cliente.whatsapp,
            "veiculos": veiculos_list
        }
    )

@router.get("/produtos/autocomplete", response_model=List[ProdutoAutocomplete])
def buscar_produtos_autocomplete(
    search: str = "",
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Buscar produtos para autocomplete na ordem de serviço"""
    query = db.query(Produto).filter(
        and_(
            Produto.ativo == True,
            Produto.quantidade_atual > 0  # Só produtos com estoque
        )
    )
    
    if search.strip():
        query = query.filter(
            or_(
                Produto.codigo.ilike(f"%{search}%"),
                Produto.nome.ilike(f"%{search}%"),
                Produto.descricao.ilike(f"%{search}%")
            )
        )
    
    produtos = query.order_by(Produto.nome).limit(limit).all()
    return produtos

@router.get("/produtos/{produto_id}/lotes-disponiveis")
def buscar_lotes_disponiveis_produto(
    produto_id: int,
    db: Session = Depends(get_db)
):
    """Buscar lotes disponíveis de um produto para venda na OS"""
    
    # Verificar se produto existe
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado"
        )
    
    # Buscar lotes com saldo disponível (ordenados por FIFO)
    lotes = db.query(LoteEstoque).filter(
        and_(
            LoteEstoque.produto_id == produto_id,
            LoteEstoque.saldo_atual > 0,
            LoteEstoque.ativo == True
        )
    ).order_by(LoteEstoque.data_entrada.asc()).all()
    
    # Formatar resposta
    lotes_formatados = []
    for lote in lotes:
        lotes_formatados.append({
            "id": lote.id,
            "numero_lote": lote.numero_lote,
            "saldo_atual": float(lote.saldo_atual),
            "preco_venda_unitario": float(lote.preco_venda_unitario) if lote.preco_venda_unitario else float(produto.preco_venda),
            "preco_custo_unitario": float(lote.preco_custo_unitario),
            "data_entrada": lote.data_entrada.isoformat() if lote.data_entrada else None,
            "fornecedor_id": lote.fornecedor_id
        })
    
    return {
        "produto": {
            "id": produto.id,
            "codigo": produto.codigo,
            "nome": produto.nome,
            "unidade": produto.unidade,
            "quantidade_total": float(produto.quantidade_atual)
        },
        "lotes": lotes_formatados,
        "tem_lotes_multiplos": len(set(l["preco_venda_unitario"] for l in lotes_formatados)) > 1
    }

@router.get("/", response_model=List[OrdemServicoNovaList])
def listar_ordens_servico(
    skip: int = 0,
    limit: int = 100,
    cliente_id: Optional[int] = None,
    veiculo_id: Optional[int] = None,
    tipo_ordem: Optional[str] = None,
    status: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar ordens de serviço com filtros"""
    query = db.query(OrdemServico).options(
        joinedload(OrdemServico.cliente),
        joinedload(OrdemServico.veiculo)
    )
    
    if cliente_id:
        query = query.filter(OrdemServico.cliente_id == cliente_id)
    
    if veiculo_id:
        query = query.filter(OrdemServico.veiculo_id == veiculo_id)
    
    if tipo_ordem:
        query = query.filter(OrdemServico.tipo_ordem == tipo_ordem)
    
    if status:
        query = query.filter(OrdemServico.status == status)
    
    # Filtros por data: queremos filtrar pela data exibida ao usuário
    # (usar data_ordem quando presente, caso contrário data_abertura).
    # Além disso, comparar apenas a parte date para que o filtro seja
    # inclusivo para todo o dia selecionado pelo usuário.
    expr_data = func.coalesce(func.date(OrdemServico.data_ordem), OrdemServico.data_abertura)

    if data_inicio:
        try:
            # Esperamos formato YYYY-MM-DD vindo do frontend (input type=date)
            data_start = datetime.fromisoformat(data_inicio).date()
            query = query.filter(expr_data >= data_start)
        except ValueError:
            pass

    if data_fim:
        try:
            data_end = datetime.fromisoformat(data_fim).date()
            query = query.filter(expr_data <= data_end)
        except ValueError:
            pass
    
    ordens = query.order_by(OrdemServico.data_abertura.desc()).offset(skip).limit(limit).all()
    
    # Enriquecer com dados do cliente e veículo
    result = []
    for ordem in ordens:
        # Usar data_ordem (DateTime) se disponível, senão data_abertura (Date)
        data_ordem_completa = ordem.data_ordem if ordem.data_ordem else ordem.data_abertura
        
        ordem_dict = {
            "id": ordem.id,
            "numero": str(ordem.numero) if ordem.numero else "",  # Garantir que seja string
            "cliente_id": ordem.cliente_id,
            "cliente_nome": ordem.cliente.nome if ordem.cliente else None,
            "veiculo_id": ordem.veiculo_id,
            "veiculo_placa": ordem.veiculo.placa if ordem.veiculo else None,
            "tipo_ordem": ordem.tipo_ordem,
            "data_abertura": data_ordem_completa,  # Usar data_ordem com hora completa
            "status": ordem.status,
            "valor_total": ordem.valor_total
        }
        result.append(OrdemServicoNovaList(**ordem_dict))
    
    return result

@router.get("/estatisticas")
def obter_estatisticas_ordens(db: Session = Depends(get_db)):
    """Obter estatísticas das ordens de serviço"""
    try:
        # Contar por status
        total = db.query(OrdemServico).count()
        pendentes = db.query(OrdemServico).filter(OrdemServico.status == "PENDENTE").count()
        em_andamento = db.query(OrdemServico).filter(OrdemServico.status == "EM_ANDAMENTO").count()
        aguardando_peca = db.query(OrdemServico).filter(OrdemServico.status == "AGUARDANDO_PECA").count()
        aguardando_aprovacao = db.query(OrdemServico).filter(OrdemServico.status == "AGUARDANDO_APROVACAO").count()
        concluidas = db.query(OrdemServico).filter(OrdemServico.status == "CONCLUIDA").count()
        canceladas = db.query(OrdemServico).filter(OrdemServico.status == "CANCELADA").count()
        
        # Calcular valores
        resultado_valor_total = db.query(
            func.coalesce(func.sum(OrdemServico.valor_total), 0)
        ).scalar()
        
        resultado_valor_mes = db.query(
            func.coalesce(func.sum(OrdemServico.valor_total), 0)
        ).filter(
            OrdemServico.status == "CONCLUIDA",
            func.extract('month', OrdemServico.created_at) == func.extract('month', func.now()),
            func.extract('year', OrdemServico.created_at) == func.extract('year', func.now())
        ).scalar()
        
        return {
            "total": total,
            "pendentes": pendentes,
            "em_andamento": em_andamento,
            "aguardando_peca": aguardando_peca,
            # Log detalhado para depuração: mostrar totais calculados
            "aguardando_aprovacao": aguardando_aprovacao,
            "concluidas": concluidas,
            "canceladas": canceladas,
            "valor_total": float(resultado_valor_total) if resultado_valor_total else 0.0,
            "valor_mes_atual": float(resultado_valor_mes) if resultado_valor_mes else 0.0
        }
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {e}")
        return {
            "total": 0,
            "pendentes": 0,
            "em_andamento": 0,
            "aguardando_peca": 0,
            "aguardando_aprovacao": 0,
            "concluidas": 0,
            "canceladas": 0,
            "valor_total": 0.0,
            "valor_mes_atual": 0.0
        }

@router.get("/{ordem_id}", response_model=OrdemServicoNovaResponse)
def buscar_ordem_servico(ordem_id: int, db: Session = Depends(get_db)):
    """Buscar ordem de serviço por ID"""
    ordem = db.query(OrdemServico).options(
        joinedload(OrdemServico.cliente),
        joinedload(OrdemServico.veiculo),
        joinedload(OrdemServico.itens).joinedload(ItemOrdem.produto)
    ).filter(OrdemServico.id == ordem_id).first()
    
    if not ordem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ordem de serviço não encontrada"
        )
    
    # Montar resposta com dados relacionados
    # Calcular valor_subtotal já que é uma property readonly que retorna None
    valor_subtotal_calculado = (ordem.valor_pecas or Decimal('0')) + (ordem.valor_servico or Decimal('0'))
    
    response_data = {
        "id": ordem.id,
        "numero": str(ordem.numero) if ordem.numero else "",  # Garantir que seja string
        "cliente_id": ordem.cliente_id,
        "veiculo_id": ordem.veiculo_id,
        "tipo_ordem": ordem.tipo_ordem,
        "data_ordem": ordem.data_ordem,
        "km_veiculo": ordem.km_veiculo,
        "tempo_estimado_horas": ordem.tempo_estimado_horas or Decimal('0'),  # Evitar None
        "descricao_servico": ordem.descricao_servico,
        "valor_servico": ordem.valor_servico,
        "percentual_desconto": ordem.percentual_desconto or Decimal('0'),  # Evitar None
        "tipo_desconto": ordem.tipo_desconto or 'TOTAL',  # Evitar None
        "observacoes": ordem.observacoes,
        "funcionario_responsavel": ordem.funcionario_responsavel,
        "status": ordem.status,
        "data_abertura": ordem.data_abertura,
        "data_conclusao": ordem.data_conclusao,
        "valor_pecas": ordem.valor_pecas,
        "valor_subtotal": valor_subtotal_calculado,  # Usar valor calculado
        "valor_desconto": ordem.valor_desconto,
        "valor_total": ordem.valor_total,
        "tempo_gasto_horas": ordem.tempo_gasto_horas or Decimal('0'),  # Evitar None
        "aprovado_cliente": ordem.aprovado_cliente,
        "forma_pagamento": ordem.forma_pagamento,
        "created_at": ordem.created_at,
        "updated_at": ordem.updated_at,
        # Dados do cliente
        "cliente_nome": ordem.cliente.nome if ordem.cliente else None,
        "cliente_telefone": ordem.cliente.telefone if ordem.cliente else None,
        "cliente_email": ordem.cliente.email if ordem.cliente else None,
        # Dados do veículo
        "veiculo_placa": ordem.veiculo.placa if ordem.veiculo else None,
        "veiculo_marca": ordem.veiculo.marca if ordem.veiculo else None,
        "veiculo_modelo": ordem.veiculo.modelo if ordem.veiculo else None,
        "veiculo_ano": ordem.veiculo.ano if ordem.veiculo else None,
        # Itens
        "itens": []
    }
    
    # Adicionar itens
    for item in ordem.itens:
        item_data = {
            "id": item.id,
            "ordem_id": item.ordem_id,
            "produto_id": item.produto_id,
            "descricao": item.descricao,
            "quantidade": item.quantidade,
            "valor_unitario": item.valor_unitario,
            "valor_total": item.valor_total,
            "tipo": item.tipo,
            "desconto_item": item.desconto_item,
            "observacoes": item.observacoes,
            "created_at": item.created_at,
            "produto_nome": item.produto.nome if item.produto else None
        }
        response_data["itens"].append(ItemOrdemNovaResponse(**item_data))
    
    return OrdemServicoNovaResponse(**response_data)

def calcular_valores_ordem(ordem_data: dict, itens: List[ItemOrdem]) -> dict:
    """Calcular valores da ordem de serviço"""
    valor_pecas = Decimal('0.00')
    valor_servico = ordem_data.get('valor_servico', Decimal('0.00'))
    
    # Somar valores dos itens
    for item in itens:
        if item.tipo == "PRODUTO":
            valor_pecas += item.valor_total
    
    # Calcular subtotal
    valor_subtotal = valor_pecas + valor_servico
    
    # Calcular desconto
    percentual_desconto = ordem_data.get('percentual_desconto', Decimal('0.00'))
    tipo_desconto = ordem_data.get('tipo_desconto', 'TOTAL')
    
    valor_desconto = Decimal('0.00')
    if percentual_desconto > 0:
        if tipo_desconto == 'VENDA':
            valor_desconto = (valor_pecas * percentual_desconto) / 100
        elif tipo_desconto == 'SERVICO':
            valor_desconto = (valor_servico * percentual_desconto) / 100
        else:  # TOTAL
            valor_desconto = (valor_subtotal * percentual_desconto) / 100
    
    valor_total = valor_subtotal - valor_desconto
    
    return {
        'valor_pecas': valor_pecas,
        'valor_servico': valor_servico,
        'valor_subtotal': valor_subtotal,
        'valor_desconto': valor_desconto,
        'valor_total': valor_total
    }

@router.post("/", response_model=OrdemServicoNovaResponse, status_code=status.HTTP_201_CREATED)
async def criar_ordem_servico(request: Request, db: Session = Depends(get_db)):
    """Criar nova ordem de serviço (endpoint com logging adicional para depuração)"""
    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"Erro ao ler body JSON: {e}")
        body = None

    logger.info(f"📥 Recebido POST /ordens - body (raw): {body}")

    # Validar payload manualmente para capturar erros
    try:
        ordem_data = OrdemServicoNovaCreate.parse_obj(body)
    except ValidationError as ve:
        logger.error(f"❌ Validação falhou ao criar ordem: {ve}")
        logger.error(f"Detalhes da validação: {ve.errors()}")
        # retornar detalhe para facilitar debugging no frontend (temporário)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=ve.errors())

    # Normalizar veiculo_id: frontend pode enviar 0 quando nenhum veículo foi selecionado
    # -> tratar como None para evitar violação de FK ao inserir no banco
    try:
        if getattr(ordem_data, 'veiculo_id', None) in (0, '0'):
            ordem_data.veiculo_id = None
    except Exception:
        # Não bloquear criação se algo inesperado ocorrer na normalização
        pass

    # Verificar se cliente existe
    cliente = db.query(Cliente).filter(Cliente.id == ordem_data.cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado"
        )
    
    # Verificar se veículo existe e pertence ao cliente (apenas se veiculo_id foi fornecido)
    veiculo = None
    if ordem_data.veiculo_id:
        veiculo = db.query(Veiculo).filter(
            and_(
                Veiculo.id == ordem_data.veiculo_id,
                Veiculo.cliente_id == ordem_data.cliente_id
            )
        ).first()
        if not veiculo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Veículo não encontrado ou não pertence ao cliente"
            )
    
    # Validar se tipo de ordem é compatível com presença/ausência de veículo
    if ordem_data.tipo_ordem in ['SERVICO', 'VENDA_SERVICO'] and not veiculo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para ordens de serviço é obrigatório selecionar um veículo"
        )
    
    # Validar itens de produto se houver
    for item in ordem_data.itens:
        if item.tipo == "PRODUTO" and item.produto_id:
            produto = db.query(Produto).filter(Produto.id == item.produto_id).first()
            if not produto:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Produto {item.produto_id} não encontrado"
                )
            
            if produto.quantidade_atual < item.quantidade:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Estoque insuficiente para o produto {produto.nome}. Disponível: {produto.quantidade_atual}"
                )
    
    # Gerar número da ordem
    numero = gerar_numero_ordem(db)
    
    try:
        # Criar ordem de serviço
        ordem_dict = ordem_data.dict(exclude={'itens'})
        # Normalização adicional: converter veiculo_id == 0 para None
        if ordem_dict.get('veiculo_id') in (0, '0'):
            ordem_dict['veiculo_id'] = None
        # Remover campos que são properties somente leitura
        ordem_dict.pop('tempo_estimado_horas', None)
        ordem_dict.pop('tempo_gasto_horas', None)
        ordem_dict.pop('percentual_desconto', None)
        ordem_dict.pop('tipo_desconto', None)
        ordem_dict.pop('valor_subtotal', None)
        ordem = OrdemServico(**ordem_dict, numero=numero)
        
        # Definir data da ordem se não fornecida
        if not ordem.data_ordem:
            ordem.data_ordem = datetime.now()
        
        db.add(ordem)
        db.flush()  # Para obter o ID da ordem
    except AttributeError as e:
        db.rollback()
        field_name = str(e).split("'")[-2] if "'" in str(e) else "desconhecido"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao criar ordem: o campo '{field_name}' não pode ser definido diretamente. Por favor, contate o suporte técnico."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar ordem de serviço: {str(e)}"
        )
    
    # Processar itens
    itens_criados = []
    try:
        for item_data in ordem_data.itens:
            item_dict = item_data.dict()
            item = ItemOrdem(**item_dict, ordem_id=ordem.id)
            
            # Calcular valor total do item
            item.valor_total = item.quantidade * item.valor_unitario
            
            db.add(item)
            itens_criados.append(item)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao processar itens da ordem: {str(e)}"
        )
    
    # Calcular valores totais
    try:
        valores = calcular_valores_ordem(ordem_dict, itens_criados)
        ordem.valor_pecas = valores['valor_pecas']
        ordem.valor_servico = valores['valor_servico']
        # valor_subtotal é uma property readonly, não pode ser setado
        ordem.valor_desconto = valores['valor_desconto']
        ordem.valor_total = valores['valor_total']
        
        # Campos de compatibilidade
        ordem.valor_mao_obra = ordem.valor_servico
        ordem.desconto = ordem.valor_desconto
        
        # Atualizar KM do veículo se fornecido e for maior que o atual
        if ordem.km_veiculo and ordem.km_veiculo > 0 and veiculo:
            if ordem.km_veiculo > veiculo.km_atual:
                logger.info(f"📊 Atualizando KM do veículo {veiculo.placa}: {veiculo.km_atual} -> {ordem.km_veiculo}")
                veiculo.km_atual = ordem.km_veiculo
        
        db.commit()
        db.refresh(ordem)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao finalizar criação da ordem: {str(e)}"
        )
    
    # Retornar ordem criada
    return buscar_ordem_servico(ordem.id, db)

def criar_historico_manutencao(ordem: OrdemServico, db: Session):
    """
    Cria um registro no histórico de manutenções quando uma ordem de serviço é concluída.
    Analisa os itens de serviço para determinar o tipo de manutenção e sugerir a próxima revisão.
    """
    # Verificar se a ordem tem veículo associado e se é do tipo SERVICO ou VENDA_SERVICO
    if not ordem.veiculo_id or ordem.tipo_ordem not in ["SERVICO", "VENDA_SERVICO"]:
        return
    
    # Verificar se já existe um histórico para esta ordem (evitar duplicatas)
    historico_existente = db.query(ManutencaoHistorico).filter(
        ManutencaoHistorico.ordem_servico_id == ordem.id
    ).first()
    
    if historico_existente:
        logger.info(f"Histórico de manutenção já existe para OS {ordem.numero}")
        return
    
    # Obter veículo
    veiculo = db.query(Veiculo).filter(Veiculo.id == ordem.veiculo_id).first()
    if not veiculo:
        return
    
    # Coletar itens de serviço
    itens_servico = db.query(ItemOrdem).filter(
        and_(
            ItemOrdem.ordem_id == ordem.id,
            ItemOrdem.tipo == "SERVICO"
        )
    ).all()
    
    # Se não houver itens de serviço, usar descrição genérica
    if not itens_servico:
        tipo_manutencao = "Manutenção"
        descricao_completa = ordem.descricao_servico or ordem.descricao_problema or "Serviço realizado"
    else:
        # Combinar descrições dos serviços
        descricoes = [item.descricao for item in itens_servico if item.descricao]
        tipo_manutencao = descricoes[0] if descricoes else "Manutenção"
        descricao_completa = ", ".join(descricoes) if descricoes else "Serviços realizados"
    
    # Determinar kilometragem da próxima manutenção baseado no tipo de serviço
    km_proxima = None
    intervalo_km = None
    
    # Análise inteligente do tipo de serviço para sugerir próxima revisão
    descricao_lower = descricao_completa.lower()
    
    if "óleo" in descricao_lower or "oleo" in descricao_lower or "lubrificante" in descricao_lower:
        intervalo_km = 5000  # Troca de óleo geralmente a cada 5000 km
    elif "filtro" in descricao_lower and "óleo" not in descricao_lower:
        intervalo_km = 10000  # Filtros diversos
    elif "correia" in descricao_lower:
        intervalo_km = 50000  # Correia dentada/poly
    elif "vela" in descricao_lower:
        intervalo_km = 20000  # Velas de ignição
    elif "freio" in descricao_lower or "pastilha" in descricao_lower or "disco" in descricao_lower:
        intervalo_km = 30000  # Sistema de freios
    elif "amortecedor" in descricao_lower or "suspensão" in descricao_lower or "suspensao" in descricao_lower:
        intervalo_km = 40000  # Suspensão
    elif "pneu" in descricao_lower or "balanceamento" in descricao_lower or "alinhamento" in descricao_lower:
        intervalo_km = 10000  # Rodízio/alinhamento de pneus
    elif "bateria" in descricao_lower:
        intervalo_km = 50000  # Bateria
    elif "ar condicionado" in descricao_lower or "climatizador" in descricao_lower:
        intervalo_km = 15000  # Ar condicionado
    elif "revisão" in descricao_lower or "revisao" in descricao_lower or "inspeção" in descricao_lower or "inspecao" in descricao_lower:
        intervalo_km = 10000  # Revisão geral
    else:
        # Serviço genérico - sugerir revisão padrão
        intervalo_km = 10000
    
    # Calcular km da próxima manutenção
    km_atual = ordem.km_veiculo or veiculo.km_atual
    if km_atual and intervalo_km:
        km_proxima = km_atual + intervalo_km
    
    # Calcular data estimada da próxima manutenção (assumindo média de 1000 km/mês)
    data_proxima = None
    if km_proxima and km_atual:
        km_restantes = km_proxima - km_atual
        meses_estimados = km_restantes / 1000  # Estimativa: 1000 km por mês
        from dateutil.relativedelta import relativedelta
        data_hoje = date.today()
        data_proxima = data_hoje + relativedelta(months=int(meses_estimados))
    
    # Criar registro de histórico
    historico = ManutencaoHistorico(
        veiculo_id=ordem.veiculo_id,
        tipo=tipo_manutencao[:100],  # Limitar a 100 caracteres
        descricao=descricao_completa,
        km_realizada=km_atual,
        data_realizada=ordem.data_conclusao.date() if ordem.data_conclusao else date.today(),
        km_proxima=km_proxima,
        data_proxima=data_proxima,
        valor=ordem.valor_total,
        observacoes=ordem.observacoes,
        ordem_servico_id=ordem.id
    )
    
    db.add(historico)
    logger.info(f"✅ Histórico de manutenção criado para OS {ordem.numero} - Veículo {veiculo.placa} - Próxima em {km_proxima} km")

@router.put("/{ordem_id}", response_model=OrdemServicoNovaResponse)
def atualizar_ordem_servico(
    ordem_id: int,
    ordem_data: OrdemServicoNovaUpdate,
    db: Session = Depends(get_db)
):
    """Atualizar ordem de serviço"""
    ordem = db.query(OrdemServico).filter(OrdemServico.id == ordem_id).first()
    if not ordem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ordem de serviço não encontrada"
        )
    
    # Atualizar apenas campos não nulos (exceto itens que serão tratados separadamente)
    # Guardar status anterior para detectar transição corretamente
    previous_status = ordem.status
    update_data = ordem_data.dict(exclude_unset=True)
    itens_payload = update_data.pop('itens', None)

    # Normalização: se frontend enviar veiculo_id = 0, tratar como None para não violar FK
    if 'veiculo_id' in update_data and update_data.get('veiculo_id') in (0, '0'):
        update_data['veiculo_id'] = None

    # Validar se status está mudando para CANCELADA e motivo_cancelamento foi fornecido
    novo_status = update_data.get('status', ordem.status)
    if novo_status == "CANCELADA" and previous_status != "CANCELADA":
        motivo = update_data.get('motivo_cancelamento')
        if not motivo or not motivo.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Motivo do cancelamento é obrigatório ao cancelar uma ordem de serviço"
            )

    # Mapear itens existentes e quantidades ANTES de qualquer alteração
    itens_existentes = {it.id: it for it in ordem.itens}
    quantidades_anteriores = {it.id: it.quantidade for it in ordem.itens}
    
    # Remover campos que são properties somente leitura
    update_data.pop('tempo_estimado_horas', None)
    update_data.pop('tempo_gasto_horas', None)
    update_data.pop('percentual_desconto', None)
    update_data.pop('tipo_desconto', None)
    update_data.pop('valor_subtotal', None)
    
    try:
        for key, value in update_data.items():
            if value is not None:
                setattr(ordem, key, value)
    except AttributeError as e:
        db.rollback()
        field_name = str(e).split("'")[-2] if "'" in str(e) else "desconhecido"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao atualizar ordem: o campo '{field_name}' não pode ser modificado diretamente. Por favor, contate o suporte técnico."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar campos da ordem: {str(e)}"
        )

    # Processar itens se fornecidos: criar, atualizar ou deletar
    if itens_payload is not None:
        ids_recebidos = []
        novos_itens_objs = []

        for item_payload in itens_payload:
            # suportar item_payload como dict (JSON) ou objeto pydantic
            if isinstance(item_payload, dict):
                ip = item_payload
                item_id = ip.get('id')
                produto_id = ip.get('produto_id')
                descricao = ip.get('descricao')
                quantidade = ip.get('quantidade')
                valor_unitario = ip.get('valor_unitario')
                valor_total = ip.get('valor_total')
                tipo = ip.get('tipo')
                desconto_item = ip.get('desconto_item', 0)
                observacoes = ip.get('observacoes')
            else:
                ip = item_payload
                item_id = getattr(ip, 'id', None)
                produto_id = getattr(ip, 'produto_id', None)
                descricao = getattr(ip, 'descricao', None)
                quantidade = getattr(ip, 'quantidade', None)
                valor_unitario = getattr(ip, 'valor_unitario', None)
                valor_total = getattr(ip, 'valor_total', None)
                tipo = getattr(ip, 'tipo', None)
                desconto_item = getattr(ip, 'desconto_item', 0)
                observacoes = getattr(ip, 'observacoes', None)

            if item_id and item_id in itens_existentes:
                # Atualizar item existente
                item_obj = itens_existentes[item_id]
                item_obj.produto_id = produto_id
                item_obj.descricao = descricao
                item_obj.quantidade = quantidade
                item_obj.valor_unitario = valor_unitario
                item_obj.valor_total = valor_total or (quantidade * valor_unitario)
                item_obj.tipo = tipo
                item_obj.desconto_item = desconto_item
                item_obj.observacoes = observacoes
                ids_recebidos.append(item_id)
            else:
                # Criar novo item
                novo = ItemOrdem(
                    ordem_id=ordem.id,
                    produto_id=produto_id,
                    descricao=descricao or '',
                    quantidade=quantidade or 0,
                    valor_unitario=valor_unitario or 0,
                    valor_total=(valor_total if valor_total is not None else ((quantidade or 0) * (valor_unitario or 0))),
                    tipo=tipo or 'PRODUTO',
                    desconto_item=desconto_item or 0,
                    observacoes=observacoes
                )
                db.add(novo)
                db.flush()
                novos_itens_objs.append(novo)

        # Deletar itens que não vieram no payload (nova quantidade 0)
        for existing_id, existing_obj in itens_existentes.items():
            if existing_id not in ids_recebidos:
                # Se a ordem já tinha baixa aplicada, precisamos devolver a quantidade anterior ao estoque
                if previous_status in ["CONCLUIDA", "EM_ANDAMENTO"] and quantidades_anteriores.get(existing_id, 0) > 0:
                    produto = db.query(Produto).filter(Produto.id == existing_obj.produto_id).first()
                    if produto:
                        qtd_devolver = quantidades_anteriores.get(existing_id, 0)
                        tz = pytz.timezone('America/Sao_Paulo')
                        movimento = MovimentoEstoque(
                            item_id=produto.id,
                            tipo="ENTRADA",
                            quantidade=qtd_devolver,
                            preco_unitario=existing_obj.valor_unitario,
                            valor_total=(existing_obj.valor_unitario * qtd_devolver) if existing_obj.valor_unitario else None,
                            motivo=f"Ajuste Ordem de Serviço (removido item) - OS {ordem.numero}",
                            observacoes=f"Item removido na edição, repondo {qtd_devolver}",
                            ordem_servico_id=ordem.id,
                            data_movimentacao=datetime.now(tz)
                        )
                        db.add(movimento)
                        produto.quantidade_atual += qtd_devolver
                        # Status do produto é calculado automaticamente pela property

                db.delete(existing_obj)

        # Garantir que ordem.itens reflita o estado atual
        db.flush()
        db.refresh(ordem)
    
    # ========================================
    # LÓGICA DE MOVIMENTAÇÃO DE ESTOQUE
    # ========================================
    # 
    # REGRAS:
    # 1. Status EM_ANDAMENTO ou CONCLUIDA: cria movimento de SAIDA (baixa estoque)
    # 2. Mudança DE (EM_ANDAMENTO/CONCLUIDA) PARA (PENDENTE/AGUARDANDO_*/CANCELADA): cria movimento de ENTRADA (devolução)
    # 3. Status CANCELADA: além da devolução, exige motivo_cancelamento
    #
    # FLUXOS POSSÍVEIS:
    # - PENDENTE → EM_ANDAMENTO: cria SAIDA
    # - EM_ANDAMENTO → CONCLUIDA: mantém SAIDA (já aplicada)
    # - EM_ANDAMENTO → PENDENTE: cria ENTRADA (devolução)
    # - EM_ANDAMENTO → CANCELADA: cria ENTRADA (devolução) + registra motivo
    # - CONCLUIDA → CANCELADA: cria ENTRADA (devolução) + registra motivo
    #
    # ========================================
    
    # Baixa de estoque — dois casos:
    # 1) Transição para CONCLUIDA/EM_ANDAMENTO (anteriormente não estava) -> baixa completa da quantidade atual dos itens
    # 2) Ordem já estava em CONCLUIDA/EM_ANDAMENTO e itens foram alterados -> aplicar apenas o delta (novo - antigo). Se delta>0 criar SAIDA, delta<0 criar ENTRADA
    novo_status = ordem.status
    if novo_status in ["CONCLUIDA", "EM_ANDAMENTO"] and previous_status not in ["CONCLUIDA", "EM_ANDAMENTO"]:
        # Para CONCLUIDA, atualizar data de conclusão
        if novo_status == "CONCLUIDA":
            ordem.data_conclusao = datetime.now()
            # Criar registro no histórico de manutenções do veículo
            try:
                criar_historico_manutencao(ordem, db)
            except Exception as e:
                logger.error(f"Erro ao criar histórico de manutenção para OS {ordem.numero}: {str(e)}")

        # Baixa completa: cada item provoca saída igual à sua quantidade
        itens_produto = db.query(ItemOrdem).filter(
            and_(
                ItemOrdem.ordem_id == ordem_id,
                ItemOrdem.tipo == "PRODUTO",
                ItemOrdem.produto_id.isnot(None)
            )
        ).all()

        for item in itens_produto:
            produto = db.query(Produto).filter(Produto.id == item.produto_id).first()
            if produto:
                # Verificar estoque disponível
                if produto.quantidade_atual < item.quantidade:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Estoque insuficiente para o produto {produto.nome}"
                    )

                # Criar movimento de saída
                tz = pytz.timezone('America/Sao_Paulo')
                
                # Consumir lotes via FIFO e obter custo médio
                try:
                    custo_medio = consumir_lotes_fifo(db, item.produto_id, item.quantidade)
                except HTTPException:
                    # Se não houver lotes (produtos antigos), usar custo do produto
                    custo_medio = float(produto.preco_custo) if produto.preco_custo else 0
                
                movimento = MovimentoEstoque(
                    item_id=item.produto_id,
                    tipo="SAIDA",
                    quantidade=item.quantidade,
                    preco_unitario=item.valor_unitario,
                    preco_custo=custo_medio,  # Custo real baseado nos lotes FIFO
                    valor_total=item.valor_total,
                    motivo="Ordem de Serviço",
                    observacoes=f"OS {ordem.numero} - {item.descricao} - Status: {novo_status}",
                    ordem_servico_id=ordem.id,
                    data_movimentacao=datetime.now(tz)
                )
                db.add(movimento)

                # Atualizar estoque do produto
                produto.quantidade_atual -= item.quantidade
                # Status do produto é calculado automaticamente pela property

          # Ordem já tinha baixa aplicada — aplicar somente delta quando itens mudaram
        # Obter quantidades atuais após atualização
        itens_atualizados = db.query(ItemOrdem).filter(ItemOrdem.ordem_id == ordem.id).all()
        quantidades_novas = {it.id: it.quantidade for it in itens_atualizados}

        # Mapear por produto: se item foi novo (id não estava em quantidades_anteriores) consideramos anterior=0
        # Para itens deletados, quantidades_novas não terá a chave — tratamos como novo=0
        all_item_ids = set(list(quantidades_anteriores.keys()) + list(quantidades_novas.keys()))

        for item_id in all_item_ids:
            old_q = quantidades_anteriores.get(item_id, 0)
            new_q = quantidades_novas.get(item_id, 0)

            # Converter Decimal/Num para float/Decimal coerente
            try:
                old_q_val = old_q
            except Exception:
                old_q_val = 0
            try:
                new_q_val = new_q
            except Exception:
                new_q_val = 0

            # Se não houve mudança, pular
            if new_q_val == old_q_val:
                continue

            # Buscar item (pode ter sido deletado — neste caso new_q_val == 0)
            item_obj = db.query(ItemOrdem).filter(ItemOrdem.id == item_id).first()
            # Se item_obj for None e old_q>0, significa que item foi removido -> criar ENTRADA de old_q
            if item_obj is None and old_q_val > 0:
                # precisamos saber qual produto era antes — buscar em itens_existentes
                existing_item = itens_existentes.get(item_id)
                if not existing_item or not existing_item.produto_id:
                    continue
                produto = db.query(Produto).filter(Produto.id == existing_item.produto_id).first()
                if not produto:
                    continue

                # Criar movimento ENTRADA devolvendo ao estoque
                tz = pytz.timezone('America/Sao_Paulo')
                movimento = MovimentoEstoque(
                    item_id=produto.id,
                    tipo="ENTRADA",
                    quantidade=old_q_val,
                    preco_unitario=existing_item.valor_unitario,
                    valor_total=(existing_item.valor_unitario * old_q_val) if existing_item.valor_unitario else None,
                    motivo=f"Ajuste Ordem de Serviço (removido item) - OS {ordem.numero}",
                    observacoes=f"Ajuste retroativo: item removido, repondo {old_q_val}",
                    ordem_servico_id=ordem.id,
                    data_movimentacao=datetime.now(tz)
                )
                db.add(movimento)
                produto.quantidade_atual += old_q_val
                # data_ultima_movimentacao e tipo_ultima_movimentacao são properties calculadas
                # Não atribuir produto.status diretamente — é uma property calculada

            else:
                # item_obj existe (ou new_q_val>0) -> calcular delta = new - old
                produto_id = None
                valor_unitario = None
                if item_obj:
                    produto_id = item_obj.produto_id
                    valor_unitario = item_obj.valor_unitario
                else:
                    # Se item_obj não existe mas new_q_val>0 (caso novo com id temporário), pular — novo item já foi tratado na transição inicial
                    continue

                if not produto_id:
                    continue

                delta = new_q_val - old_q_val
                if delta == 0:
                    continue

                produto = db.query(Produto).filter(Produto.id == produto_id).first()
                if not produto:
                    continue

                if delta > 0:
                    # Saída apenas da diferença
                    if produto.quantidade_atual < delta:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Estoque insuficiente para o produto {produto.nome} ao aplicar ajuste de quantidade"
                        )
                    tz = pytz.timezone('America/Sao_Paulo')
                    
                    # Consumir lotes via FIFO
                    try:
                        custo_medio = consumir_lotes_fifo(db, produto.id, delta)
                    except HTTPException:
                        custo_medio = float(produto.preco_custo) if produto.preco_custo else 0
                    
                    movimento = MovimentoEstoque(
                        item_id=produto.id,
                        tipo="SAIDA",
                        quantidade=delta,
                        preco_unitario=valor_unitario,
                        preco_custo=custo_medio,  # Custo real FIFO
                        valor_total=(valor_unitario * delta) if valor_unitario else None,
                        motivo=f"Ajuste Ordem de Serviço - OS {ordem.numero}",
                        observacoes=f"Ajuste quantidade item id={item_id}: {old_q_val} -> {new_q_val}",
                        ordem_servico_id=ordem.id,
                        data_movimentacao=datetime.now(tz)
                    )
                    db.add(movimento)
                    produto.quantidade_atual -= delta
                    # Status do produto é calculado automaticamente pela property
                else:
                    # delta < 0 -> devolver ao estoque
                    entrada_q = abs(delta)
                    tz = pytz.timezone('America/Sao_Paulo')
                    movimento = MovimentoEstoque(
                        item_id=produto.id,
                        tipo="ENTRADA",
                        quantidade=entrada_q,
                        preco_unitario=valor_unitario,
                        valor_total=(valor_unitario * entrada_q) if valor_unitario else None,
                        motivo=f"Ajuste Ordem de Serviço - OS {ordem.numero}",
                        observacoes=f"Ajuste quantidade item id={item_id}: {old_q_val} -> {new_q_val}",
                        ordem_servico_id=ordem.id,
                        data_movimentacao=datetime.now(tz)
                    )
                    db.add(movimento)
                    produto.quantidade_atual += entrada_q
                    # Status do produto é calculado automaticamente pela property

    elif novo_status in ["PENDENTE", "AGUARDANDO_PECA", "AGUARDANDO_APROVACAO", "CANCELADA"] and (
        previous_status in ["CONCLUIDA", "EM_ANDAMENTO"] or
        # Ou se já existirem movimentos SAIDA para essa ordem (baixa aplicada retroativamente)
        db.query(func.count(MovimentoEstoque.id)).filter(
            and_(MovimentoEstoque.ordem_servico_id == ordem.id, MovimentoEstoque.tipo == "SAIDA")
        ).scalar() > 0
    ):
        # Transição DE status com baixa aplicada PARA status de pausa/cancelamento -> devolver apenas o que ainda não foi devolvido
        # Para evitar devoluções duplicadas, vamos calcular por produto quanto foi SAÍDO para o serviço e quanto já foi devolvido (ENTRADA com motivo de devolução)
        itens_produto = db.query(ItemOrdem).filter(
            and_(
                ItemOrdem.ordem_id == ordem_id,
                ItemOrdem.tipo == "PRODUTO",
                ItemOrdem.produto_id.isnot(None)
            )
        ).all()

        for item in itens_produto:
            produto = db.query(Produto).filter(Produto.id == item.produto_id).first()
            if not produto:
                continue

            # Soma total de SAIDA registrada para este produto/ordem
            total_saida = db.query(func.sum(MovimentoEstoque.quantidade)).filter(
                and_(
                    MovimentoEstoque.ordem_servico_id == ordem.id,
                    MovimentoEstoque.item_id == produto.id,
                    MovimentoEstoque.tipo == "SAIDA"
                )
            ).scalar() or 0

            # Soma total de ENTRADA já gerada como devolução para esta ordem/produto
            total_entrada_devolucao = db.query(func.sum(MovimentoEstoque.quantidade)).filter(
                and_(
                    MovimentoEstoque.ordem_servico_id == ordem.id,
                    MovimentoEstoque.item_id == produto.id,
                    MovimentoEstoque.tipo == "ENTRADA",
                    MovimentoEstoque.motivo.ilike("%Devolução Ordem de Serviço%")
                )
            ).scalar() or 0

            # Calcular quanto ainda precisa ser devolvido
            try:
                ainda_devolver = (Decimal(total_saida) - Decimal(total_entrada_devolucao))
            except Exception:
                ainda_devolver = Decimal('0')

            # Se nada a devolver, pular
            if ainda_devolver <= 0:
                continue

            # Log detalhado para depuração: mostrar totais calculados
            logger.info(f"Devolucao calculada OS={ordem.numero} produto_id={produto.id} total_saida={total_saida} total_entrada_devolucao={total_entrada_devolucao} ainda_devolver={ainda_devolver} item_quantidade={item.quantidade}")

            # Devolver todo o saldo remanescente (ainda_devolver).
            # Antes devolvíamos em parcelas limitadas ao item.quantidade, o que causava devoluções múltiplas
            # em múltiplas alterações de status. Aqui garantimos que a primeira transição devolverá o restante.
            qtd_a_devolver = ainda_devolver

            # Se é cancelamento, incluir o motivo na observação
            observacao_movimento = f"OS {ordem.numero} - {item.descricao} - Status alterado para: {novo_status}"
            if novo_status == "CANCELADA" and ordem.motivo_cancelamento:
                observacao_movimento += f" | Motivo: {ordem.motivo_cancelamento}"

            tz = pytz.timezone('America/Sao_Paulo')
            movimento = MovimentoEstoque(
                item_id=produto.id,
                tipo="ENTRADA",
                quantidade=qtd_a_devolver,
                preco_unitario=item.valor_unitario,
                valor_total=(item.valor_unitario * qtd_a_devolver) if item.valor_unitario else None,
                motivo="Devolução Ordem de Serviço" if novo_status != "CANCELADA" else "Cancelamento de Ordem",
                observacoes=observacao_movimento,
                ordem_servico_id=ordem.id,
                data_movimentacao=datetime.now(tz)
            )
            db.add(movimento)

            produto.quantidade_atual += qtd_a_devolver
            # Status do produto é calculado automaticamente pela property
    
    # Recalcular valores da ordem com itens atualizados
    try:
        itens_da_ordem = db.query(ItemOrdem).filter(ItemOrdem.ordem_id == ordem.id).all()
        ordem_dict = {
            'valor_servico': ordem.valor_servico or Decimal('0.00'),
            'percentual_desconto': ordem.percentual_desconto or Decimal('0.00'),
            'tipo_desconto': ordem.tipo_desconto or 'TOTAL'
        }
        valores = calcular_valores_ordem(ordem_dict, itens_da_ordem)

        ordem.valor_pecas = valores['valor_pecas']
        ordem.valor_servico = valores['valor_servico']
        # `valor_subtotal` é uma property readonly no modelo; não atribuímos diretamente
        ordem.valor_desconto = valores['valor_desconto']
        ordem.valor_total = valores['valor_total']
        ordem.valor_mao_obra = ordem.valor_servico
        ordem.desconto = ordem.valor_desconto
        logger.info(f"PUT /ordens/{ordem.id} - itens processados: {len(itens_da_ordem)}, valores recalculados: total={ordem.valor_total} pecas={ordem.valor_pecas} servico={ordem.valor_servico}")
    except Exception:
        # Se algo falhar na recalculação, registrar exceção
        logger.exception(f"Erro ao recalcular valores da ordem {ordem.id}")

    # Atualizar KM do veículo se fornecido
    if ordem_data.km_veiculo and ordem_data.km_veiculo > 0:
        veiculo = db.query(Veiculo).filter(Veiculo.id == ordem.veiculo_id).first()
        if veiculo and ordem_data.km_veiculo > veiculo.km_atual:
            veiculo.km_atual = ordem_data.km_veiculo
    
    db.commit()
    db.refresh(ordem)
    
    return buscar_ordem_servico(ordem.id, db)

@router.delete("/{ordem_id}")
def cancelar_ordem_servico(ordem_id: int, db: Session = Depends(get_db)):
    """Cancelar ordem de serviço"""
    ordem = db.query(OrdemServico).filter(OrdemServico.id == ordem_id).first()
    if not ordem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ordem de serviço não encontrada"
        )
    
    if ordem.status == "CONCLUIDA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível cancelar uma ordem de serviço concluída"
        )
    
    ordem.status = "CANCELADA"
    db.commit()
    
    return {"message": "Ordem de serviço cancelada com sucesso"}