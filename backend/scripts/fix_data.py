"""
Script para varrer e corrigir dados básicos nas principais tabelas do banco.
Use com o Python do virtualenv do projeto (backend/venv).
Gera um relatório simples de alterações no stdout.
"""
import sys
import os
from datetime import datetime
from decimal import Decimal

# garantir import local
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from db import SessionLocal
from models.autocare_models import (
    Cliente, Veiculo, Produto, OrdemServico, ItemOrdem, Fornecedor, Usuario
)

now = datetime.now()

changed = {
    'Cliente': 0,
    'Veiculo': 0,
    'Produto': 0,
    'OrdemServico': 0,
    'ItemOrdem': 0,
    'Fornecedor': 0,
    'Usuario': 0,
}

s = SessionLocal()
try:
    # --- Clientes ---
    clientes = s.query(Cliente).all()
    for c in clientes:
        modified = False
        if not getattr(c, 'nome', None):
            c.nome = f'Cliente Ficticio {c.id or "_"}'
            modified = True
        if not getattr(c, 'cpf_cnpj', None):
            c.cpf_cnpj = f'00000000000'
            modified = True
        if not getattr(c, 'email', None):
            c.email = f'cliente{c.id or ""}@example.com'
            modified = True
        if getattr(c, 'ativo', None) is None:
            c.ativo = True
            modified = True
        if not getattr(c, 'created_at', None):
            c.data_cadastro = c.data_cadastro or now.date()
            c.created_at = now
            modified = True
        if modified:
            s.add(c)
            changed['Cliente'] += 1

    # --- Fornecedores ---
    fornecedores = s.query(Fornecedor).all()
    for f in fornecedores:
        modified = False
        if not getattr(f, 'nome', None):
            f.nome = f'Fornecedor {f.id or "_"}'
            modified = True
        if getattr(f, 'ativo', None) is None:
            f.ativo = True
            modified = True
        if not getattr(f, 'created_at', None):
            f.created_at = now
            modified = True
        if modified:
            s.add(f)
            changed['Fornecedor'] += 1

    # --- Produtos ---
    produtos = s.query(Produto).all()
    for p in produtos:
        modified = False
        if not getattr(p, 'nome', None):
            p.nome = f'Produto {p.id or "_"}'
            modified = True
        # garantir preço numérico
        if getattr(p, 'preco_venda', None) is None:
            p.preco_venda = Decimal('0.00')
            modified = True
        # normalizar estoque
        if getattr(p, 'quantidade_estoque', None) is None:
            p.quantidade_estoque = 0
            modified = True
        # fornecedor válido
        if getattr(p, 'fornecedor_id', None):
            fk = s.query(Fornecedor).filter(Fornecedor.id == p.fornecedor_id).first()
            if not fk:
                p.fornecedor_id = None
                modified = True
        if getattr(p, 'created_at', None) is None:
            p.created_at = now
            modified = True
        if modified:
            s.add(p)
            changed['Produto'] += 1

    # --- Veículos ---
    veiculos = s.query(Veiculo).all()
    first_cliente = s.query(Cliente).first()
    for v in veiculos:
        modified = False
        if not getattr(v, 'cliente_id', None):
            if first_cliente:
                v.cliente_id = first_cliente.id
            else:
                # criar cliente temporário não é feito aqui, marcar com -1
                v.cliente_id = None
            modified = True
        if not getattr(v, 'placa', None):
            v.placa = f'XXX{v.id or 0:04d}'
            modified = True
        if not getattr(v, 'marca', None):
            v.marca = 'Marca Ficticia'
            modified = True
        if not getattr(v, 'modelo', None):
            v.modelo = 'Modelo Ficticio'
            modified = True
        if getattr(v, 'km', None) is None:
            v.km = 0
            modified = True
        # chassi/renavam
        if not getattr(v, 'chassi', None):
            v.chassi = f'CHASSI{v.id or ""}'
            modified = True
        if not getattr(v, 'renavam', None):
            v.renavam = f'RENAVAM{v.id or ""}'
            modified = True
        if getattr(v, 'created_at', None) is None:
            v.created_at = now
            modified = True
        if modified:
            s.add(v)
            changed['Veiculo'] += 1

    # --- Usuários ---
    usuarios = s.query(Usuario).all()
    for u in usuarios:
        modified = False
        if not getattr(u, 'username', None):
            u.username = f'user{u.id or ""}'
            modified = True
        if not getattr(u, 'email', None):
            u.email = f'user{u.id or ""}@example.com'
            modified = True
        if not getattr(u, 'password_hash', None):
            u.password_hash = 'changeme'
            modified = True
        if getattr(u, 'created_at', None) is None:
            u.created_at = now
            modified = True
        if modified:
            s.add(u)
            changed['Usuario'] += 1

    # --- Ordens de Serviço ---
    ordens = s.query(OrdemServico).all()
    for o in ordens:
        modified = False
        # cliente_id obrigatório
        if not getattr(o, 'cliente_id', None):
            if first_cliente:
                o.cliente_id = first_cliente.id
                modified = True
        if not getattr(o, 'data_abertura', None):
            o.data_abertura = now.date()
            o.created_at = o.created_at or now
            modified = True
        if getattr(o, 'status', None) is None:
            o.status = 'Aberta'
            modified = True
        if getattr(o, 'valor_total', None) is None:
            o.valor_total = Decimal('0.00')
            modified = True
        if getattr(o, 'km_entrada', None) is None:
            o.km_entrada = 0
            modified = True
        if getattr(o, 'created_at', None) is None:
            o.created_at = now
            modified = True
        if modified:
            s.add(o)
            changed['OrdemServico'] += 1

    # --- Itens de Ordem ---
    itens = s.query(ItemOrdem).all()
    for it in itens:
        modified = False
        # ordem_servico_id obrigatório
        if not getattr(it, 'ordem_servico_id', None):
            # atribuir a primeira ordem se existir
            ord_first = s.query(OrdemServico).first()
            if ord_first:
                it.ordem_servico_id = ord_first.id
                modified = True
        if getattr(it, 'quantidade', None) is None:
            it.quantidade = 1
            modified = True
        # preco_unitario/subtotal
        if getattr(it, 'preco_unitario', None) is None:
            it.preco_unitario = Decimal('0.00')
            modified = True
        if getattr(it, 'subtotal', None) is None:
            try:
                it.subtotal = (it.preco_unitario or Decimal('0.00')) * Decimal(it.quantidade or 0)
            except Exception:
                it.subtotal = Decimal('0.00')
            modified = True
        if getattr(it, 'created_at', None) is None:
            it.created_at = now
            modified = True
        if modified:
            s.add(it)
            changed['ItemOrdem'] += 1

    # Commit once per script
    s.commit()

    print('Resumo de alterações:')
    for k, v in changed.items():
        print(f'  {k}: {v} registros atualizados')

except Exception as e:
    print('ERROR during fix run:', e)
    s.rollback()
finally:
    s.close()
