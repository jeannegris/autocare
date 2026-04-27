from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

# Schema para busca de cliente
class ClienteBuscaRequest(BaseModel):
    termo_busca: str  # CPF, CNPJ ou telefone

class ClienteBuscaResponse(BaseModel):
    encontrado: bool
    cliente: Optional[dict] = None
    message: Optional[str] = None

# Schema para busca por placa
class VeiculoBuscaRequest(BaseModel):
    placa: str

class VeiculoBuscaResponse(BaseModel):
    encontrado: bool
    veiculo: Optional[dict] = None
    cliente: Optional[dict] = None
    message: Optional[str] = None

# Schema para item da ordem (produto ou serviço)
class ItemOrdemNovaBase(BaseModel):
    produto_id: Optional[int] = None
    descricao: str
    quantidade: Decimal = Decimal('1.0')
    valor_unitario: Decimal = Decimal('0.00')
    valor_total: Decimal = Decimal('0.00')
    tipo: str  # PRODUTO ou SERVICO
    desconto_item: Decimal = Decimal('0.00')
    observacoes: Optional[str] = None

    @validator('tipo')
    def validate_tipo(cls, v):
        if v not in ['PRODUTO', 'SERVICO']:
            raise ValueError('Tipo deve ser "PRODUTO" ou "SERVICO"')
        return v

    @validator('quantidade')
    def validate_quantidade(cls, v):
        if v <= 0:
            raise ValueError('Quantidade deve ser maior que zero')
        return v

class ItemOrdemNovaCreate(ItemOrdemNovaBase):
    pass

class ItemOrdemNovaUpdate(ItemOrdemNovaBase):
    id: Optional[int] = None

class ItemOrdemNovaResponse(ItemOrdemNovaBase):
    id: int
    ordem_id: int
    created_at: datetime
    produto_nome: Optional[str] = None  # Nome do produto se aplicável
    
    class Config:
        from_attributes = True


class FormaPagamentoItem(BaseModel):
    forma: str  # DINHEIRO, PIX, DEBITO, CREDITO
    valor: Decimal = Decimal('0.00')
    numero_parcelas: int = 1

    @validator('forma')
    def validate_forma(cls, v):
        if v not in ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO']:
            raise ValueError('Forma deve ser "DINHEIRO", "PIX", "DEBITO" ou "CREDITO"')
        return v

    @validator('valor')
    def validate_valor(cls, v):
        if v <= 0:
            raise ValueError('Valor da forma de pagamento deve ser maior que zero')
        return v

    @validator('numero_parcelas')
    def validate_numero_parcelas(cls, v, values):
        forma = values.get('forma')
        if forma == 'CREDITO' and v < 1:
            raise ValueError('Número de parcelas deve ser maior que zero para crédito')
        if forma != 'CREDITO':
            return 1
        return v

# Schema para a nova ordem de serviço
class OrdemServicoNovaBase(BaseModel):
    cliente_id: int
    veiculo_id: Optional[int] = None
    tipo_ordem: str  # VENDA, SERVICO, VENDA_SERVICO
    data_ordem: Optional[datetime] = None
    km_veiculo: Optional[int] = None
    tempo_estimado_horas: Optional[Decimal] = None
    # Campos condicionais baseados no tipo
    descricao_servico: Optional[str] = None  # Obrigatório quando tipo for SERVICO ou VENDA_SERVICO
    valor_servico: Decimal = Decimal('0.00')  # Para tipos SERVICO ou VENDA_SERVICO
    valor_mao_obra_avulso: Decimal = Decimal('0.00')  # Pagamento freelancer/avulso
    # Campos de desconto
    percentual_desconto: Decimal = Decimal('0.00')
    tipo_desconto: str = "TOTAL"  # VENDA, SERVICO, TOTAL
    observacoes: Optional[str] = None
    funcionario_responsavel: Optional[str] = None
    # Campos de pagamento
    forma_pagamento: Optional[str] = None  # DINHEIRO, PIX, DEBITO, CREDITO
    numero_parcelas: int = 1  # Número de parcelas (apenas para CREDITO)
    formas_pagamento: Optional[List[FormaPagamentoItem]] = None  # Rateio por múltiplas formas
    # Lista de itens
    itens: List[ItemOrdemNovaCreate] = []

    @validator('tipo_ordem')
    def validate_tipo_ordem(cls, v):
        if v not in ['VENDA', 'SERVICO', 'VENDA_SERVICO']:
            raise ValueError('Tipo da ordem deve ser "VENDA", "SERVICO" ou "VENDA_SERVICO"')
        return v

    @validator('tipo_desconto')
    def validate_tipo_desconto(cls, v):
        if v not in ['VENDA', 'SERVICO', 'TOTAL']:
            raise ValueError('Tipo do desconto deve ser "VENDA", "SERVICO" ou "TOTAL"')
        return v

    @validator('descricao_servico')
    def validate_descricao_servico(cls, v, values):
        tipo_ordem = values.get('tipo_ordem')
        if tipo_ordem in ['SERVICO', 'VENDA_SERVICO'] and not v:
            raise ValueError('Descrição do serviço é obrigatória para tipos SERVICO ou VENDA_SERVICO')
        return v

    @validator('valor_servico')
    def validate_valor_servico(cls, v, values):
        tipo_ordem = values.get('tipo_ordem')
        if tipo_ordem in ['SERVICO', 'VENDA_SERVICO'] and v <= 0:
            # Aplicar valor padrão de R$ 1,00 se estiver vazio
            return Decimal('1.00')
        return v

