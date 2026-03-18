#!/usr/bin/env python3
"""
Atualiza em lote a forma de pagamento de OS existentes.

Formato esperado do CSV:
numero_os,forma_pagamento,numero_parcelas,maquina_id
OS-0001,PIX,1,
OS-0002,CREDITO,3,2

Colunas obrigatórias:
- numero_os
- forma_pagamento

Colunas opcionais:
- numero_parcelas (default = 1)
- maquina_id (usa a máquina default se vazio)

Uso:
python scripts/atualizar_formas_pagamento_os.py --dry-run
python scripts/atualizar_formas_pagamento_os.py --aplicar
python scripts/atualizar_formas_pagamento_os.py --arquivo caminho/do/arquivo.csv --aplicar
"""

from __future__ import annotations

import argparse
import csv
import logging
import os
import sys
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from db import SessionLocal
from models.autocare_models import Maquina, OrdemServico


TIPOS_PAGAMENTO_VALIDOS = {"DINHEIRO", "PIX", "DEBITO", "CREDITO"}
STATUS_COM_TAXA = {"CONCLUIDA"}

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "atualizacao_formas_pagamento_os.log"
DEFAULT_CSV_PATH = Path(__file__).resolve().parent / "ordens_pagamento.csv"


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class LinhaAtualizacao:
    numero_os: str
    forma_pagamento: str
    numero_parcelas: int = 1
    maquina_id: Optional[int] = None


def normalizar_status_ordem(status: Optional[str]) -> str:
    if not status:
        return ""
    return str(status).strip().upper()


def obter_taxa_pagamento(db, tipo_pagamento: str, maquina_id: Optional[int]) -> Decimal:
    tipo = tipo_pagamento.upper()

    maquina = None
    if maquina_id:
        maquina = db.query(Maquina).filter(Maquina.id == maquina_id).first()
        if maquina is None:
            raise ValueError(f"Máquina não encontrada para maquina_id={maquina_id}")

    if maquina is None:
        maquina = db.query(Maquina).filter(Maquina.eh_default == True).first()

    if not maquina:
        return Decimal('0.00')

    if tipo == 'DINHEIRO':
        return Decimal(str(maquina.taxa_dinheiro or 0))
    if tipo == 'PIX':
        return Decimal(str(maquina.taxa_pix or 0))
    if tipo == 'DEBITO':
        return Decimal(str(maquina.taxa_debito or 0))
    if tipo == 'CREDITO':
        return Decimal(str(maquina.taxa_credito or 0))

    return Decimal('0.00')


def aplicar_taxa_pagamento(ordem: OrdemServico, db, maquina_id: Optional[int]) -> Decimal:
    maquina_resolvida_id = maquina_id
    if maquina_resolvida_id is None:
        maquina_default = db.query(Maquina).filter(Maquina.eh_default == True).first()
        if maquina_default:
            maquina_resolvida_id = maquina_default.id

    if normalizar_status_ordem(ordem.status) not in STATUS_COM_TAXA or not ordem.forma_pagamento:
        ordem.taxa_pagamento_aplicada = Decimal('0.00')
        if maquina_resolvida_id is not None:
            ordem.maquina_id = maquina_resolvida_id
        return Decimal('0.00')

    percentual_taxa = obter_taxa_pagamento(db, ordem.forma_pagamento, maquina_resolvida_id)
    ordem.maquina_id = maquina_resolvida_id

    if percentual_taxa <= 0:
        ordem.taxa_pagamento_aplicada = Decimal('0.00')
        return Decimal('0.00')

    valor_total = Decimal(str(ordem.valor_total or 0))
    valor_custo_pecas = Decimal(str(ordem.valor_custo_pecas or 0))
    valor_mao_obra_avulso = Decimal(str(ordem.valor_mao_obra_avulso or 0))

    taxa_valor = (valor_total * (percentual_taxa / Decimal('100'))).quantize(Decimal('0.01'))
    ordem.taxa_pagamento_aplicada = taxa_valor
    ordem.valor_faturado = valor_total - taxa_valor - valor_custo_pecas - valor_mao_obra_avulso
    return taxa_valor


