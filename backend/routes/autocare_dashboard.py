from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from db import get_db
from models.autocare_models import (
    Cliente, Veiculo, OrdemServico, Produto, MovimentoEstoque, 
    AlertaKm, ItemOrdem
)

router = APIRouter()

@router.get("/resumo")
def dashboard_resumo(db: Session = Depends(get_db)):
    """Resumo geral do sistema para dashboard"""
    
    # Contadores gerais
    total_clientes = db.query(Cliente).filter(Cliente.ativo == True).count()
    total_veiculos = db.query(Veiculo).filter(Veiculo.ativo == True).count()
    total_produtos = db.query(Produto).filter(Produto.ativo == True).count()
    
    # Ordens de serviço - ajustado para status correto em maiúsculas
    ordens_abertas = db.query(OrdemServico).filter(
        or_(OrdemServico.status == "PENDENTE", OrdemServico.status == "Aberta")
    ).count()
    ordens_andamento = db.query(OrdemServico).filter(
        or_(
            OrdemServico.status == "EM_ANDAMENTO",
            OrdemServico.status == "Em Andamento",
            OrdemServico.status == "AGUARDANDO_PECA",
            OrdemServico.status == "AGUARDANDO_APROVACAO"
        )
    ).count()
    
    # Início e fim do mês atual
    inicio_mes = date.today().replace(day=1)
    if date.today().month == 12:
        fim_mes = date(date.today().year + 1, 1, 1)
    else:
        fim_mes = date.today().replace(month=date.today().month + 1, day=1)
    
    # Ordens concluídas no mês
    ordens_concluidas_mes = db.query(OrdemServico).filter(
        and_(
            or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
            OrdemServico.data_conclusao >= inicio_mes,
            OrdemServico.data_conclusao < fim_mes
        )
    ).count()
    
    # Produtos com estoque baixo
    produtos_estoque_baixo = db.query(Produto).filter(
        and_(
            Produto.quantidade_atual <= Produto.quantidade_minima,
            Produto.ativo == True
        )
    ).count()
    
    # Faturamento do mês (soma de valor_total das OS concluídas)
    faturamento_mes = db.query(func.sum(OrdemServico.valor_total)).filter(
        and_(
            or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
            OrdemServico.data_conclusao >= inicio_mes,
            OrdemServico.data_conclusao < fim_mes
        )
    ).scalar() or Decimal('0.00')
    
    # Faturamento hoje
    hoje = date.today()
    faturamento_hoje = db.query(func.sum(OrdemServico.valor_total)).filter(
        and_(
            or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
            func.date(OrdemServico.data_conclusao) == hoje
        )
    ).scalar() or Decimal('0.00')
    
    # Quantidade de serviços realizados no mês (conta OS do tipo SERVICO ou VENDA_SERVICO)
    # Cada OS conta +1, independente de quantos serviços foram realizados
    servicos_realizados = db.query(func.count(OrdemServico.id)).filter(
        and_(
            or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
            OrdemServico.data_conclusao >= inicio_mes,
            OrdemServico.data_conclusao < fim_mes,
            or_(
                OrdemServico.tipo_ordem == "SERVICO",
                OrdemServico.tipo_ordem == "VENDA_SERVICO"
            )
        )
    ).scalar() or 0
    
    # Quantidade de peças vendidas no mês (soma dos itens tipo PRODUTO)
    pecas_vendidas = db.query(func.sum(ItemOrdem.quantidade)).join(
        OrdemServico, ItemOrdem.ordem_id == OrdemServico.id
    ).filter(
        and_(
            or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
            OrdemServico.data_conclusao >= inicio_mes,
            OrdemServico.data_conclusao < fim_mes,
            or_(ItemOrdem.tipo == "PRODUTO", ItemOrdem.tipo == "produto")
        )
    ).scalar() or 0
    
    return {
        "contadores": {
            "total_clientes": total_clientes,
            "total_veiculos": total_veiculos,
            "total_produtos": total_produtos,
            "produtos_estoque_baixo": produtos_estoque_baixo
        },
        "ordens_servico": {
            "abertas": ordens_abertas,
            "em_andamento": ordens_andamento,
            "concluidas_mes": ordens_concluidas_mes
        },
        "financeiro": {
            "faturamento_mes": float(faturamento_mes),
            "faturamento_hoje": float(faturamento_hoje),
            "servicos_realizados": int(servicos_realizados),
            "pecas_vendidas": int(pecas_vendidas)
        }
    }