class OrdemServicoNovaCreate(OrdemServicoNovaBase):
    pass

class OrdemServicoNovaUpdate(BaseModel):
    cliente_id: Optional[int] = None
    veiculo_id: Optional[int] = None
    tipo_ordem: Optional[str] = None
    data_ordem: Optional[datetime] = None
    km_veiculo: Optional[int] = None
    tempo_estimado_horas: Optional[Decimal] = None
    descricao_servico: Optional[str] = None
    valor_servico: Optional[Decimal] = None
    percentual_desconto: Optional[Decimal] = None
    tipo_desconto: Optional[str] = None
    valor_mao_obra_avulso: Optional[Decimal] = None  # Pagamento de mão de obra avulsa
    observacoes: Optional[str] = None
    funcionario_responsavel: Optional[str] = None
    status: Optional[str] = None
    data_conclusao: Optional[datetime] = None
    tempo_gasto_horas: Optional[Decimal] = None
    aprovado_cliente: Optional[bool] = None
    forma_pagamento: Optional[str] = None
    numero_parcelas: Optional[int] = None  # Número de parcelas
    formas_pagamento: Optional[List[FormaPagamentoItem]] = None
    maquina_id: Optional[int] = None  # ID da máquina para taxa (opcional, usa default se não fornecido)
    motivo_cancelamento: Optional[str] = None  # Motivo do cancelamento (obrigatório quando status = CANCELADA)
    itens: Optional[List[ItemOrdemNovaUpdate]] = None

class OrdemServicoNovaResponse(OrdemServicoNovaBase):
    id: int
    numero: str
    status: str
    data_abertura: datetime
    data_conclusao: Optional[datetime] = None
    valor_pecas: Decimal = Decimal('0.00')
    valor_subtotal: Decimal = Decimal('0.00')
    valor_desconto: Decimal = Decimal('0.00')
    valor_mao_obra_avulso: Optional[Decimal] = None  # Pagamento de mão de obra avulsa
    valor_total: Decimal = Decimal('0.00')
    valor_custo_pecas: Decimal = Decimal('0.00')  # Custo real das peças
    valor_faturado: Decimal = Decimal('0.00')  # Valor faturado (valor_total - custo_pecas - valor_mao_obra_avulso)
    tempo_gasto_horas: Optional[Decimal] = None
    aprovado_cliente: bool = False
    forma_pagamento: Optional[str] = None
    numero_parcelas: int = 1  # Número de parcelas
    formas_pagamento: Optional[List[FormaPagamentoItem]] = None
    taxa_pagamento_aplicada: Decimal = Decimal('0.00')  # Valor da taxa aplicada
    motivo_cancelamento: Optional[str] = None  # Motivo do cancelamento (quando status = CANCELADA)
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Informações do cliente
    cliente_nome: Optional[str] = None
    cliente_telefone: Optional[str] = None
    cliente_email: Optional[str] = None
    
    # Informações do veículo
    veiculo_placa: Optional[str] = None
    veiculo_marca: Optional[str] = None
    veiculo_modelo: Optional[str] = None
    veiculo_ano: Optional[int] = None
    
    # Lista de itens
    itens: List[ItemOrdemNovaResponse] = []
    
    class Config:
        from_attributes = True

# Schema simplificado para listagem
class OrdemServicoNovaList(BaseModel):
    id: int
    numero: str
    cliente_id: int
    cliente_nome: Optional[str] = None
    veiculo_id: Optional[int] = None
    veiculo_placa: Optional[str] = None
    tipo_ordem: str
    data_abertura: datetime
    data_conclusao: Optional[datetime] = None
    status: str
    valor_servico: Optional[Decimal] = None
    valor_pecas: Optional[Decimal] = None
    valor_desconto: Optional[Decimal] = None
    valor_total: Decimal = Decimal('0.00')
    valor_custo_pecas: Decimal = Decimal('0.00')  # Custo das peças
    valor_mao_obra_avulso: Decimal = Decimal('0.00')  # Mão de obra avulsa
    forma_pagamento: Optional[str] = None
    numero_parcelas: int = 1
    formas_pagamento: Optional[List[FormaPagamentoItem]] = None
    taxa_pagamento_aplicada: Decimal = Decimal('0.00')  # Taxa da máquina/pagamento
    valor_faturado: Decimal = Decimal('0.00')  # Valor faturado (lucro líquido)
    
    class Config:
        from_attributes = True


class OrdemServicoNovaPaginadaResponse(BaseModel):
    items: List[OrdemServicoNovaList]
    total: int
    page: int
    page_size: int
    total_pages: int

# Schema para autocomplete de produtos
class ProdutoAutocomplete(BaseModel):
    id: int
    codigo: str
    nome: str
    descricao: Optional[str] = None
    preco_venda: Decimal
    quantidade_atual: int
    unidade: str = "UN"
    
    class Config:
        from_attributes = True