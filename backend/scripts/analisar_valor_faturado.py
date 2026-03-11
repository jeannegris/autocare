#!/usr/bin/env python3
"""
Script para identificar e listar OS's com valor_faturado potencialmente incorreto
Uma OS tem problema se:
- Tem itens do tipo PRODUTO
- Tem movimentos de SAIDA (baixa aplicada)
- Mas valor_faturado parece estar errado (suspeitamente igual a valor_total)
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
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def analisar_ordens():
    """Analisar todas as OS's para encontrar valores faturados incorretos"""
    db = SessionLocal()
    
    try:
        logger.info("=" * 80)
        logger.info("ANÁLISE DE OS'S COM VALOR_FATURADO POTENCIALMENTE INCORRETO")
        logger.info("=" * 80)
        logger.info("")
        
        # Buscar TODAS as OS's que têm itens de PRODUTO e movimentos de SAIDA
        ordens_problematicas = []
        
        ordens = db.query(OrdemServico).all()
        logger.info(f"Analisando {len(ordens)} OS's...")
        logger.info("")
        
        for ordem in ordens:
            # Verificar se tem itens de produto
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
            
            # Esta OS tem itens de produto e movimentos de saída
            # Verificar se pode estar com valor_faturado errado
            valor_total = Decimal(str(ordem.valor_total or 0))
            valor_faturado = Decimal(str(ordem.valor_faturado or 0))
            valor_custo = Decimal(str(ordem.valor_custo_pecas or 0))
            mao_obra_avulso = Decimal(str(ordem.valor_mao_obra_avulso or 0))
            
            # Calcular qual deveria ser o valor_faturado
            valor_faturado_esperado = valor_total - valor_custo - mao_obra_avulso
            
            # Se houver diferença, marcá-la
            if abs(valor_faturado - valor_faturado_esperado) > Decimal('0.01'):
                ordens_problematicas.append({
                    'numero': ordem.numero,
                    'id': ordem.id,
                    'cliente_id': ordem.cliente_id,
                    'valor_total': valor_total,
                    'valor_custo': valor_custo,
                    'mao_obra_avulso': mao_obra_avulso,
                    'valor_faturado_atual': valor_faturado,
                    'valor_faturado_esperado': valor_faturado_esperado,
                    'diferenca': valor_faturado_esperado - valor_faturado
                })
        
        if ordens_problematicas:
            logger.info("🚨 ENCONTRADAS OS'S COM PROBLEMAS:")
            logger.info("")
            
            for ordem_prob in ordens_problematicas:
                logger.info(f"OS #{ordem_prob['numero']} (ID: {ordem_prob['id']})")
                logger.info(f"  Cliente: {ordem_prob['cliente_id']}")
                logger.info(f"  Valor Total: R$ {ordem_prob['valor_total']:.2f}")
                logger.info(f"  Valor Custo Peças: R$ {ordem_prob['valor_custo']:.2f}")
                logger.info(f"  Mão de Obra Avulso: R$ {ordem_prob['mao_obra_avulso']:.2f}")
                logger.info(f"  Valor Faturado ATUAL: R$ {ordem_prob['valor_faturado_atual']:.2f}")
                logger.info(f"  Valor Faturado ESPERADO: R$ {ordem_prob['valor_faturado_esperado']:.2f}")
                logger.info(f"  ⚠️  DIFERENÇA: R$ {abs(ordem_prob['diferenca']):.2f}")
                logger.info("")
            
            logger.info("=" * 80)
            logger.info(f"✅ Encontradas {len(ordens_problematicas)} OS'S com inconsistências!")
            logger.info("=" * 80)
            
            # Exportar para arquivo CSV
            import csv
            with open('/var/www/autocare/backend/logs/ordens_problematicas.csv', 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=[
                    'numero', 'id', 'cliente_id', 'valor_total', 'valor_custo', 
                    'mao_obra_avulso', 'valor_faturado_atual', 'valor_faturado_esperado', 'diferenca'
                ])
                writer.writeheader()
                for ordem_prob in ordens_problematicas:
                    writer.writerow(ordem_prob)
            
            logger.info(f"📄 Relatório exportado para: /var/www/autocare/backend/logs/ordens_problematicas.csv")
        else:
            logger.info("✅ NÃO foram encontradas OS's com problemas de valor_faturado!")
            logger.info("")
            logger.info("Todas as OS's que têm:")
            logger.info("  - Itens do tipo PRODUTO")
            logger.info("  - Movimentos de SAIDA")
            logger.info("Possuem valores de valor_faturado corretos!")
        
        logger.info("")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"❌ Erro: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    analisar_ordens()
