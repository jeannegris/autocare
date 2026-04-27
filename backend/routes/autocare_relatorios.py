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
from pathlib import Path

from db import get_db


def _get_logo_path(db: Session) -> Optional[str]:
    """Retorna o caminho absoluto do logotipo da empresa, ou None se não configurado."""
    try:
        cfg = db.query(Configuracao).filter(Configuracao.chave == "logo_empresa").first()
        if cfg and cfg.valor:
            p = Path(cfg.valor)
            if p.exists():
                return str(p)
    except Exception:
        pass
    return None


def _make_logo_callback(logo_path: Optional[str], page_size=A4):
    """Cria callback ReportLab que desenha o logotipo no canto superior direito de cada página."""
    def _draw(canvas, doc):
        if not logo_path:
            return
        try:
            logo_w = 1.5 * inch
            logo_h = 0.65 * inch
            margin = 0.22 * inch
            x = page_size[0] - logo_w - margin
            y = page_size[1] - logo_h - margin
            canvas.saveState()
            canvas.drawImage(
                logo_path, x, y, width=logo_w, height=logo_h,
                preserveAspectRatio=True, mask="auto",
            )
            canvas.restoreState()
        except Exception:
            pass
    return _draw


from models.autocare_models import (
    Cliente, Veiculo, OrdemServico, Produto, MovimentoEstoque, 
    ItemOrdem, Fornecedor, Configuracao
)

router = APIRouter()


def formatar_data_br(valor, incluir_hora: bool = False) -> str:
    if not valor:
        return "-"

    try:
        data = datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
        return data.strftime('%d/%m/%Y %H:%M' if incluir_hora else '%d/%m/%Y')
    except (TypeError, ValueError):
        return str(valor)


def converter_coluna_data_excel(dataframe: pd.DataFrame, coluna: str):
    if coluna in dataframe.columns:
        dataframe[coluna] = pd.to_datetime(dataframe[coluna], utc=True, errors='coerce').dt.tz_localize(None)


def aplicar_formato_data_excel(worksheet, coluna: str, incluir_hora: bool = False):
    formato = 'dd/mm/yyyy hh:mm' if incluir_hora else 'dd/mm/yyyy'
    for cell in worksheet[coluna][1:]:
        if cell.value:
            cell.number_format = formato


def ajustar_largura_colunas(worksheet, larguras: dict[str, int]):
    for coluna, largura in larguras.items():
        worksheet.column_dimensions[coluna].width = largura

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
        return gerar_pdf_vendas(dados, _get_logo_path(db))
    
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
        return gerar_pdf_estoque(dados, _get_logo_path(db))

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

    data_referencia = func.coalesce(MovimentoEstoque.data_movimentacao, MovimentoEstoque.created_at)

    query = db.query(
        data_referencia.label('data_movimento'),
        Produto.codigo.label('produto_codigo'),
        Produto.nome.label('produto_nome'),
        MovimentoEstoque.tipo,
        MovimentoEstoque.quantidade,
        MovimentoEstoque.preco_unitario,
        MovimentoEstoque.valor_total,
        MovimentoEstoque.motivo,
        MovimentoEstoque.observacoes,
        MovimentoEstoque.ordem_servico_id,
        OrdemServico.numero.label('ordem_servico_numero'),
        Fornecedor.nome.label('fornecedor')
    ).join(
        Produto, MovimentoEstoque.item_id == Produto.id
    ).outerjoin(
        OrdemServico, MovimentoEstoque.ordem_servico_id == OrdemServico.id
    ).outerjoin(
        Fornecedor, MovimentoEstoque.fornecedor_id == Fornecedor.id
    ).filter(
        func.date(data_referencia).between(inicio, fim)
    )

    if produto_id:
        query = query.filter(MovimentoEstoque.item_id == produto_id)

    if tipo:
        query = query.filter(func.upper(MovimentoEstoque.tipo) == tipo.upper())

    movimentos = query.order_by(data_referencia.desc()).all()

    # Calcular totais
    total_entradas = sum(
        float(mov.quantidade) for mov in movimentos if (mov.tipo or '').upper() == "ENTRADA"
    )
    total_saidas = sum(
        float(mov.quantidade) for mov in movimentos if (mov.tipo or '').upper() == "SAIDA"
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
                "tipo": (mov.tipo or '').lower(),
                "quantidade": float(mov.quantidade),
                "preco_unitario": float(mov.preco_unitario) if mov.preco_unitario else 0,
                "valor_total": float(mov.valor_total) if mov.valor_total is not None else float(mov.quantidade * (mov.preco_unitario or 0)),
                "motivo": mov.motivo,
                "documento": f"OS {mov.ordem_servico_numero}" if mov.ordem_servico_numero else (f"OS {mov.ordem_servico_id}" if mov.ordem_servico_id else None),
                "observacoes": mov.observacoes,
                "fornecedor": mov.fornecedor
            }
            for mov in movimentos
        ]
    }

    if formato == "json":
        return dados

    elif formato == "excel":
        return gerar_excel_movimentacao_estoque(dados)

    elif formato == "pdf":
        return gerar_pdf_movimentacao_estoque(dados, _get_logo_path(db))

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato não suportado. Use: json, excel ou pdf"
        )

