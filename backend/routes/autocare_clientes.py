from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from db import get_db
from models.autocare_models import Cliente, Veiculo, OrdemServico
from schemas.schemas_cliente import (
    ClienteCreate,
    ClienteUpdate,
    ClienteResponse,
    ClienteList
)
from schemas.schemas_veiculo import VeiculoList

router = APIRouter()

@router.get("/", response_model=List[ClienteList])
def listar_clientes(
    response: Response,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    ativo: Optional[bool] = None,
    periodo: Optional[str] = "T",  # T=Total, A=Anual, M=Mensal
    db: Session = Depends(get_db)
):
    """Listar clientes com filtros opcionais e estatísticas calculadas"""
    from sqlalchemy import extract
    from datetime import datetime, timedelta
    from models.autocare_models import OrdemServico
    
    query = db.query(Cliente)
    
    if search:
        query = query.filter(
            Cliente.nome.ilike(f"%{search}%") |
            Cliente.cpf_cnpj.ilike(f"%{search}%") |
            Cliente.email.ilike(f"%{search}%")
        )
    
    # Se não for informado o parâmetro `ativo`, por padrão retornamos apenas
    # clientes ativos (soft-delete = marcar `ativo = False`). Se o caller
    # fornecer explicitamente `ativo=True` ou `ativo=False`, respeitamos.
    if ativo is None:
        query = query.filter(Cliente.ativo == True)
    else:
        query = query.filter(Cliente.ativo == ativo)
    
    clientes = query.offset(skip).limit(limit).all()
    
    # Calcular estatísticas para cada cliente
    # Evitar qualquer cache intermediário (CDN/Nginx/navegador)
    try:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["X-Stats-Calc"] = "v2"
    except Exception:
        pass

    clientes_com_stats = []
    for cliente in clientes:
        # Calcular total gasto baseado no período
        now = datetime.now()
        if periodo == "M":  # Mensal
            data_inicio = now.replace(day=1)
        elif periodo == "A":  # Anual
            data_inicio = now.replace(month=1, day=1)
        else:  # Total
            data_inicio = None
        
        # Query base para ordens concluídas do cliente
        ordens_query = db.query(OrdemServico).filter(
            OrdemServico.cliente_id == cliente.id,
            OrdemServico.status == 'CONCLUIDA'
        )
        
        if data_inicio:
            ordens_query = ordens_query.filter(OrdemServico.data_conclusao >= data_inicio)
        
        ordens = ordens_query.all()

        # Regras de negócio:
        # - Serviços: considerar apenas ordens dos tipos 'SERVICO' e 'VENDA_SERVICO'.
        # - Total Gasto exibido nos clientes: somar SOMENTE o valor do serviço
        #   (ex.: em 'VENDA_SERVICO' desconsiderar o valor de produtos/peças).
        #   Para robustez, usamos na ordem: valor_servico > valor_mao_obra >
        #   (valor_total - valor_pecas) > soma dos itens de tipo 'SERVICO'.
        def valor_servico_da_os(os: OrdemServico) -> float:
            try:
                if os.tipo_ordem not in ('SERVICO', 'VENDA_SERVICO'):
                    return 0.0
                # valor_servico explícito
                if os.valor_servico is not None and float(os.valor_servico) > 0:
                    return float(os.valor_servico)
                # valor_mao_obra legado
                if os.valor_mao_obra is not None and float(os.valor_mao_obra) > 0:
                    return float(os.valor_mao_obra)
                # tentar derivar: total - pecas
                if os.valor_total is not None and os.valor_pecas is not None:
                    vt = float(os.valor_total or 0)
                    vp = float(os.valor_pecas or 0)
                    if vt - vp > 0:
                        return vt - vp
                # fallback: somar itens de serviço
                if hasattr(os, 'itens') and os.itens:
                    soma = 0.0
                    for it in os.itens:
                        try:
                            if getattr(it, 'tipo', None) == 'SERVICO':
                                soma += float(it.valor_total or 0)
                        except Exception:
                            continue
                    return soma
            except Exception:
                pass
            return 0.0

        total_gasto = sum(valor_servico_da_os(os) for os in ordens)

        # Calcular total de serviços no período (apenas OS com serviço)
        total_servicos = sum(1 for os in ordens if os.tipo_ordem in ('SERVICO', 'VENDA_SERVICO'))
        
        # Calcular quantidade de veículos
        veiculos_count = db.query(Veiculo).filter(
            Veiculo.cliente_id == cliente.id,
            Veiculo.ativo == True
        ).count()
        
        # Converter para dict e adicionar estatísticas
        cliente_dict = {
            "id": cliente.id,
            "nome": cliente.nome,
            "cpf_cnpj": cliente.cpf_cnpj,
            "email": cliente.email,
            "telefone": cliente.telefone,
            "telefone2": cliente.telefone2,
            "whatsapp": cliente.whatsapp,
            "endereco": cliente.endereco,
            "numero": cliente.numero,
            "complemento": cliente.complemento,
            "bairro": cliente.bairro,
            "cidade": cliente.cidade,
            "estado": cliente.estado,
            "cep": cliente.cep,
            "rg_ie": cliente.rg_ie,
            "observacoes": cliente.observacoes,
            "tipo": cliente.tipo,
            "nome_fantasia": cliente.nome_fantasia,
            "razao_social": cliente.razao_social,
            "contato_responsavel": cliente.contato_responsavel,
            "data_nascimento": cliente.data_nascimento,
            "ativo": cliente.ativo,
            "created_at": cliente.created_at,
            "updated_at": cliente.updated_at,
            "total_gasto": total_gasto,
            "total_servicos": total_servicos,
            "veiculos_count": veiculos_count
        }
        
        clientes_com_stats.append(cliente_dict)
    
    return clientes_com_stats

