from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional
import pandas as pd
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
import tempfile
import os

from db import get_db
from models.autocare_models import (
    Cliente, Veiculo, OrdemServico, Produto, MovimentoEstoque, 
    ItemOrdem, Fornecedor
)

router = APIRouter()

@router.get("/vendas")
def relatorio_vendas(
    data_inicio: str,
    data_fim: str,
    formato: str = "json",  # json, excel, pdf
    cliente_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Relatório de vendas por período"""
    try:
        inicio = datetime.fromisoformat(data_inicio.replace('Z', '+00:00')).date()
        fim = datetime.fromisoformat(data_fim.replace('Z', '+00:00')).date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use ISO format: YYYY-MM-DD"
        )
    
    # Query base
    query = db.query(
        OrdemServico.numero,
        OrdemServico.data_abertura,
        OrdemServico.data_conclusao,
        Cliente.nome.label('cliente'),
        Veiculo.marca,
        Veiculo.modelo,
        Veiculo.placa,
        OrdemServico.status,
        OrdemServico.valor_pecas,
        OrdemServico.valor_mao_obra,
        OrdemServico.valor_total,
        OrdemServico.desconto,
        OrdemServico.valor_total
    ).join(
        Cliente, OrdemServico.cliente_id == Cliente.id
    ).join(
        Veiculo, OrdemServico.veiculo_id == Veiculo.id
    ).filter(
        func.date(OrdemServico.data_abertura).between(inicio, fim)
    )
    
    # Filtros opcionais
    if cliente_id:
        query = query.filter(OrdemServico.cliente_id == cliente_id)
    
    if status:
        query = query.filter(OrdemServico.status == status)
    
    ordens = query.order_by(OrdemServico.data_abertura.desc()).all()
    
    # Calcular totais
    total_ordens = len(ordens)
    total_faturamento = sum(float(ordem.valor_total) for ordem in ordens)
    total_produtos = sum(float(ordem.valor_pecas) for ordem in ordens)
    total_servicos = sum(float(ordem.valor_mao_obra) for ordem in ordens)
    ticket_medio = total_faturamento / total_ordens if total_ordens > 0 else 0
    
    dados = {
        "periodo": {
            "data_inicio": inicio.isoformat(),
            "data_fim": fim.isoformat()
        },
        "resumo": {
            "total_ordens": total_ordens,
            "total_faturamento": total_faturamento,
            "total_produtos": total_produtos,
            "total_servicos": total_servicos,
            "ticket_medio": ticket_medio
        },
        "ordens": [
            {
                "numero": ordem.numero,
                "data_abertura": ordem.data_abertura.isoformat(),
                "data_conclusao": ordem.data_conclusao.isoformat() if ordem.data_conclusao else None,
                "cliente": ordem.cliente,
                "veiculo": f"{ordem.marca} {ordem.modelo} - {ordem.placa}",
                "status": ordem.status,
                "valor_produtos": float(ordem.valor_pecas),
                "valor_servicos": float(ordem.valor_mao_obra),
                "valor_total": float(ordem.valor_total),
                "desconto": float(ordem.desconto),
                "valor_final": float(ordem.valor_total)
            }
            for ordem in ordens
        ]
    }
    
    if formato == "json":
        return dados
    
    elif formato == "excel":
        return gerar_excel_vendas(dados)
    
    elif formato == "pdf":
        return gerar_pdf_vendas(dados)
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato não suportado. Use: json, excel ou pdf"
        )

@router.get("/estoque")
def relatorio_estoque(
    formato: str = "json",
    categoria_id: Optional[int] = None,
    fornecedor_id: Optional[int] = None,
    estoque_baixo: bool = False,
    db: Session = Depends(get_db)
):
    """Relatório de estoque atual"""
    query = db.query(
        Produto.codigo,
        Produto.nome,
        Produto.descricao,
        Produto.preco_custo,
        Produto.preco_venda,
        Produto.quantidade_atual,
        Produto.quantidade_minima,
        Produto.unidade,
        Produto.localizacao
    ).filter(Produto.ativo == True)
    
    if categoria_id:
        query = query.filter(Produto.categoria_id == categoria_id)
    
    if fornecedor_id:
        query = query.filter(Produto.fornecedor_id == fornecedor_id)
    
    if estoque_baixo:
        query = query.filter(Produto.quantidade_atual <= Produto.quantidade_minima)
    
    produtos = query.order_by(Produto.nome).all()
    
    # Calcular valores
    valor_total_estoque = sum(
        float(produto.preco_custo) * produto.quantidade_atual 
        for produto in produtos
    )
    
    produtos_estoque_baixo = sum(
        1 for produto in produtos 
        if produto.quantidade_atual <= produto.quantidade_minima
    )
    
    dados = {
        "data_relatorio": datetime.now().isoformat(),
        "resumo": {
            "total_produtos": len(produtos),
            "valor_total_estoque": valor_total_estoque,
            "produtos_estoque_baixo": produtos_estoque_baixo
        },
        "produtos": [
            {
                "codigo": produto.codigo,
                "nome": produto.nome,
                "descricao": produto.descricao,
                "preco_custo": float(produto.preco_custo),
                "preco_venda": float(produto.preco_venda),
                "quantidade_atual": produto.quantidade_atual,
                "quantidade_minima": produto.quantidade_minima,
                "unidade": produto.unidade,
                "localizacao": produto.localizacao,
                "valor_estoque": float(produto.preco_custo) * produto.quantidade_atual,
                "situacao": "Baixo" if produto.quantidade_atual <= produto.quantidade_minima else "Normal"
            }
            for produto in produtos
        ]
    }
    
    if formato == "json":
        return dados
    elif formato == "excel":
        return gerar_excel_estoque(dados)
    elif formato == "pdf":
        return gerar_pdf_estoque(dados)

@router.get("/movimentacao-estoque")
def relatorio_movimentacao_estoque(
    data_inicio: str,
    data_fim: str,
    formato: str = "json",
    produto_id: Optional[int] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Relatório de movimentação de estoque"""
    try:
        inicio = datetime.fromisoformat(data_inicio.replace('Z', '+00:00')).date()
        fim = datetime.fromisoformat(data_fim.replace('Z', '+00:00')).date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido"
        )
    
    query = db.query(
        MovimentoEstoque.data_movimento,
        Produto.codigo.label('produto_codigo'),
        Produto.nome.label('produto_nome'),
        MovimentoEstoque.tipo,
        MovimentoEstoque.quantidade,
        MovimentoEstoque.preco_unitario,
        MovimentoEstoque.motivo,
        MovimentoEstoque.documento,
        Fornecedor.nome.label('fornecedor')
    ).join(
        Produto, MovimentoEstoque.produto_id == Produto.id
    ).outerjoin(
        Fornecedor, MovimentoEstoque.fornecedor_id == Fornecedor.id
    ).filter(
        func.date(MovimentoEstoque.data_movimento).between(inicio, fim)
    )
    
    if produto_id:
        query = query.filter(MovimentoEstoque.produto_id == produto_id)
    
    if tipo:
        query = query.filter(MovimentoEstoque.tipo == tipo)
    
    movimentos = query.order_by(MovimentoEstoque.data_movimento.desc()).all()
    
    # Calcular totais
    total_entradas = sum(
        float(mov.quantidade) for mov in movimentos if mov.tipo == "entrada"
    )
    total_saidas = sum(
        float(mov.quantidade) for mov in movimentos if mov.tipo == "saida"
    )
    
    dados = {
        "periodo": {
            "data_inicio": inicio.isoformat(),
            "data_fim": fim.isoformat()
        },
        "resumo": {
            "total_movimentos": len(movimentos),
            "total_entradas": total_entradas,
            "total_saidas": total_saidas
        },
        "movimentos": [
            {
                "data": mov.data_movimento.isoformat(),
                "produto_codigo": mov.produto_codigo,
                "produto_nome": mov.produto_nome,
                "tipo": mov.tipo,
                "quantidade": float(mov.quantidade),
                "preco_unitario": float(mov.preco_unitario) if mov.preco_unitario else 0,
                "valor_total": float(mov.quantidade * (mov.preco_unitario or 0)),
                "motivo": mov.motivo,
                "documento": mov.documento,
                "fornecedor": mov.fornecedor
            }
            for mov in movimentos
        ]
    }
    
    if formato == "json":
        return dados