@router.get("/vendas-mensais")
def vendas_mensais(ano: Optional[int] = None, db: Session = Depends(get_db)):
    """Vendas mensais por ano para gráfico - separadas por tipo"""
    if not ano:
        ano = datetime.now().year
    
    # Calcular os últimos 12 meses
    hoje = date.today()
    mes_atual = hoje.month
    ano_atual = hoje.year
    
    # Arrays para armazenar dados dos últimos 12 meses
    vendas_totais = []
    vendas_servicos = []
    vendas_pecas = []
    descontos_mensais = []
    labels_meses = []
    
    # Iterar pelos últimos 12 meses
    for i in range(11, -1, -1):
        # Calcular mês e ano
        mes = mes_atual - i
        ano_calculo = ano_atual
        
        if mes <= 0:
            mes += 12
            ano_calculo -= 1
        
        # Definir início e fim do mês
        inicio_mes = date(ano_calculo, mes, 1)
        if mes == 12:
            fim_mes = date(ano_calculo + 1, 1, 1)
        else:
            fim_mes = date(ano_calculo, mes + 1, 1)
        
        # Total de vendas do mês
        total_mes = db.query(func.sum(OrdemServico.valor_total)).filter(
            and_(
                or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
                OrdemServico.data_conclusao >= inicio_mes,
                OrdemServico.data_conclusao < fim_mes
            )
        ).scalar() or Decimal('0.00')
        
        # Receita líquida de serviços e peças (descontos alocados proporcionalmente entre serviço e peças por OS)
        total_bruto_expr = (func.coalesce(OrdemServico.valor_servico, 0) + func.coalesce(OrdemServico.valor_pecas, 0))
        desconto_total_expr = func.coalesce(OrdemServico.valor_desconto, func.coalesce(OrdemServico.desconto, 0))

        # Parte do desconto atribuída ao serviço
        desconto_serv_expr = func.coalesce(
            (func.coalesce(OrdemServico.valor_servico, 0) / func.nullif(total_bruto_expr, 0)) * desconto_total_expr,
            0
        )
        serv_net_expr = func.coalesce(OrdemServico.valor_servico, 0) - desconto_serv_expr

        # Parte do desconto atribuída às peças
        desconto_pec_expr = func.coalesce(
            (func.coalesce(OrdemServico.valor_pecas, 0) / func.nullif(total_bruto_expr, 0)) * desconto_total_expr,
            0
        )
        pec_net_expr = func.coalesce(OrdemServico.valor_pecas, 0) - desconto_pec_expr

        servicos_mes = db.query(func.sum(serv_net_expr)).filter(
            and_(
                or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
                OrdemServico.data_conclusao >= inicio_mes,
                OrdemServico.data_conclusao < fim_mes,
                or_(
                    OrdemServico.tipo_ordem == "SERVICO",
                    OrdemServico.tipo_ordem == "VENDA_SERVICO"
                )
            )
        ).scalar() or Decimal('0.00')

        pecas_mes = db.query(func.sum(pec_net_expr)).filter(
            and_(
                or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
                OrdemServico.data_conclusao >= inicio_mes,
                OrdemServico.data_conclusao < fim_mes,
                or_(
                    OrdemServico.tipo_ordem == "VENDA",
                    OrdemServico.tipo_ordem == "VENDA_SERVICO"
                )
            )
        ).scalar() or Decimal('0.00')
        
        # Descontos totais do mês (usar valor_desconto se existir, senão desconto legado)
        descontos_mes = db.query(
            func.sum(
                func.coalesce(OrdemServico.valor_desconto, func.coalesce(OrdemServico.desconto, 0))
            )
        ).filter(
            and_(
                or_(OrdemServico.status == "CONCLUIDA", OrdemServico.status == "Concluída"),
                OrdemServico.data_conclusao >= inicio_mes,
                OrdemServico.data_conclusao < fim_mes
            )
        ).scalar() or Decimal('0.00')

        # Adicionar aos arrays
        vendas_totais.append(float(total_mes))
        vendas_servicos.append(float(servicos_mes))
        vendas_pecas.append(float(pecas_mes))
        descontos_mensais.append(float(descontos_mes))
        
        # Nome do mês
        nomes_meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
        labels_meses.append(nomes_meses[mes - 1])
    
    return {
        "meses": labels_meses,
        "vendas": vendas_totais,
        "vendas_servicos": vendas_servicos,
        "vendas_pecas": vendas_pecas,
        "descontos": descontos_mensais
    }