@router.get("/buscar-cpf-cnpj/{cpf_cnpj}")
def buscar_cliente_por_cpf_cnpj(cpf_cnpj: str, db: Session = Depends(get_db)):
    """Buscar cliente por CPF/CNPJ para verificação prévia"""
    # Remove caracteres de formatação do CPF/CNPJ
    cpf_cnpj_limpo = ''.join(filter(str.isdigit, cpf_cnpj))
    
    cliente = db.query(Cliente).filter(
        func.regexp_replace(Cliente.cpf_cnpj, '[^0-9]', '', 'g') == cpf_cnpj_limpo
    ).first()
    
    if not cliente:
        return {
            "encontrado": False,
            "message": "Cliente não encontrado"
        }
    
    return {
        "encontrado": True,
        "cliente": {
            "id": cliente.id,
            "nome": cliente.nome,
            "cpf_cnpj": cliente.cpf_cnpj,
            "email": cliente.email,
            "telefone": cliente.telefone,
            "ativo": cliente.ativo
        }
    }

@router.get("/{cliente_id}", response_model=ClienteResponse)
def buscar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Buscar cliente por ID"""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado"
        )
    return cliente

@router.post("/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def criar_cliente(cliente_data: ClienteCreate, db: Session = Depends(get_db)):
    """Criar novo cliente"""
    
    # Verificar se CPF/CNPJ já existe (comparar apenas os dígitos)
    if cliente_data.cpf_cnpj:
        cpf_cnpj_limpo = ''.join(filter(str.isdigit, cliente_data.cpf_cnpj))
        existing = db.query(Cliente).filter(
            func.regexp_replace(Cliente.cpf_cnpj, '[^0-9]', '', 'g') == cpf_cnpj_limpo
        ).first()
        if existing:
            # Retornamos detalhe com o id do cliente existente e status ativo para
            # que o frontend possa oferecer reativação caso o registro esteja inativo.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "CPF/CNPJ já cadastrado",
                    "existing_id": existing.id,
                    "ativo": existing.ativo
                }
            )
    
    # Verificar se email já existe
    if cliente_data.email:
        existing = db.query(Cliente).filter(Cliente.email == cliente_data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail já cadastrado"
            )
    
    cliente = Cliente(**cliente_data.dict())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente

@router.put("/{cliente_id}", response_model=ClienteResponse)
def atualizar_cliente(
    cliente_id: int,
    cliente_data: ClienteUpdate,
    db: Session = Depends(get_db)
):
    """Atualizar cliente existente"""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado"
        )
    
    # Verificar se CPF/CNPJ já existe em outro cliente (comparar apenas os dígitos)
    if cliente_data.cpf_cnpj:
        cpf_cnpj_limpo = ''.join(filter(str.isdigit, cliente_data.cpf_cnpj))
        existing = db.query(Cliente).filter(
            func.regexp_replace(Cliente.cpf_cnpj, '[^0-9]', '', 'g') == cpf_cnpj_limpo,
            Cliente.id != cliente_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CPF/CNPJ já cadastrado em outro cliente"
            )
    
    # Verificar se email já existe em outro cliente
    if cliente_data.email:
        existing = db.query(Cliente).filter(
            Cliente.email == cliente_data.email,
            Cliente.id != cliente_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail já cadastrado em outro cliente"
            )
    
    # Atualizar apenas campos não nulos
    update_data = cliente_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cliente, key, value)
    
    db.commit()
    db.refresh(cliente)
    return cliente

@router.delete("/{cliente_id}", response_model=ClienteResponse)
def deletar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Deletar cliente (soft delete) e retornar o registro atualizado para debug/consistência."""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado"
        )

    cliente.ativo = False
    db.commit()
    db.refresh(cliente)
    # Retorna o cliente atualizado (com `ativo = False`) para que o frontend possa
    # validar imediatamente o resultado da operação.
    return cliente