def gerar_excel_vendas(dados):
    """Gerar relatório de vendas em Excel"""
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Aba resumo
        resumo_excel = {
            "Data Inicial": formatar_data_br(dados['periodo']['data_inicio']),
            "Data Final": formatar_data_br(dados['periodo']['data_fim']),
            "Total de Ordens": dados['resumo']['total_ordens'],
            "Faturamento Total": dados['resumo']['total_faturamento'],
            "Total Produtos": dados['resumo']['total_produtos'],
            "Total Serviços": dados['resumo']['total_servicos'],
            "Ticket Médio": dados['resumo']['ticket_medio'],
        }
        resumo_df = pd.DataFrame([resumo_excel])
        resumo_df.to_excel(writer, sheet_name='Resumo', index=False)
        
        # Aba detalhes
        ordens_df = pd.DataFrame(dados["ordens"])
        if not ordens_df.empty:
            converter_coluna_data_excel(ordens_df, 'data_abertura')
            converter_coluna_data_excel(ordens_df, 'data_conclusao')
            ordens_df = ordens_df.rename(columns={
                'numero': 'Número',
                'data_abertura': 'Data Abertura',
                'data_conclusao': 'Data Conclusão',
                'cliente': 'Cliente',
                'veiculo': 'Veículo',
                'status': 'Status',
                'valor_produtos': 'Valor Produtos',
                'valor_servicos': 'Valor Serviços',
                'valor_total': 'Valor Total',
                'desconto': 'Desconto',
                'valor_final': 'Valor Final'
            })
        ordens_df.to_excel(writer, sheet_name='Detalhes', index=False)

        detalhes_ws = writer.sheets['Detalhes']
        if not ordens_df.empty:
            aplicar_formato_data_excel(detalhes_ws, 'B', incluir_hora=True)
            aplicar_formato_data_excel(detalhes_ws, 'C', incluir_hora=True)
        ajustar_largura_colunas(detalhes_ws, {
            'A': 14,
            'B': 19,
            'C': 19,
            'D': 28,
            'E': 32,
            'F': 18,
            'G': 16,
            'H': 16,
            'I': 16,
            'J': 14,
            'K': 16,
        })
    
    output.seek(0)
    
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=relatorio_vendas_{dados['periodo']['data_inicio']}_{dados['periodo']['data_fim']}.xlsx"
        }
    )