@router.get("/ordens-status")
def ordens_por_status(db: Session = Depends(get_db)):
    """Distribuição de ordens por status para gráfico pizza"""
    status_count = db.query(
        OrdemServico.status,
        func.count(OrdemServico.id).label('quantidade')
    ).group_by(OrdemServico.status).all()
    
    # Mapeamento de cores baseado no padrão do sistema
    cores_status = {
        "PENDENTE": "rgba(234, 179, 8, 0.8)",  # yellow-500
        "EM_ANDAMENTO": "rgba(59, 130, 246, 0.8)",  # blue-500
        "AGUARDANDO_PECA": "rgba(249, 115, 22, 0.8)",  # orange-500
        "AGUARDANDO_APROVACAO": "rgba(168, 85, 247, 0.8)",  # purple-500
        "CONCLUIDA": "rgba(34, 197, 94, 0.8)",  # green-500
        "CANCELADA": "rgba(239, 68, 68, 0.8)",  # red-500
    }
    
    # Labels em português
    labels_status = {
        "PENDENTE": "Pendente",
        "EM_ANDAMENTO": "Em Andamento",
        "AGUARDANDO_PECA": "Aguardando Peça",
        "AGUARDANDO_APROVACAO": "Aguardando Aprovação",
        "CONCLUIDA": "Concluída",
        "CANCELADA": "Cancelada",
        # Compatibilidade com valores antigos
        "Aberta": "Pendente",
        "Em Andamento": "Em Andamento",
        "Concluída": "Concluída",
    }
    
    resultado = []
    for item in status_count:
        status = item.status
        # Normalizar status para o padrão atual
        if status in labels_status:
            label = labels_status[status]
            # Converter para o padrão atual se necessário
            status_normalizado = status if status in cores_status else {
                "Aberta": "PENDENTE",
                "Em Andamento": "EM_ANDAMENTO",
                "Concluída": "CONCLUIDA"
            }.get(status, status)
        else:
            label = status
            status_normalizado = status
        
        cor = cores_status.get(status_normalizado, "rgba(107, 114, 128, 0.8)")  # gray-500 default
        
        resultado.append({
            "status": label,
            "quantidade": item.quantidade,
            "cor": cor
        })
    
    return resultado

@router.get("/produtos-mais-vendidos")
def produtos_mais_vendidos(
    limit: int = 10,
    periodo_dias: int = 30,
    db: Session = Depends(get_db)
):
    """Produtos mais vendidos no período"""
    data_limite = datetime.now() - timedelta(days=periodo_dias)
    
    produtos = db.query(
        Produto.nome.label('produto'),
        func.sum(ItemOrdem.quantidade).label('quantidade_vendida'),
        func.sum(ItemOrdem.preco_total).label('total_vendas')
    ).join(
        ItemOrdem, Produto.id == ItemOrdem.produto_id
    ).join(
        OrdemServico, ItemOrdem.ordem_id == OrdemServico.id
    ).filter(
        and_(
            OrdemServico.status == "Concluída",
            OrdemServico.data_conclusao >= data_limite,
            ItemOrdem.tipo == "produto"
        )
    ).group_by(
        Produto.id, Produto.nome
    ).order_by(
        func.sum(ItemOrdem.quantidade).desc()
    ).limit(limit).all()
    
    return [
        {
            "produto": item.produto,
            "quantidade_vendida": float(item.quantidade_vendida),
            "total_vendas": float(item.total_vendas)
        }
        for item in produtos
    ]

@router.get("/alertas")
def dashboard_alertas(db: Session = Depends(get_db)):
    """Alertas para o dashboard"""
    alertas = []
    
    # Alertas de aniversário (próximos 7 dias)
    data_inicio = date.today()
    data_fim = data_inicio + timedelta(days=7)
    
    clientes_aniversario = db.query(Cliente).filter(
        and_(
            Cliente.ativo == True,
            Cliente.data_nascimento.isnot(None),
            func.extract('month', Cliente.data_nascimento) == data_inicio.month,
            func.extract('day', Cliente.data_nascimento).between(
                data_inicio.day, data_fim.day
            )
        )
    ).all()
    
    for cliente in clientes_aniversario:
        alertas.append({
            "tipo": "aniversario",
            "titulo": f"Aniversário de {cliente.nome}",
            "descricao": f"Cliente faz aniversário em {cliente.data_nascimento.strftime('%d/%m')}",
            "data": cliente.data_nascimento.strftime('%Y-%m-%d'),
            "prioridade": "baixa"
        })
    
    # Alertas de KM (vencidos ou próximos)
    alertas_km = db.query(AlertaKm).join(Veiculo).filter(
        and_(
            AlertaKm.ativo == True,
            AlertaKm.notificado == False,
            Veiculo.km_atual >= AlertaKm.km_proximo_servico - 1000  # Alerta 1000km antes
        )
    ).all()
    
    for alerta_km in alertas_km:
        veiculo = alerta_km.veiculo
        km_restante = alerta_km.km_proximo_servico - veiculo.km_atual
        
        if km_restante <= 0:
            prioridade = "alta"
            titulo = f"Serviço vencido - {veiculo.marca} {veiculo.modelo}"
        else:
            prioridade = "media"
            titulo = f"Serviço próximo - {veiculo.marca} {veiculo.modelo}"
        
        alertas.append({
            "tipo": "manutencao",
            "titulo": titulo,
            "descricao": f"{alerta_km.tipo_servico} - KM atual: {veiculo.km_atual}, Próximo: {alerta_km.km_proximo_servico}",
            "km_atual": veiculo.km_atual,
            "km_proximo": alerta_km.km_proximo_servico,
            "prioridade": prioridade
        })
    
    # Alertas de estoque baixo
    produtos_estoque_baixo = db.query(Produto).filter(
        and_(
            Produto.quantidade_atual <= Produto.quantidade_minima,
            Produto.ativo == True
        )
    ).limit(10).all()
    
    for produto in produtos_estoque_baixo:
        alertas.append({
            "tipo": "estoque",
            "titulo": f"Estoque baixo - {produto.nome}",
            "descricao": f"Estoque atual: {produto.quantidade_atual}, Mínimo: {produto.quantidade_minima}",
            "estoque_atual": produto.quantidade_atual,
            "estoque_minimo": produto.quantidade_minima,
            "prioridade": "media"
        })
    
    return {
        "total_alertas": len(alertas),
        "alertas": alertas[:20]  # Limitar a 20 alertas
    }

