// Tipos para a nova estrutura de ordem de serviço

export interface ClienteBusca {
  termo_busca: string;
}

export interface ClienteBuscaResponse {
  encontrado: boolean;
  cliente?: {
    id: number;
    nome: string;
    cpf_cnpj?: string;
    email?: string;
    telefone?: string;
    telefone2?: string;
    whatsapp?: string;
    veiculos: Veiculo[];
  };
  message?: string;
}

export interface VeiculoBusca {
  placa: string;
}

export interface VeiculoBuscaResponse {
  encontrado: boolean;
  veiculo?: {
    id: number;
    marca: string;
    modelo: string;
    ano: number;
    placa: string;
    cor?: string;
    km_atual: number;
    combustivel?: string;
    chassis?: string;
    renavam?: string;
  };
  cliente?: {
    id: number;
    nome: string;
    cpf_cnpj?: string;
    email?: string;
    telefone?: string;
    telefone2?: string;
    whatsapp?: string;
    veiculos: Veiculo[];
  };
  message?: string;
}

export interface Veiculo {
  id: number;
  marca: string;
  modelo: string;
  ano: number;
  placa: string;
  cor?: string;
  km_atual: number;
}

export interface ProdutoAutocomplete {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string;
  preco_venda: number;
  quantidade_atual: number;
  unidade: string;
}

export interface LoteDisponivel {
  id: number;
  numero_lote?: string;
  saldo_atual: number;
  preco_venda_unitario: number;
  preco_custo_unitario: number;
  data_entrada: string;
  fornecedor_id?: number;
}

export interface ProdutoComLotes {
  produto: {
    id: number;
    codigo: string;
    nome: string;
    unidade: string;
    quantidade_total: number;
  };
  lotes: LoteDisponivel[];
  tem_lotes_multiplos: boolean;
}

export interface ItemOrdemNova {
  id?: number;
  produto_id?: number;
  lote_id?: number;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  tipo: 'PRODUTO' | 'SERVICO';
  desconto_item?: number;
  observacoes?: string;
  produto_nome?: string;
}

export interface OrdemServicoNova {
  id?: number;
  numero?: string;
  cliente_id: number;
  veiculo_id: number | null; // Opcional para VENDA (pode ser null)
  tipo_ordem: 'VENDA' | 'SERVICO' | 'VENDA_SERVICO';
  data_ordem?: string;
  km_veiculo?: number;
  tempo_estimado_horas?: number;
  descricao_servico?: string;
  valor_servico: number;
  percentual_desconto?: number;
  tipo_desconto: 'VENDA' | 'SERVICO' | 'TOTAL';
  observacoes?: string;
  funcionario_responsavel?: string;
  itens: ItemOrdemNova[];
  // Campos de resposta
  status?: string;
  data_abertura?: string;
  data_conclusao?: string;
  valor_pecas?: number;
  valor_subtotal?: number;
  valor_desconto?: number;
  valor_total?: number;
  tempo_gasto_horas?: number;
  aprovado_cliente?: boolean;
  forma_pagamento?: string;
  motivo_cancelamento?: string;  // Motivo do cancelamento (obrigatório quando status = CANCELADA)
  created_at?: string;
  updated_at?: string;
  // Dados relacionados
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_email?: string;
  veiculo_placa?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
}

export interface OrdemServicoList {
  id: number;
  numero: string;
  cliente_id: number;
  cliente_nome?: string;
  veiculo_id: number | null; // Opcional para VENDA (pode ser null)
  veiculo_placa?: string;
  tipo_ordem: string;
  data_abertura: string;
  status: string;
  valor_total: number;
}

// Tipos para formulários
export interface ClienteCadastroForm {
  nome: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  telefone2?: string;
  whatsapp?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  tipo: 'PF' | 'PJ';
  data_nascimento?: string;
  nome_fantasia?: string;
  razao_social?: string;
  contato_responsavel?: string;
  rg_ie?: string;
  observacoes?: string;
}

export interface VeiculoCadastroForm {
  cliente_id: number;
  marca: string;
  modelo: string;
  ano: number;
  cor?: string;
  placa: string;
  chassis?: string;
  renavam?: string;
  km_atual?: number;
  combustivel?: string;
  observacoes?: string;
}