def gerar_pdf_vendas(dados, logo_path=None):
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
    periodo_text = f"Período: {formatar_data_br(dados['periodo']['data_inicio'])} a {formatar_data_br(dados['periodo']['data_fim'])}"
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
        
        headers = ['Número', 'Abertura', 'Cliente', 'Status', 'Valor Final']
        detalhes_data = [headers]
        
        for ordem in dados['ordens'][:20]:
            detalhes_data.append([
                ordem['numero'],
                formatar_data_br(ordem['data_abertura'], incluir_hora=True),
                ordem['cliente'][:20] + '...' if len(ordem['cliente']) > 20 else ordem['cliente'],
                ordem['status'],
                f"R$ {ordem['valor_final']:.2f}"
            ])
        
        detalhes_table = Table(detalhes_data, colWidths=[1*inch, 1.3*inch, 2.2*inch, 1.2*inch, 1.1*inch])
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
    
    _cb = _make_logo_callback(logo_path)
    doc.build(story, onFirstPage=_cb, onLaterPages=_cb)
    
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
        resumo_excel = {
            "Data Relatório": pd.to_datetime(dados['data_relatorio'], utc=True, errors='coerce').tz_localize(None),
            "Total de Produtos": dados['resumo']['total_produtos'],
            "Valor Total Estoque": dados['resumo']['valor_total_estoque'],
            "Produtos Estoque Baixo": dados['resumo']['produtos_estoque_baixo'],
        }
        resumo_df = pd.DataFrame([resumo_excel])
        resumo_df.to_excel(writer, sheet_name='Resumo', index=False)
        
        # Aba produtos
        produtos_df = pd.DataFrame(dados["produtos"])
        if not produtos_df.empty:
            produtos_df = produtos_df.rename(columns={
                'codigo': 'Código',
                'nome': 'Produto',
                'descricao': 'Descrição',
                'preco_custo': 'Preço Custo',
                'preco_venda': 'Preço Venda',
                'quantidade_atual': 'Quantidade Atual',
                'quantidade_minima': 'Quantidade Mínima',
                'unidade': 'Unidade',
                'localizacao': 'Localização',
                'valor_estoque': 'Valor Estoque',
                'situacao': 'Situação'
            })
        produtos_df.to_excel(writer, sheet_name='Produtos', index=False)

        resumo_ws = writer.sheets['Resumo']
        aplicar_formato_data_excel(resumo_ws, 'A', incluir_hora=True)
        ajustar_largura_colunas(resumo_ws, {'A': 20, 'B': 18, 'C': 20, 'D': 22})

        produtos_ws = writer.sheets['Produtos']
        ajustar_largura_colunas(produtos_ws, {
            'A': 12,
            'B': 30,
            'C': 36,
            'D': 14,
            'E': 14,
            'F': 16,
            'G': 16,
            'H': 12,
            'I': 18,
            'J': 16,
            'K': 14,
        })
    
    output.seek(0)
    
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=relatorio_estoque_{datetime.now().strftime('%Y%m%d')}.xlsx"
        }
    )

def gerar_pdf_estoque(dados, logo_path=None):
    """Gerar relatório de estoque em PDF"""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')

    doc = SimpleDocTemplate(temp_file.name, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()

    story.append(Paragraph("Relatório de Estoque", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"Data do relatório: {formatar_data_br(dados['data_relatorio'], incluir_hora=True)}",
        styles['Normal']
    ))
    story.append(Spacer(1, 12))

    resumo = dados['resumo']
    resumo_data = [
        ['Total de Produtos', str(resumo['total_produtos'])],
        ['Valor Total Estoque', f"R$ {resumo['valor_total_estoque']:.2f}"],
        ['Produtos Estoque Baixo', str(resumo['produtos_estoque_baixo'])],
    ]
    resumo_table = Table(resumo_data, colWidths=[2.2 * inch, 2.2 * inch])
    resumo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
    ]))
    story.append(resumo_table)
    story.append(Spacer(1, 18))

    if dados['produtos']:
        story.append(Paragraph("Produtos (primeiros 30 registros)", styles['Heading2']))
        story.append(Spacer(1, 8))

        tabela_data = [['Código', 'Produto', 'Qtd', 'Mín.', 'Situação']]
        for produto in dados['produtos'][:30]:
            tabela_data.append([
                produto['codigo'],
                (produto['nome'] or '')[:30],
                str(produto['quantidade_atual']),
                str(produto['quantidade_minima']),
                produto['situacao'],
            ])

        detalhes_table = Table(tabela_data, colWidths=[1.0 * inch, 2.8 * inch, 0.8 * inch, 0.8 * inch, 1.2 * inch])
        detalhes_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(detalhes_table)

    _cb = _make_logo_callback(logo_path)
    doc.build(story, onFirstPage=_cb, onLaterPages=_cb)

    return FileResponse(
        temp_file.name,
        media_type="application/pdf",
        filename=f"relatorio_estoque_{datetime.now().strftime('%Y%m%d')}.pdf"
    )

