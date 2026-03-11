#!/usr/bin/env python3
"""
Script para corrigir valor_faturado de todas as OS's criadas antes da correção
Recalcula os valores usando a mesma lógica da função calcular_valores_ordem
"""

import sys
import os
from decimal import Decimal
from datetime import datetime
import pytz

# Adicionar o diretório pai ao path para importar os módulos do backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from db import SessionLocal
from models.autocare_models import OrdemServico, ItemOrdem, MovimentoEstoque
from sqlalchemy import func, and_
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def calcular_valores_ordem_corrigido(ordem: OrdemServico, db) -> dict:
    """
    Recalcular valores da ordem usando a lógica corrigida
    
    Valor Total (cobrado ao cliente) = Valor Serviço + Valor Venda Peças - Desconto
    Valor Faturado (lucro líquido) = Valor Total - Valor Custo Peças - Valor Mão de Obra Avulsa
    """
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
    
    # VALOR TOTAL (cobrado ao cliente)
    valor_total = valor_servico + valor_venda_pecas - valor_desconto
    
    # VALOR FATURADO (lucro líquido) - ESTA É A CHAVE
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

def corrigir_valor_faturado_ordens():
    """
    Corrigir valor_faturado de todas as OS's a partir de #00000055
    """
    db = SessionLocal()
    
    try:
        logger.info("=" * 70)
        logger.info("INICIANDO CORREÇÃO DE VALOR FATURADO")
        logger.info("=" * 70)
        
        # Buscar todas as OS's a partir de #00000055
        numero_minimo = "00000055"
        ordens = db.query(OrdemServico).filter(
            OrdemServico.numero >= numero_minimo
        ).order_by(OrdemServico.numero).all()
        
        if not ordens:
            logger.warning(f"❌ Nenhuma OS encontrada com número >= {numero_minimo}")
            return
        
        logger.info(f"📋 Encontradas {len(ordens)} OS's para corrigir (a partir de #{numero_minimo})")
        logger.info("")
        
        ordens_corrigidas = 0
        ordens_com_mudanca = 0
        erros = []
        
        for idx, ordem in enumerate(ordens, 1):
            try:
                # Recalcular valores
                valores_corrigidos = calcular_valores_ordem_corrigido(ordem, db)
                
                valor_antigo = ordem.valor_faturado or Decimal('0.00')
                valor_novo = valores_corrigidos['valor_faturado']
                
                # Log detalhado
                logger.info(f"[{idx}/{len(ordens)}] OS #{ordem.numero} - Cliente: {ordem.cliente_id}")
                logger.info(f"  Valor Total: R$ {valores_corrigidos['valor_total']:.2f}")
                logger.info(f"  Valor Custo Peças: R$ {valores_corrigidos['valor_custo_pecas']:.2f}")
                logger.info(f"  Mão de Obra Avulso: R$ {valores_corrigidos['valor_mao_obra_avulso']:.2f}")
                logger.info(f"  Valor Faturado ANTERIOR: R$ {valor_antigo:.2f}")
                logger.info(f"  Valor Faturado NOVO: R$ {valor_novo:.2f}")
                
                # Verificar se houve mudança
                if valor_antigo != valor_novo:
                    diferenca = valor_novo - valor_antigo
                    logger.info(f"  ✏️  ALTERAÇÃO: {'-' if diferenca < 0 else '+'} R$ {abs(diferenca):.2f}")
                    ordens_com_mudanca += 1
                    
                    # Atualizar a ordem
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
                else:
                    logger.info(f"  ✅ Sem alterações necessárias")
                
                ordens_corrigidas += 1
                logger.info("")
                
            except Exception as e:
                erro_msg = f"❌ Erro ao processar OS #{ordem.numero}: {str(e)}"
                logger.error(erro_msg)
                erros.append(erro_msg)
        
        # Commit de todas as alterações
        if ordens_com_mudanca > 0:
            logger.info("=" * 70)
            logger.info(f"📝 Salvando {ordens_com_mudanca} OS's corrigidas no banco...")
            db.commit()
            logger.info("✅ ALTERAÇÕES SALVAS COM SUCESSO!")
        else:
            logger.info("=" * 70)
            logger.info("✅ Todas as OS's já estão com valores corretos!")
        
        logger.info("")
        logger.info("=" * 70)
        logger.info("RESUMO DO PROCESSO")
        logger.info("=" * 70)
        logger.info(f"Total de OS's processadas: {ordens_corrigidas}")
        logger.info(f"OS's com alterações: {ordens_com_mudanca}")
        logger.info(f"OS's sem alterações: {ordens_corrigidas - ordens_com_mudanca}")
        if erros:
            logger.info(f"Erros encontrados: {len(erros)}")
            for erro in erros:
                logger.error(f"  {erro}")
        logger.info("=" * 70)
        
    except Exception as e:
        logger.error(f"❌ Erro geral no script: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    corrigir_valor_faturado_ordens()