def gerar_excel_vendas(dados):
    """Gerar relatório de vendas em Excel"""
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Aba resumo
        resumo_df = pd.DataFrame([dados["resumo"]])
        resumo_df.to_excel(writer, sheet_name='Resumo', index=False)
        
        # Aba detalhes
        ordens_df = pd.DataFrame(dados["ordens"])
        ordens_df.to_excel(writer, sheet_name='Detalhes', index=False)
    
    output.seek(0)
    
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=relatorio_vendas_{dados['periodo']['data_inicio']}_{dados['periodo']['data_fim']}.xlsx"
        }
    )

def gerar_pdf_vendas(dados):
    """Gerar relatório de vendas em PDF"""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
    
    doc = SimpleDocTemplate(temp_file.name, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    # Título
    title = Paragraph("Relatório de Vendas", styles['Title'])
    story.append(title)
    story.append(Spacer(1, 12))
    
    # Período
    periodo_text = f"Período: {dados['periodo']['data_inicio']} a {dados['periodo']['data_fim']}"
    story.append(Paragraph(periodo_text, styles['Normal']))
    story.append(Spacer(1, 12))
    
    # Resumo
    resumo = dados['resumo']
    resumo_data = [
        ['Total de Ordens', str(resumo['total_ordens'])],
        ['Faturamento Total', f"R$ {resumo['total_faturamento']:.2f}"],
        ['Total Produtos', f"R$ {resumo['total_produtos']:.2f}"],
        ['Total Serviços', f"R$ {resumo['total_servicos']:.2f}"],
        ['Ticket Médio', f"R$ {resumo['ticket_medio']:.2f}"]
    ]
    
    resumo_table = Table(resumo_data, colWidths=[2*inch, 2*inch])
    resumo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(resumo_table)
    story.append(Spacer(1, 24))
    
    # Detalhes (apenas primeiras 20 ordens para não sobrecarregar)
    if dados['ordens']:
        story.append(Paragraph("Detalhes das Ordens (primeiras 20)", styles['Heading2']))
        story.append(Spacer(1, 12))
        
        headers = ['Número', 'Cliente', 'Veículo', 'Status', 'Valor Final']
        detalhes_data = [headers]
        
        for ordem in dados['ordens'][:20]:
            detalhes_data.append([
                ordem['numero'],
                ordem['cliente'][:20] + '...' if len(ordem['cliente']) > 20 else ordem['cliente'],
                ordem['veiculo'][:15] + '...' if len(ordem['veiculo']) > 15 else ordem['veiculo'],
                ordem['status'],
                f"R$ {ordem['valor_final']:.2f}"
            ])
        
        detalhes_table = Table(detalhes_data, colWidths=[1*inch, 2*inch, 1.5*inch, 1*inch, 1*inch])
        detalhes_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(detalhes_table)
    
    doc.build(story)
    
    return FileResponse(
        temp_file.name,
        media_type="application/pdf",
        filename=f"relatorio_vendas_{dados['periodo']['data_inicio']}_{dados['periodo']['data_fim']}.pdf"
    )

def gerar_excel_estoque(dados):
    """Gerar relatório de estoque em Excel"""
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Aba resumo
        resumo_df = pd.DataFrame([dados["resumo"]])
        resumo_df.to_excel(writer, sheet_name='Resumo', index=False)
        
        # Aba produtos
        produtos_df = pd.DataFrame(dados["produtos"])
        produtos_df.to_excel(writer, sheet_name='Produtos', index=False)
    
    output.seek(0)
    
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=relatorio_estoque_{datetime.now().strftime('%Y%m%d')}.xlsx"
        }
    )

def gerar_pdf_estoque(dados):
    """Gerar relatório de estoque em PDF"""
    # Similar ao PDF de vendas, mas para estoque
    # Implementação simplificada
    pass