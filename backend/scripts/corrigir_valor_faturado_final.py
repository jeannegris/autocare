#!/usr/bin/env python3
"""
Script FINAL para corrigir valor_faturado de TODAS as OS's com problema
Este script detecta e corrige automaticamente as inconsistências
"""

import sys
import os
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from db import SessionLocal
from models.autocare_models import OrdemServico, ItemOrdem, MovimentoEstoque
from sqlalchemy import func, and_
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/www/autocare/backend/logs/correcao_valor_faturado.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def calcular_valores_ordem_corrigido(ordem: OrdemServico, db) -> dict:
    """Recalcular valores da ordem usando a lógica corrigida"""
    
    # Buscar itens da ordem
    itens = db.query(ItemOrdem).filter(ItemOrdem.ordem_id == ordem.id).all()
    
    # Buscar movimentos de estoque
    movimentos = db.query(MovimentoEstoque).filter(
        MovimentoEstoque.ordem_servico_id == ordem.id
    ).all()
    
    valor_venda_pecas = Decimal('0.00')
    valor_custo_pecas = Decimal('0.00')
    valor_servico = ordem.valor_servico or Decimal('0.00')
    
    # Somar valores de venda dos itens
    for item in itens:
        if item.tipo == "PRODUTO":
            valor_venda_pecas += Decimal(str(item.valor_total or 0))
            
            # Calcular custo real das peças a partir dos movimentos
            if movimentos:
                for movimento in movimentos:
                    if (movimento.item_id == item.produto_id and 
                        movimento.tipo == "SAIDA"):
                        if movimento.preco_custo:
                            valor_custo_pecas += Decimal(str(movimento.preco_custo)) * Decimal(str(movimento.quantidade))
                        else:
                            valor_custo_pecas += Decimal(str(movimento.preco_unitario or 0)) * Decimal(str(movimento.quantidade or 0))
    
    # Calcular subtotal
    valor_subtotal = valor_venda_pecas + valor_servico
    
    # Calcular desconto
    percentual_desconto = ordem.percentual_desconto or Decimal('0.00')
    tipo_desconto = ordem.tipo_desconto or 'TOTAL'
    
    valor_desconto = Decimal('0.00')
    if percentual_desconto > 0:
        if tipo_desconto == 'VENDA':
            valor_desconto = (valor_venda_pecas * percentual_desconto) / 100
        elif tipo_desconto == 'SERVICO':
            valor_desconto = (valor_servico * percentual_desconto) / 100
        else:  # TOTAL
            valor_desconto = (valor_subtotal * percentual_desconto) / 100
    
    # Mão de obra avulso
    valor_mao_obra_avulso = ordem.valor_mao_obra_avulso or Decimal('0.00')
    
    # VALOR TOTAL
    valor_total = valor_servico + valor_venda_pecas - valor_desconto
    
    # VALOR FATURADO
    valor_faturado = valor_total - valor_custo_pecas - valor_mao_obra_avulso
    
    return {
        'valor_pecas': valor_venda_pecas,
        'valor_servico': valor_servico,
        'valor_subtotal': valor_subtotal,
        'valor_desconto': valor_desconto,
        'valor_mao_obra_avulso': valor_mao_obra_avulso,
        'valor_total': valor_total,
        'valor_custo_pecas': valor_custo_pecas,
        'valor_faturado': valor_faturado
    }

def corrigir_todas_ordens():
    """Corrigir valor_faturado de TODAS as OS's"""
    db = SessionLocal()
    
    try:
        logger.info("=" * 80)
        logger.info("CORRIGINDO VALOR_FATURADO DE TODAS AS OS'S")
        logger.info("=" * 80)
        logger.info("")
        
        # Buscar TODAS as OS's
        ordens = db.query(OrdemServico).order_by(OrdemServico.numero).all()
        
        logger.info(f"📋 Processando {len(ordens)} OS's...")
        logger.info("")
        
        ordens_processadas = 0
        ordens_corrigidas = 0
        erros = []
        
        for idx, ordem in enumerate(ordens, 1):
            try:
                # Verificar se tem itens de produto e movimentos de saída
                itens_produto = db.query(ItemOrdem).filter(
                    and_(
                        ItemOrdem.ordem_id == ordem.id,
                        ItemOrdem.tipo == "PRODUTO"
                    )
                ).all()
                
                if not itens_produto:
                    continue
                
                # Verificar se tem movimentos de SAIDA
                tem_saida = db.query(func.count(MovimentoEstoque.id)).filter(
                    and_(
                        MovimentoEstoque.ordem_servico_id == ordem.id,
                        MovimentoEstoque.tipo == "SAIDA"
                    )
                ).scalar() > 0
                
                if not tem_saida:
                    continue
                
                # Calcular valores corretos
                valores_corrigidos = calcular_valores_ordem_corrigido(ordem, db)
                
                valor_antigo = Decimal(str(ordem.valor_faturado or 0))
                valor_novo = valores_corrigidos['valor_faturado']
                
                # Verificar se houve mudança
                if abs(valor_antigo - valor_novo) > Decimal('0.01'):
                    logger.info(f"[{idx}/{len(ordens)}] OS #{ordem.numero} - CORRIGINDO")
                    logger.info(f"  Valor Faturado: R$ {valor_antigo:.2f} → R$ {valor_novo:.2f}")
                    
                    # Atualizar
                    ordem.valor_pecas = valores_corrigidos['valor_pecas']
                    ordem.valor_servico = valores_corrigidos['valor_servico']
                    ordem.valor_desconto = valores_corrigidos['valor_desconto']
                    ordem.valor_mao_obra_avulso = valores_corrigidos['valor_mao_obra_avulso']
                    ordem.valor_total = valores_corrigidos['valor_total']
                    ordem.valor_custo_pecas = valores_corrigidos['valor_custo_pecas']
                    ordem.valor_faturado = valores_corrigidos['valor_faturado']
                    ordem.valor_mao_obra = ordem.valor_servico
                    ordem.desconto = ordem.valor_desconto
                    
                    db.add(ordem)
                    ordens_corrigidas += 1
                
                ordens_processadas += 1
                
            except Exception as e:
                erro_msg = f"❌ Erro ao processar OS #{ordem.numero}: {str(e)}"
                logger.error(erro_msg)
                erros.append(erro_msg)
        
        # Commit
        if ordens_corrigidas > 0:
            logger.info("")
            logger.info("=" * 80)
            logger.info(f"💾 Salvando {ordens_corrigidas} OS's corrigidas no banco...")
            db.commit()
            logger.info("✅ ALTERAÇÕES SALVAS COM SUCESSO!")
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("RESUMO FINAL")
        logger.info("=" * 80)
        logger.info(f"Total de OS's processadas: {ordens_processadas}")
        logger.info(f"OS's corrigidas: {ordens_corrigidas}")
        if erros:
            logger.info(f"Erros encontrados: {len(erros)}")
            for erro in erros:
                logger.error(f"  {erro}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"❌ Erro geral: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    corrigir_todas_ordens()