def gerar_excel_movimentacao_estoque(dados):
    """Gerar relatório de movimentação de estoque em Excel"""
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        resumo_df = pd.DataFrame([dados["resumo"]])
        resumo_df.to_excel(writer, sheet_name='Resumo', index=False)

        movimentos_df = pd.DataFrame(dados["movimentos"])
        if not movimentos_df.empty:
            movimentos_df["data"] = pd.to_datetime(movimentos_df["data"], utc=True, errors='coerce').dt.tz_localize(None)
            movimentos_df = movimentos_df.rename(columns={
                "data": "Data",
                "produto_codigo": "Código",
                "produto_nome": "Produto",
                "tipo": "Tipo",
                "quantidade": "Quantidade",
                "preco_unitario": "Preço Unitário",
                "valor_total": "Valor Total",
                "motivo": "Motivo",
                "documento": "Documento",
                "observacoes": "Observações",
                "fornecedor": "Fornecedor"
            })
        movimentos_df.to_excel(writer, sheet_name='Movimentações', index=False)

        if not movimentos_df.empty:
            worksheet = writer.sheets['Movimentações']
            for cell in worksheet['A'][1:]:
                cell.number_format = 'dd/mm/yyyy hh:mm:ss'

            column_widths = {
                'A': 22,
                'B': 12,
                'C': 32,
                'D': 12,
                'E': 12,
                'F': 15,
                'G': 15,
                'H': 24,
                'I': 14,
                'J': 50,
                'K': 24,
            }
            for column, width in column_widths.items():
                worksheet.column_dimensions[column].width = width

    output.seek(0)

    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=relatorio_movimentacao_estoque_{dados['periodo']['data_inicio']}_{dados['periodo']['data_fim']}.xlsx"
        }
    )

def gerar_pdf_movimentacao_estoque(dados, logo_path=None):
    """Gerar relatório de movimentação de estoque em PDF"""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')

    doc = SimpleDocTemplate(temp_file.name, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()

    story.append(Paragraph("Relatório de Movimentação de Estoque", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"Período: {formatar_data_br(dados['periodo']['data_inicio'])} a {formatar_data_br(dados['periodo']['data_fim'])}",
        styles['Normal']
    ))
    story.append(Spacer(1, 12))

    resumo = dados['resumo']
    resumo_data = [
        ['Total de Movimentos', str(resumo['total_movimentos'])],
        ['Total de Entradas', str(resumo['total_entradas'])],
        ['Total de Saídas', str(resumo['total_saidas'])],
    ]
    resumo_table = Table(resumo_data, colWidths=[2.2 * inch, 2.2 * inch])
    resumo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
    ]))
    story.append(resumo_table)
    story.append(Spacer(1, 18))

    if dados['movimentos']:
        story.append(Paragraph("Movimentações (primeiros 30 registros)", styles['Heading2']))
        story.append(Spacer(1, 8))

        tabela_data = [['Data', 'Produto', 'Tipo', 'Qtd', 'Motivo']]
        for movimento in dados['movimentos'][:30]:
            data_formatada = '-'
            if movimento['data']:
                try:
                    data_formatada = datetime.fromisoformat(movimento['data'].replace('Z', '+00:00')).strftime('%d/%m/%Y %H:%M')
                except ValueError:
                    data_formatada = movimento['data'][:16]

            tabela_data.append([
                data_formatada,
                (movimento['produto_nome'] or '')[:24],
                (movimento['tipo'] or '').upper(),
                str(movimento['quantidade']),
                (movimento['motivo'] or '')[:28],
            ])

        detalhes_table = Table(tabela_data, colWidths=[1.4 * inch, 2.1 * inch, 0.9 * inch, 0.6 * inch, 2.4 * inch])
        detalhes_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(detalhes_table)

    _cb = _make_logo_callback(logo_path)
    doc.build(story, onFirstPage=_cb, onLaterPages=_cb)

    return FileResponse(
        temp_file.name,
        media_type="application/pdf",
        filename=f"relatorio_movimentacao_estoque_{dados['periodo']['data_inicio']}_{dados['periodo']['data_fim']}.pdf"
    )