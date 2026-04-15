import io
import smtplib
from datetime import datetime
from decimal import Decimal
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional
import re
import unicodedata

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session, joinedload

from config import SMTP_PASS, SMTP_PORT, SMTP_SERVER, SMTP_USER
from models.autocare_models import Configuracao, EmailEnvioLog, ItemOrdem, OrdemServico


def _normalizar_status_ordem(status_value: Any) -> str:
    if status_value is None:
        return ""
    status_ascii = unicodedata.normalize("NFKD", str(status_value))
    status_ascii = status_ascii.encode("ascii", "ignore").decode("ascii")
    status_ascii = re.sub(r"[^A-Z]+", "_", status_ascii.upper()).strip("_")
    return status_ascii


def _config_value(db: Session, chave: str, default: str = "") -> str:
    config = db.query(Configuracao).filter(Configuracao.chave == chave).first()
    if not config or config.valor is None:
        return default
    return str(config.valor)


def _config_bool(db: Session, chave: str, default: bool = True) -> bool:
    valor = _config_value(db, chave, "true" if default else "false").strip().lower()
    return valor in ("1", "true", "sim", "yes", "on")


def _registrar_log_email(
    db: Session,
    ordem: Optional[OrdemServico],
    destinatario: Optional[str],
    origem_envio: str,
    status_envio: str,
    mensagem: str,
) -> None:
    try:
        log = EmailEnvioLog(
            ordem_id=ordem.id if ordem else None,
            ordem_numero=str(ordem.numero) if ordem and ordem.numero else None,
            destinatario=destinatario,
            origem_envio=origem_envio,
            status=status_envio,
            mensagem=mensagem,
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()


def _money(value: Any) -> str:
    try:
        valor = Decimal(str(value or 0))
    except Exception:
        valor = Decimal("0.00")
    return f"R$ {valor:.2f}"


def _data_br(value: Any, incluir_hora: bool = False) -> str:
    if not value:
        return "-"

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M" if incluir_hora else "%d/%m/%Y")

    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M" if incluir_hora else "%d/%m/%Y")
    except Exception:
        return str(value)


def gerar_pdf_fechamento_os(db: Session, ordem_id: int) -> bytes:
    ordem = db.query(OrdemServico).options(
        joinedload(OrdemServico.cliente),
        joinedload(OrdemServico.veiculo),
        joinedload(OrdemServico.itens).joinedload(ItemOrdem.produto),
    ).filter(OrdemServico.id == ordem_id).first()

    if not ordem:
        raise ValueError("Ordem de serviço não encontrada")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(f"Fechamento da OS {ordem.numero}", styles["Title"]))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(f"Emitido em: {_data_br(datetime.now(), incluir_hora=True)}", styles["Normal"]))
    elements.append(Spacer(1, 12))

    cliente_nome = ordem.cliente.nome if ordem.cliente else "-"
    cliente_email = ordem.cliente.email if ordem.cliente else "-"
    veiculo = "-"
    if ordem.veiculo:
        veiculo = f"{ordem.veiculo.marca} {ordem.veiculo.modelo} - {ordem.veiculo.placa}"

    dados_gerais = [
        ["OS", str(ordem.numero or "-"), "Status", str(_normalizar_status_ordem(ordem.status) or ordem.status or "-")],
        ["Cliente", cliente_nome, "E-mail", cliente_email or "-"],
        ["Veículo", veiculo, "Data abertura", _data_br(ordem.data_abertura)],
        ["Data conclusão", _data_br(ordem.data_conclusao), "Responsável", str(ordem.funcionario_responsavel or "-")],
    ]

    tabela_dados = Table(dados_gerais, colWidths=[95, 180, 90, 165])
    tabela_dados.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(tabela_dados)
    elements.append(Spacer(1, 14))

    itens_servico = [item for item in ordem.itens if str(item.tipo or "").upper() == "SERVICO"]
    itens_produto = [item for item in ordem.itens if str(item.tipo or "").upper() == "PRODUTO"]

    # Descrição do serviço principal cadastrada na OS.
    if ordem.descricao_servico:
        elements.append(Paragraph("Descrição do Serviço", styles["Heading3"]))
        elements.append(Paragraph(str(ordem.descricao_servico), styles["Normal"]))
        elements.append(Spacer(1, 8))

    if ordem.descricao_problema:
        elements.append(Paragraph("Descrição Complementar", styles["Heading3"]))
        elements.append(Paragraph(str(ordem.descricao_problema), styles["Normal"]))
        elements.append(Spacer(1, 8))

    if itens_servico:
        elements.append(Paragraph("Resumo dos Serviços", styles["Heading3"]))
        linhas = [["Descrição", "Qtd", "Valor Unit.", "Valor Total"]]
        for item in itens_servico:
            linhas.append([
                str(item.descricao or "-"),
                str(item.quantidade or 0),
                _money(item.valor_unitario),
                _money(item.valor_total),
            ])
        tab = Table(linhas, colWidths=[300, 50, 90, 90])
        tab.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        elements.append(tab)
        elements.append(Spacer(1, 10))

    if itens_produto:
        elements.append(Paragraph("Resumo de Peças/Produtos", styles["Heading3"]))
        linhas = [["Peça/Produto", "Descrição", "Qtd", "Valor Unit.", "Valor Total"]]
        for item in itens_produto:
            nome_item = item.produto.nome if item.produto else item.descricao
            descricao_item = item.descricao or "-"
            linhas.append([
                str(nome_item or "-"),
                str(descricao_item),
                str(item.quantidade or 0),
                _money(item.valor_unitario),
                _money(item.valor_total),
            ])
        tab = Table(linhas, colWidths=[170, 150, 40, 85, 85])
        tab.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        elements.append(tab)
        elements.append(Spacer(1, 10))

    elements.append(Paragraph("Resumo Financeiro", styles["Heading3"]))
    financeiro = [
        ["Valor de Serviços", _money(ordem.valor_servico)],
        ["Valor de Peças", _money(ordem.valor_pecas)],
        ["Desconto", _money(ordem.valor_desconto)],
        ["Valor Total", _money(ordem.valor_total)],
        ["Forma de Pagamento", str(ordem.forma_pagamento or "-")],
    ]
    tab_fin = Table(financeiro, colWidths=[220, 120])
    tab_fin.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    elements.append(tab_fin)

    doc.build(elements)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def enviar_email_fechamento_os(
    db: Session,
    ordem_id: int,
    destinatario_override: Optional[str] = None,
    ignorar_opt_in: bool = False,
    origem_envio: str = "automatico",
) -> Dict[str, Any]:
    ordem = db.query(OrdemServico).options(
        joinedload(OrdemServico.cliente),
    ).filter(OrdemServico.id == ordem_id).first()

    if not ordem:
        _registrar_log_email(db, None, destinatario_override, origem_envio, "erro", "Ordem não encontrada")
        return {"success": False, "retryable": False, "message": "Ordem não encontrada"}

    envio_global_habilitado = _config_bool(db, "email_envio_habilitado", True)
    if not envio_global_habilitado:
        _registrar_log_email(
            db,
            ordem,
            destinatario_override or (ordem.cliente.email if ordem.cliente else None),
            origem_envio,
            "bloqueado",
            "Envio de e-mail desabilitado globalmente na aplicação",
        )
        return {
            "success": False,
            "retryable": False,
            "message": "Envio de e-mail desabilitado globalmente na aplicação",
        }

    if _normalizar_status_ordem(ordem.status) != "CONCLUIDA":
        _registrar_log_email(db, ordem, destinatario_override, origem_envio, "bloqueado", "Ordem ainda não está concluída")
        return {"success": False, "retryable": False, "message": "Ordem ainda não está concluída"}

    cliente_email = destinatario_override or (ordem.cliente.email if ordem.cliente else None)

    if not destinatario_override and not ignorar_opt_in:
        cliente_opt_in = bool(ordem.cliente and ordem.cliente.enviar_relatorio_email)
        if not cliente_opt_in:
            _registrar_log_email(
                db,
                ordem,
                cliente_email,
                origem_envio,
                "bloqueado",
                "Cliente não autorizou envio automático de relatório por e-mail",
            )
            return {
                "success": False,
                "retryable": False,
                "message": "Cliente não autorizou envio automático de relatório por e-mail",
            }

    if not cliente_email:
        _registrar_log_email(db, ordem, cliente_email, origem_envio, "bloqueado", "Cliente sem e-mail cadastrado")
        return {"success": False, "retryable": False, "message": "Cliente sem e-mail cadastrado"}

    smtp_server = _config_value(db, "smtp_server", SMTP_SERVER)
    smtp_port_raw = _config_value(db, "smtp_port", str(SMTP_PORT))
    smtp_user = _config_value(db, "smtp_user", SMTP_USER)
    smtp_pass = _config_value(db, "smtp_pass", SMTP_PASS)

    if not smtp_user or not smtp_pass:
        _registrar_log_email(db, ordem, cliente_email, origem_envio, "erro", "Credenciais SMTP não configuradas")
        return {"success": False, "retryable": False, "message": "Credenciais SMTP não configuradas"}

    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        smtp_port = int(SMTP_PORT)

    try:
        pdf_bytes = gerar_pdf_fechamento_os(db, ordem_id)

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = cliente_email
        msg["Subject"] = f"Resumo da OS {ordem.numero} - AutoCare"

        nome_cliente = ordem.cliente.nome if ordem.cliente else "Cliente"
        corpo = (
            f"Olá {nome_cliente},\n\n"
            f"Segue em anexo o resumo do fechamento da sua Ordem de Serviço {ordem.numero}.\n"
            "Obrigado por confiar na nossa equipe.\n\n"
            "Atenciosamente,\n"
            "AutoCare"
        )
        msg.attach(MIMEText(corpo, "plain", "utf-8"))

        anexo = MIMEApplication(pdf_bytes, _subtype="pdf")
        anexo.add_header("Content-Disposition", "attachment", filename=f"OS_{ordem.numero}.pdf")
        msg.attach(anexo)

        with smtplib.SMTP(smtp_server, smtp_port, timeout=30) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        _registrar_log_email(
            db,
            ordem,
            cliente_email,
            origem_envio,
            "sucesso",
            f"E-mail enviado com sucesso para {cliente_email}",
        )

        return {
            "success": True,
            "retryable": False,
            "message": f"E-mail de fechamento enviado para {cliente_email}",
            "ordem_id": ordem_id,
            "destinatario": cliente_email,
        }

    except smtplib.SMTPException as exc:
        _registrar_log_email(db, ordem, cliente_email, origem_envio, "erro", f"Erro SMTP: {str(exc)}")
        return {
            "success": False,
            "retryable": True,
            "message": f"Erro SMTP ao enviar e-mail: {str(exc)}",
            "ordem_id": ordem_id,
        }
    except Exception as exc:
        _registrar_log_email(db, ordem, cliente_email, origem_envio, "erro", f"Erro ao gerar/enviar: {str(exc)}")
        return {
            "success": False,
            "retryable": True,
            "message": f"Erro ao gerar/enviar e-mail da OS: {str(exc)}",
            "ordem_id": ordem_id,
        }