@router.get("/faturamento-periodo")
def faturamento_periodo(
    data_inicio: str,
    data_fim: str,
    db: Session = Depends(get_db)
):
    """Faturamento por período"""
    try:
        inicio = datetime.fromisoformat(data_inicio.replace('Z', '+00:00')).date()
        fim = datetime.fromisoformat(data_fim.replace('Z', '+00:00')).date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use ISO format: YYYY-MM-DD"
        )
    
    # Faturamento total
    faturamento = db.query(func.sum(OrdemServico.valor_total)).filter(
        and_(
            OrdemServico.status == "Concluída",
            func.date(OrdemServico.data_conclusao).between(inicio, fim)
        )
    ).scalar() or Decimal('0.00')
    
    # Número de ordens concluídas
    num_ordens = db.query(func.count(OrdemServico.id)).filter(
        and_(
            OrdemServico.status == "Concluída",
            func.date(OrdemServico.data_conclusao).between(inicio, fim)
        )
    ).scalar() or 0
    
    # Ticket médio
    ticket_medio = float(faturamento) / num_ordens if num_ordens > 0 else 0
    
    # Faturamento por tipo (produtos vs serviços)
    faturamento_produtos = db.query(func.sum(OrdemServico.valor_produtos)).filter(
        and_(
            OrdemServico.status == "Concluída",
            func.date(OrdemServico.data_conclusao).between(inicio, fim)
        )
    ).scalar() or Decimal('0.00')
    
    faturamento_servicos = db.query(func.sum(OrdemServico.valor_servicos)).filter(
        and_(
            OrdemServico.status == "Concluída",
            func.date(OrdemServico.data_conclusao).between(inicio, fim)
        )
    ).scalar() or Decimal('0.00')
    
    return {
        "periodo": {
            "data_inicio": inicio.isoformat(),
            "data_fim": fim.isoformat()
        },
        "faturamento_total": float(faturamento),
        "numero_ordens": num_ordens,
        "ticket_medio": ticket_medio,
        "faturamento_produtos": float(faturamento_produtos),
        "faturamento_servicos": float(faturamento_servicos)
    }

@router.get("/clientes-ativos")
def clientes_mais_ativos(
    limit: int = 10,
    periodo_dias: int = 90,
    db: Session = Depends(get_db)
):
    """Clientes mais ativos no período"""
    data_limite = datetime.now() - timedelta(days=periodo_dias)
    
    clientes = db.query(
        Cliente.nome.label('cliente'),
        func.count(OrdemServico.id).label('numero_ordens'),
        func.sum(OrdemServico.valor_total).label('total_gasto')
    ).join(
        OrdemServico, Cliente.id == OrdemServico.cliente_id
    ).filter(
        and_(
            OrdemServico.status == "Concluída",
            OrdemServico.data_conclusao >= data_limite
        )
    ).group_by(
        Cliente.id, Cliente.nome
    ).order_by(
        func.sum(OrdemServico.valor_total).desc()
    ).limit(limit).all()
    
    return [
        {
            "cliente": item.cliente,
            "numero_ordens": item.numero_ordens,
            "total_gasto": float(item.total_gasto)
        }
        for item in clientes
    ]