def carregar_linhas_csv(caminho_arquivo: Path) -> list[LinhaAtualizacao]:
    with caminho_arquivo.open('r', encoding='utf-8-sig', newline='') as arquivo_csv:
        leitor = csv.DictReader(arquivo_csv)
        colunas = {coluna.strip() for coluna in (leitor.fieldnames or [])}
        obrigatorias = {'numero_os', 'forma_pagamento'}
        faltantes = obrigatorias - colunas
        if faltantes:
            raise ValueError(
                f"CSV inválido. Colunas obrigatórias ausentes: {', '.join(sorted(faltantes))}"
            )

        linhas: list[LinhaAtualizacao] = []
        for indice, linha in enumerate(leitor, start=2):
            numero_os = (linha.get('numero_os') or '').strip()
            forma_pagamento = (linha.get('forma_pagamento') or '').strip().upper()
            numero_parcelas_raw = (linha.get('numero_parcelas') or '').strip()
            maquina_id_raw = (linha.get('maquina_id') or '').strip()

            if not numero_os:
                raise ValueError(f"Linha {indice}: numero_os está vazio")

            if forma_pagamento not in TIPOS_PAGAMENTO_VALIDOS:
                raise ValueError(
                    f"Linha {indice}: forma_pagamento '{forma_pagamento}' inválida. "
                    f"Use um destes valores: {', '.join(sorted(TIPOS_PAGAMENTO_VALIDOS))}"
                )

            numero_parcelas = 1
            if numero_parcelas_raw:
                numero_parcelas = int(numero_parcelas_raw)
                if numero_parcelas < 1:
                    raise ValueError(f"Linha {indice}: numero_parcelas deve ser maior ou igual a 1")

            if forma_pagamento != 'CREDITO':
                numero_parcelas = 1

            maquina_id = int(maquina_id_raw) if maquina_id_raw else None
            linhas.append(
                LinhaAtualizacao(
                    numero_os=numero_os,
                    forma_pagamento=forma_pagamento,
                    numero_parcelas=numero_parcelas,
                    maquina_id=maquina_id,
                )
            )

        return linhas


def processar_atualizacao(caminho_arquivo: Path, aplicar: bool) -> int:
    db = SessionLocal()

    try:
        linhas = carregar_linhas_csv(caminho_arquivo)
        logger.info("Arquivo carregado com %s linhas", len(linhas))

        contagem_numeros = Counter(linha.numero_os for linha in linhas)
        numeros_duplicados = sorted([
            numero_os for numero_os, total in contagem_numeros.items() if total > 1
        ])
        if numeros_duplicados:
            raise ValueError(
                "CSV contém OS duplicadas: " + ', '.join(numeros_duplicados)
            )

        atualizadas = 0
        ignoradas = 0

        for linha in linhas:
            ordem = db.query(OrdemServico).filter(OrdemServico.numero == linha.numero_os).first()
            if not ordem:
                raise ValueError(f"OS não encontrada: {linha.numero_os}")

            forma_anterior = ordem.forma_pagamento
            taxa_anterior = Decimal(str(ordem.taxa_pagamento_aplicada or 0))
            parcelas_anteriores = ordem.numero_parcelas or 1
            maquina_anterior = ordem.maquina_id

            ordem.forma_pagamento = linha.forma_pagamento
            ordem.numero_parcelas = linha.numero_parcelas

            taxa_nova = aplicar_taxa_pagamento(ordem, db, linha.maquina_id)

            houve_mudanca = any([
                forma_anterior != ordem.forma_pagamento,
                taxa_anterior != Decimal(str(ordem.taxa_pagamento_aplicada or 0)),
                parcelas_anteriores != ordem.numero_parcelas,
                maquina_anterior != ordem.maquina_id,
            ])

            if houve_mudanca:
                atualizadas += 1
                logger.info(
                    "OS %s: %s -> %s | parcelas %s -> %s | maquina %s -> %s | taxa R$ %.2f -> R$ %.2f",
                    ordem.numero,
                    forma_anterior or '-',
                    ordem.forma_pagamento,
                    parcelas_anteriores,
                    ordem.numero_parcelas,
                    maquina_anterior if maquina_anterior is not None else '-',
                    ordem.maquina_id if ordem.maquina_id is not None else '-',
                    taxa_anterior,
                    taxa_nova,
                )
            else:
                ignoradas += 1
                logger.info("OS %s: sem alteração necessária", ordem.numero)

        if aplicar:
            db.commit()
            logger.info("Atualização concluída. %s OS alteradas e %s sem mudança.", atualizadas, ignoradas)
        else:
            db.rollback()
            logger.info("Simulação concluída. %s OS seriam alteradas e %s ficariam sem mudança.", atualizadas, ignoradas)

        return atualizadas
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Atualiza em lote a forma de pagamento das OS existentes"
    )
    parser.add_argument(
        '--arquivo',
        default=str(DEFAULT_CSV_PATH),
        help='Caminho para o CSV com as OS e formas de pagamento',
    )

    modo = parser.add_mutually_exclusive_group()
    modo.add_argument(
        '--dry-run',
        action='store_true',
        help='Executa apenas simulação sem gravar no banco',
    )
    modo.add_argument(
        '--aplicar',
        action='store_true',
        help='Grava as alterações no banco',
    )
    return parser


def main() -> int:
    parser = construir_parser()
    args = parser.parse_args()

    caminho_arquivo = Path(args.arquivo).expanduser().resolve()
    if not caminho_arquivo.exists():
        parser.error(f"Arquivo não encontrado: {caminho_arquivo}")

    aplicar = bool(args.aplicar)
    if not args.dry_run and not args.aplicar:
        logger.info("Nenhum modo informado. Executando em simulação por segurança.")

    atualizadas = processar_atualizacao(caminho_arquivo, aplicar=aplicar)
    logger.info("Processamento finalizado. Total de OS alteradas: %s", atualizadas)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())