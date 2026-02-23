#!/usr/bin/env python3
"""Script seguro para truncar todas as tabelas públicas do banco (exceto alembic_version).
USO:
  # listar tabelas que seriam truncadas (dry-run)
  python3 wipe_db.py --dry-run

  # executar truncation (pedirá confirmação a não ser que --yes seja passado)
  python3 wipe_db.py --yes

Aviso: operação irreversível. Este script NÃO faz backup.
"""
import argparse
import sys
import sqlalchemy
from sqlalchemy import text
import backend.config as config
from urllib.parse import urlparse


def get_engine(database_url):
    return sqlalchemy.create_engine(database_url)


def list_public_tables(engine):
    query = text("""
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
    """)
    with engine.connect() as conn:
        res = conn.execute(query).fetchall()
    return [f"{row[0]}.{row[1]}" for row in res]


def filter_tables(tables):
    # Excluir alembic_version e eventuais tabelas de migração
    filtered = [t for t in tables if not t.endswith('.alembic_version')]
    return filtered


def truncate_tables(engine, tables):
    if not tables:
        return 0
    schema_tables = ', '.join([t.split('.', 1)[1] if t.startswith('public.') else t.split('.',1)[1] for t in tables])
    # construímos comando TRUNCATE com CASCADE para todas as tabelas listadas
    command = f'TRUNCATE TABLE {schema_tables} CASCADE;'
    with engine.begin() as conn:
        conn.execute(text(command))
    return len(tables)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='Listar tabelas que seriam truncadas')
    parser.add_argument('--yes', action='store_true', help='Executar sem pedir confirmação')
    args = parser.parse_args()

    database_url = config.DATABASE_URL
    engine = get_engine(database_url)

    tables = list_public_tables(engine)
    tables = filter_tables(tables)

    if args.dry_run:
        print('Tabelas que seriam truncadas (excluindo alembic_version):')
        for t in tables:
            print(' -', t)
        print('\nTotal:', len(tables))
        sys.exit(0)

    if not args.yes:
        print('AVISO: você está prestes a apagar TODOS os dados das tabelas a seguir (exceto alembic_version):')
        for t in tables:
            print(' -', t)
        confirm = input('Deseja continuar? Digite YES para confirmar: ')
        if confirm != 'YES':
            print('Operação cancelada pelo usuário')
            sys.exit(1)

    print('Executando TRUNCATE nas tabelas...')
    try:
        count = truncate_tables(engine, tables)
        print(f'Truncadas {count} tabelas com sucesso.')
    except Exception as e:
        print('Erro ao truncar tabelas:', e)
        sys.exit(2)


if __name__ == '__main__':
    main()