@router.post("/{cliente_id}/reativar")
def reativar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    """Reativar cliente"""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado"
        )
    
    cliente.ativo = True
    db.commit()
    return {"message": "Cliente reativado com sucesso"}


@router.get("/{cliente_id}/estatisticas")
def obter_estatisticas_cliente(
    cliente_id: int,
    response: Response,
    periodo: str = "T",  # T=Total, A=Anual, M=Mensal
    db: Session = Depends(get_db)
):
    """Obter estatísticas detalhadas de um cliente por período"""
    from datetime import datetime
    
    # Evitar cache
    try:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["X-Stats-Calc"] = "v2"
    except Exception:
        pass

    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado"
        )
    
    now = datetime.now()
    if periodo == "M":  # Mensal
        data_inicio = now.replace(day=1)
        periodo_desc = f"Setembro {now.year}"
    elif periodo == "A":  # Anual
        data_inicio = now.replace(month=1, day=1)
        periodo_desc = f"Ano {now.year}"
    else:  # Total
        data_inicio = None
        periodo_desc = "Total"
    
    # Query base para ordens concluídas do cliente
    ordens_query = db.query(OrdemServico).filter(
        OrdemServico.cliente_id == cliente_id,
        OrdemServico.status == 'CONCLUIDA'
    )
    
    if data_inicio:
        ordens_query = ordens_query.filter(OrdemServico.data_conclusao >= data_inicio)
    
    ordens = ordens_query.all()

    # Mesmas regras de negócio da listagem de clientes
    def valor_servico_da_os(os: OrdemServico) -> float:
        try:
            if os.tipo_ordem not in ('SERVICO', 'VENDA_SERVICO'):
                return 0.0
            if os.valor_servico is not None and float(os.valor_servico) > 0:
                return float(os.valor_servico)
            if os.valor_mao_obra is not None and float(os.valor_mao_obra) > 0:
                return float(os.valor_mao_obra)
            if os.valor_total is not None and os.valor_pecas is not None:
                vt = float(os.valor_total or 0)
                vp = float(os.valor_pecas or 0)
                if vt - vp > 0:
                    return vt - vp
            if hasattr(os, 'itens') and os.itens:
                soma = 0.0
                for it in os.itens:
                    try:
                        if getattr(it, 'tipo', None) == 'SERVICO':
                            soma += float(it.valor_total or 0)
                    except Exception:
                        continue
                return soma
        except Exception:
            pass
        return 0.0

    total_gasto = sum(valor_servico_da_os(os) for os in ordens)
    
    # Total de serviços no período: apenas OS com serviço
    total_servicos = sum(1 for os in ordens if os.tipo_ordem in ('SERVICO', 'VENDA_SERVICO'))
    
    # Calcular quantidade de veículos ativos
    veiculos_count = db.query(Veiculo).filter(
        Veiculo.cliente_id == cliente_id,
        Veiculo.ativo == True
    ).count()
    
    return {
        "cliente_id": cliente_id,
        "periodo": periodo,
        "periodo_desc": periodo_desc,
        "total_gasto": total_gasto,
        "total_servicos": total_servicos,
        "veiculos_count": veiculos_count
    }

@router.get("/{cliente_id}/veiculos", response_model=List[VeiculoList])
def listar_veiculos_do_cliente(cliente_id: int, ativo: Optional[bool] = True, db: Session = Depends(get_db)):
    """Endpoint compatível com frontend: retornar veículos associados a um cliente.
    O frontend chama /clientes/{id}/veiculos — este endpoint delega internamente à tabela de veículos.
    """
    query = db.query(Veiculo).filter(Veiculo.cliente_id == cliente_id)
    if ativo is not None:
        query = query.filter(Veiculo.ativo == ativo)
    veiculos = query.order_by(Veiculo.id.asc()).all()
    return veiculos