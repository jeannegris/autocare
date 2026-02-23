from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import logging
from db import get_db
from models.autocare_models import Veiculo, Cliente
from schemas.schemas_veiculo import (
    VeiculoCreate,
    VeiculoUpdate,
    VeiculoResponse,
    VeiculoList
)
from models.autocare_models import ManutencaoHistorico
from schemas.schemas_veiculo import ManutencaoHistoricoResponse

# Configurar logger
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[VeiculoList])
def listar_veiculos(
    skip: int = 0,
    limit: int = 100,
    cliente_id: Optional[int] = None,
    search: Optional[str] = None,
    ativo: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Listar veículos com filtros opcionais"""
    query = db.query(Veiculo)
    
    if cliente_id:
        query = query.filter(Veiculo.cliente_id == cliente_id)
    
    if search:
        query = query.filter(
            Veiculo.marca.ilike(f"%{search}%") |
            Veiculo.modelo.ilike(f"%{search}%") |
            Veiculo.placa.ilike(f"%{search}%")
        )
    
    # Por padrão retornamos apenas veículos ativos (comportamento consistente com clientes).
    if ativo is None:
        query = query.filter(Veiculo.ativo == True)
    else:
        query = query.filter(Veiculo.ativo == ativo)
    
    veiculos = query.order_by(Veiculo.id.asc()).offset(skip).limit(limit).all()
    return veiculos

@router.get("/{veiculo_id}", response_model=VeiculoResponse)
def buscar_veiculo(veiculo_id: int, db: Session = Depends(get_db)):
    """Buscar veículo por ID"""
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado"
        )
    return veiculo

@router.post("/", response_model=VeiculoResponse, status_code=status.HTTP_201_CREATED)
def criar_veiculo(veiculo_data: VeiculoCreate, db: Session = Depends(get_db)):
    """Criar novo veículo"""
    
    # Verificar se cliente existe
    cliente = db.query(Cliente).filter(Cliente.id == veiculo_data.cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado"
        )
    # Validar campos obrigatórios mais explicitamente para retornar 400 ao frontend
    if not veiculo_data.marca or not veiculo_data.modelo or not veiculo_data.ano:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Marca, modelo e ano são obrigatórios"
        )
    
    # Preparar dados: remover strings vazias para evitar inserir '' que viola constraint UNIQUE
    raw = veiculo_data.dict()
    clean_data = {k: v for k, v in raw.items() if not (isinstance(v, str) and v.strip() == "")}

    # Verificar se placa já existe (somente se foi fornecida e não vazia)
    placa = clean_data.get('placa')
    if placa:
        existing = db.query(Veiculo).filter(Veiculo.placa == placa).first()
        if existing:
            # Retornar conflito com informações do registro existente (id e ativo)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Placa já cadastrada",
                    "existing_id": existing.id,
                    "ativo": existing.ativo
                }
            )

    # Verificar se chassi já existe (somente se foi fornecido e não vazio)
    chassis = clean_data.get('chassis')
    if chassis:
        existing = db.query(Veiculo).filter(Veiculo.chassis == chassis).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Chassi já cadastrado",
                    "existing_id": existing.id,
                    "ativo": existing.ativo
                }
            )

    veiculo = Veiculo(**clean_data)
    db.add(veiculo)
    db.commit()
    db.refresh(veiculo)
    return veiculo

@router.put("/{veiculo_id}", response_model=VeiculoResponse)
def atualizar_veiculo(
    veiculo_id: int,
    veiculo_data: VeiculoUpdate,
    db: Session = Depends(get_db)
):
    """Atualizar veículo existente"""
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado"
        )
    
    # Verificar se cliente existe (se fornecido)
    if veiculo_data.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == veiculo_data.cliente_id).first()
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente não encontrado"
            )
    
    # Atualizar apenas campos não nulos; tratar strings vazias como None para permitir limpar um campo
    update_data = veiculo_data.dict(exclude_unset=True)
    # Converter strings vazias em None (o frontend pode enviar '' para limpar um campo)
    for k, v in list(update_data.items()):
        if isinstance(v, str) and v.strip() == "":
            update_data[k] = None

    # Verificar se placa já existe em outro veículo (somente se foi fornecida e não nula/vazia)
    placa = update_data.get('placa')
    if placa:
        existing = db.query(Veiculo).filter(
            Veiculo.placa == placa,
            Veiculo.id != veiculo_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Placa já cadastrada em outro veículo",
                    "existing_id": existing.id,
                    "ativo": existing.ativo
                }
            )

    # Verificar se chassis já existe em outro veículo (somente se fornecido e não nulo/vazio)
    chassis = update_data.get('chassis')
    if chassis:
        existing = db.query(Veiculo).filter(
            Veiculo.chassis == chassis,
            Veiculo.id != veiculo_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Chassi já cadastrado em outro veículo",
                    "existing_id": existing.id,
                    "ativo": existing.ativo
                }
            )

    for key, value in update_data.items():
        setattr(veiculo, key, value)
    
    db.commit()
    db.refresh(veiculo)
    return veiculo

@router.delete("/{veiculo_id}")
@router.delete("/{veiculo_id}", response_model=VeiculoResponse)
def deletar_veiculo(veiculo_id: int, db: Session = Depends(get_db)):
    """Deletar veículo (soft delete) e retornar o objeto atualizado."""
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado"
        )

    veiculo.ativo = False
    db.commit()
    db.refresh(veiculo)
    return veiculo

@router.post("/{veiculo_id}/atualizar-km")
def atualizar_km_veiculo(
    veiculo_id: int,
    novo_km: int,
    db: Session = Depends(get_db)
):
    """Atualizar quilometragem do veículo"""
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Veículo não encontrado"
        )
    
    if novo_km < veiculo.km_atual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nova quilometragem deve ser maior que a atual"
        )
    
    veiculo.km_atual = novo_km
    db.commit()
    return {"message": f"Quilometragem atualizada para {novo_km} km"}


@router.post("/{veiculo_id}/reativar")
def reativar_veiculo(veiculo_id: int, db: Session = Depends(get_db)):
    """Reativar veículo inativo"""
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado")

    veiculo.ativo = True
    db.commit()
    db.refresh(veiculo)
    return {"message": "Veículo reativado com sucesso", "id": veiculo.id, "ativo": veiculo.ativo}

@router.get("/cliente/{cliente_id}", response_model=List[VeiculoList])
def listar_veiculos_cliente(
    cliente_id: int,
    ativo: Optional[bool] = True,
    db: Session = Depends(get_db)
):
    """Listar veículos de um cliente específico"""
    query = db.query(Veiculo).filter(Veiculo.cliente_id == cliente_id)
    
    if ativo is not None:
        query = query.filter(Veiculo.ativo == ativo)
    
    veiculos = query.all()
    return veiculos


@router.get("/{veiculo_id}/manutencoes/", response_model=List[ManutencaoHistoricoResponse])
def listar_manutencoes_veiculo(veiculo_id: int, db: Session = Depends(get_db)):
    """Retorna o histórico de manutenções de um veículo"""
    # Garantir que o veículo exista
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    manutencoes = db.query(ManutencaoHistorico).filter(ManutencaoHistorico.veiculo_id == veiculo_id).order_by(ManutencaoHistorico.data_realizada.desc()).all()
    return manutencoes

@router.get("/{veiculo_id}/sugestoes-manutencao/")
def obter_sugestoes_manutencao(veiculo_id: int, db: Session = Depends(get_db)):
    """
    Retorna sugestões de manutenções pendentes baseadas no histórico e kilometragem atual.
    Compara a KM atual do veículo com as KMs das próximas manutenções previstas.
    """
    # Garantir que o veículo exista
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    
    # Buscar manutenções com km_proxima definida
    manutencoes = db.query(ManutencaoHistorico).filter(
        and_(
            ManutencaoHistorico.veiculo_id == veiculo_id,
            ManutencaoHistorico.km_proxima.isnot(None)
        )
    ).order_by(ManutencaoHistorico.data_realizada.desc()).all()
    
    sugestoes = []
    km_atual = veiculo.km_atual or 0
    
    for manutencao in manutencoes:
        # Verificar se já passou da km prevista ou está próximo (dentro de 1000 km)
        if manutencao.km_proxima:
            km_restantes = manutencao.km_proxima - km_atual
            
            # Se já passou ou falta menos de 1000 km
            if km_restantes <= 1000:
                # Verificar se já não foi feita uma manutenção do mesmo tipo depois desta
                manutencao_posterior = db.query(ManutencaoHistorico).filter(
                    and_(
                        ManutencaoHistorico.veiculo_id == veiculo_id,
                        ManutencaoHistorico.tipo == manutencao.tipo,
                        ManutencaoHistorico.data_realizada > manutencao.data_realizada,
                        ManutencaoHistorico.km_realizada >= manutencao.km_proxima
                    )
                ).first()
                
                if not manutencao_posterior:
                    urgencia = "urgente" if km_restantes <= 0 else "proxima"
                    sugestoes.append({
                        "tipo": manutencao.tipo,
                        "ultima_realizacao": {
                            "km": manutencao.km_realizada,
                            "data": manutencao.data_realizada.isoformat()
                        },
                        "proxima_prevista": {
                            "km": manutencao.km_proxima,
                            "km_restantes": km_restantes,
                            "urgencia": urgencia
                        },
                        "mensagem": f"{'⚠️ Atrasada!' if km_restantes <= 0 else '🔔 Próxima'} {manutencao.tipo} - Última em {manutencao.km_realizada} km, prevista para {manutencao.km_proxima} km"
                    })
    
    return {
        "veiculo_id": veiculo_id,
        "placa": veiculo.placa,
        "km_atual": km_atual,
        "total_sugestoes": len(sugestoes),
        "sugestoes": sugestoes
    }

@router.patch("/{veiculo_id}/transferir-proprietario")
def transferir_proprietario_veiculo(
    veiculo_id: int,
    dados: dict,
    db: Session = Depends(get_db)
):
    """Transferir veículo para novo proprietário"""
    # Buscar veículo
    veiculo = db.query(Veiculo).filter(Veiculo.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    
    novo_cliente_id = dados.get('novo_cliente_id')
    if not novo_cliente_id:
        raise HTTPException(status_code=400, detail="ID do novo cliente é obrigatório")
    
    # Verificar se o novo cliente existe
    novo_cliente = db.query(Cliente).filter(Cliente.id == novo_cliente_id).first()
    if not novo_cliente:
        raise HTTPException(status_code=404, detail="Novo cliente não encontrado")
    
    # Transferir veículo
    cliente_anterior_id = veiculo.cliente_id
    veiculo.cliente_id = novo_cliente_id
    
    try:
        db.commit()
        db.refresh(veiculo)
        
        return {
            "success": True,
            "message": f"Veículo {veiculo.placa} transferido com sucesso",
            "veiculo_id": veiculo.id,
            "cliente_anterior_id": cliente_anterior_id,
            "novo_cliente_id": novo_cliente_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao transferir veículo: {str(e)}")

@router.get("/buscar-placa/{placa}")
def buscar_veiculo_por_placa(placa: str, db: Session = Depends(get_db)):
    """Buscar veículo por placa para verificação antes do cadastro"""
    logger.info(f"🚗 Buscando veículo por placa: '{placa}'")
    
    if not placa:
        logger.warning("❌ Placa vazia")
        return {
            "encontrado": False,
            "message": "Placa não pode estar vazia"
        }
    
    # Remove caracteres especiais da placa para busca mais flexível
    placa_limpa = ''.join(filter(str.isalnum, placa)).upper()
    logger.info(f"🔍 Placa original: '{placa}', Placa limpa: '{placa_limpa}'")
    
    # Buscar veículo por placa (ativo ou inativo) - comparar ambos sem formatação
    from sqlalchemy import func
    veiculo = db.query(Veiculo).filter(
        or_(
            # Busca exata
            Veiculo.placa.ilike(placa),
            # Busca exata case insensitive
            func.upper(Veiculo.placa) == placa.upper(),
            # Remover caracteres especiais de ambos os lados para comparação
            func.regexp_replace(func.upper(Veiculo.placa), '[^A-Z0-9]', '', 'g') == placa_limpa
        )
    ).first()
    
    if not veiculo:
        logger.info(f"❌ Veículo não encontrado para placa: '{placa}'")
        return {
            "encontrado": False,
            "message": "Veículo não encontrado com essa placa."
        }
    
    logger.info(f"✅ Veículo encontrado: {veiculo.marca} {veiculo.modelo} - {veiculo.placa}")
    
    # Buscar cliente proprietário
    cliente = db.query(Cliente).filter(Cliente.id == veiculo.cliente_id).first()
    cliente_nome = cliente.nome if cliente else "Cliente não encontrado"
    
    return {
        "encontrado": True,
        "veiculo": {
            "id": veiculo.id,
            "placa": veiculo.placa,
            "marca": veiculo.marca,
            "modelo": veiculo.modelo,
            "ano": veiculo.ano,
            "cor": veiculo.cor,
            "km_atual": veiculo.km_atual,
            "combustivel": veiculo.combustivel,
            "chassis": veiculo.chassis,
            "renavam": veiculo.renavam,
            "cliente_id": veiculo.cliente_id,
            "cliente_nome": cliente_nome,
            "ativo": veiculo.ativo
        }
    }

@router.get("/buscar-renavam/{renavam}")
def buscar_veiculo_por_renavam(renavam: str, db: Session = Depends(get_db)):
    """Buscar veículo por RENAVAM para verificação antes do cadastro"""
    logger.info(f"🚗 Buscando veículo por RENAVAM: '{renavam}'")
    
    if not renavam:
        logger.warning("❌ RENAVAM vazio")
        return {
            "encontrado": False,
            "message": "RENAVAM não pode estar vazio"
        }
    
    # Remove caracteres especiais do RENAVAM
    renavam_limpo = ''.join(filter(str.isdigit, renavam))
    
    # Buscar veículo por RENAVAM (ativo ou inativo)
    veiculo = db.query(Veiculo).filter(
        or_(
            Veiculo.renavam == renavam,
            Veiculo.renavam == renavam_limpo
        )
    ).first()
    
    if not veiculo:
        logger.info(f"❌ Veículo não encontrado para RENAVAM: '{renavam}'")
        return {
            "encontrado": False,
            "message": "Veículo não encontrado com esse RENAVAM."
        }
    
    logger.info(f"✅ Veículo encontrado: {veiculo.marca} {veiculo.modelo} - RENAVAM: {veiculo.renavam}")
    
    # Buscar cliente proprietário
    cliente = db.query(Cliente).filter(Cliente.id == veiculo.cliente_id).first()
    cliente_nome = cliente.nome if cliente else "Cliente não encontrado"
    
    return {
        "encontrado": True,
        "veiculo": {
            "id": veiculo.id,
            "placa": veiculo.placa,
            "marca": veiculo.marca,
            "modelo": veiculo.modelo,
            "ano": veiculo.ano,
            "cor": veiculo.cor,
            "km_atual": veiculo.km_atual,
            "combustivel": veiculo.combustivel,
            "chassis": veiculo.chassis,
            "renavam": veiculo.renavam,
            "cliente_id": veiculo.cliente_id,
            "cliente_nome": cliente_nome,
            "ativo": veiculo.ativo
        }
    }