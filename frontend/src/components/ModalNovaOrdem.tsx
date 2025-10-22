import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Calculator, Save, User, Car, Calendar, Clock, FileText, AlertTriangle } from 'lucide-react';
import { OrdemServicoNova, ItemOrdemNova, ProdutoAutocomplete, ClienteBuscaResponse, ProdutoComLotes, LoteDisponivel } from '../types/ordem-servico';
import AutocompleteProduto from './AutocompleteProduto';
import ModalCadastroVeiculo from './ModalCadastroVeiculo';
import { apiFetch } from '../lib/api';
import { formatPlaca } from '../utils/placaMask';
import { toast } from 'sonner';
import { formatDocument, formatPhone } from '../utils/documentMask';

interface ModalNovaOrdemProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteBuscaResponse['cliente'];
  onSuccess: () => void;
  veiculoPreSelecionado?: any; // Veículo já selecionado (busca por placa)
}

const TIPOS_ORDEM = [
  { value: 'VENDA', label: 'Venda', description: 'Apenas venda de produtos/peças' },
  { value: 'SERVICO', label: 'Serviço', description: 'Apenas prestação de serviços' },
  { value: 'VENDA_SERVICO', label: 'Venda + Serviço', description: 'Combinação de venda e serviço' }
];

const TIPOS_DESCONTO = [
  { value: 'TOTAL', label: 'Total' },
  { value: 'VENDA', label: 'Apenas na Venda' },
  { value: 'SERVICO', label: 'Apenas no Serviço' }
];

export default function ModalNovaOrdem({
  isOpen,
  onClose,
  cliente,
  onSuccess,
  veiculoPreSelecionado
}: ModalNovaOrdemProps) {
  const [formData, setFormData] = useState<OrdemServicoNova>({
    cliente_id: cliente?.id || 0,
    veiculo_id: null, // null por padrão (VENDA não exige veículo)
    tipo_ordem: 'VENDA', // Iniciar com VENDA como padrão
    data_ordem: new Date().toISOString().split('T')[0],
    km_veiculo: 0,
    tempo_estimado_horas: 0,
    descricao_servico: '',
    valor_servico: 0,
    percentual_desconto: 0,
    tipo_desconto: 'TOTAL',
    observacoes: '',
    funcionario_responsavel: '',
    itens: []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [modalCadastroVeiculo, setModalCadastroVeiculo] = useState(false);
  const [clienteAtualizado, setClienteAtualizado] = useState<ClienteBuscaResponse['cliente'] | null>(null);
  const [tipoOrdemAnterior, setTipoOrdemAnterior] = useState<string>(formData.tipo_ordem);
  
  // Estados para validação de KM e senha do supervisor
  const [mostrarModalKmMenor, setMostrarModalKmMenor] = useState(false);
  const [kmInformado, setKmInformado] = useState(0);
  const [senhaKm, setSenhaKm] = useState('');
  const [mostrarModalDescontoAlto, setMostrarModalDescontoAlto] = useState(false);
  const [descontoInformado, setDescontoInformado] = useState(0);
  const [senhaDesconto, setSenhaDesconto] = useState('');
  const [descontoMaximoConfig, setDescontoMaximoConfig] = useState(15);
  
  // Estados para seleção de lotes
  const [modalSelecaoLote, setModalSelecaoLote] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoAutocomplete | null>(null);
  const [lotesDisponiveis, setLotesDisponiveis] = useState<ProdutoComLotes | null>(null);
  const veiculoSelectRef = useRef<HTMLSelectElement | null>(null);

  // Atualizar cliente quando props mudarem
  useEffect(() => {
    const clienteParaProcessar = clienteAtualizado || cliente;
    
    if (clienteParaProcessar) {
      // Verificar se cliente precisa cadastrar novo veículo
      if ((clienteParaProcessar as any).precisaCadastrarVeiculo) {
        setModalCadastroVeiculo(true);
        return;
      }
      
      // Definir veículo: priorizar veículo pré-selecionado, senão usar o primeiro da lista
      let veiculoId = null;
      if (veiculoPreSelecionado && veiculoPreSelecionado.id) {
        // Usar veículo pré-selecionado (busca por placa)
        veiculoId = veiculoPreSelecionado.id;
      } else if (clienteParaProcessar.veiculos && clienteParaProcessar.veiculos.length > 0) {
        // Usar primeiro veículo da lista
        veiculoId = clienteParaProcessar.veiculos[0].id;
      }
      
      setFormData(prev => ({
        ...prev,
        cliente_id: clienteParaProcessar.id,
        veiculo_id: veiculoId
      }));
    }
  }, [cliente, clienteAtualizado, veiculoPreSelecionado]);

  // Buscar configuração de desconto máximo
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await apiFetch('/configuracoes/desconto_maximo_os');
        setDescontoMaximoConfig(parseFloat(response.valor));
      } catch (error) {
        console.error('Erro ao buscar configuração de desconto:', error);
      }
    };
    fetchConfig();
  }, []);

  // Função utilitária para converter valores formatados para número
  const parseFormattedValue = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Converter string formatada (com vírgula) para número
    const cleanValue = String(value).replace(',', '.');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Confirmar KM menor com senha do supervisor
  const confirmarKmMenor = async () => {
    if (!senhaKm) {
      toast.error('Digite a senha do supervisor');
      return;
    }

    try {
      const response = await apiFetch('/configuracoes/validar-senha', {
        method: 'POST',
        body: JSON.stringify({ senha: senhaKm })
      });

      if (!response.valida) {
        toast.error('Senha do supervisor inválida');
        return;
      }

      // Senha válida - aplicar o KM
      setFormData(prev => ({ ...prev, km_veiculo: kmInformado }));
      setMostrarModalKmMenor(false);
      setSenhaKm('');
      toast.success('KM atualizado com autorização do supervisor');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao validar senha');
    }
  };

  // Confirmar desconto alto com senha
  const confirmarDescontoAlto = async () => {
    if (!senhaDesconto) {
      toast.error('Digite a senha do supervisor');
      return;
    }

    try {
      const response = await apiFetch('/configuracoes/validar-senha', {
        method: 'POST',
        body: JSON.stringify({ senha: senhaDesconto })
      });

      if (!response.valida) {
        toast.error('Senha do supervisor inválida');
        return;
      }

      // Senha válida - aplicar o desconto informado
      setFormData(prev => ({ ...prev, percentual_desconto: descontoInformado }));
      setMostrarModalDescontoAlto(false);
      setSenhaDesconto('');
      setDescontoInformado(0);
      toast.success('Desconto autorizado pelo supervisor');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao validar senha');
    }
  };

  // Calcular valores baseado no tipo de ordem
  const calcularValores = () => {
    // Calcular valor das peças apenas se for VENDA ou VENDA_SERVICO
    const valorPecas = (formData.tipo_ordem === 'VENDA' || formData.tipo_ordem === 'VENDA_SERVICO') 
      ? formData.itens
          .filter(item => item.tipo === 'PRODUTO')
          .reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0)
      : 0;

    // Calcular valor dos serviços apenas se for SERVICO ou VENDA_SERVICO
    const valorServicoPrincipal = (formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO') 
      ? parseFormattedValue(formData.valor_servico) 
      : 0;
      
    const valorItensServico = (formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO')
      ? formData.itens
          .filter(item => item.tipo === 'SERVICO')
          .reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0)
      : 0;
      
    const valorServicos = valorServicoPrincipal + valorItensServico;

    const valorSubtotal = valorPecas + valorServicos;

    let valorDesconto = 0;
    if (formData.percentual_desconto && formData.percentual_desconto > 0) {
      switch (formData.tipo_desconto) {
        case 'VENDA':
          valorDesconto = (valorPecas * formData.percentual_desconto) / 100;
          break;
        case 'SERVICO':
          valorDesconto = (valorServicos * formData.percentual_desconto) / 100;
          break;
        case 'TOTAL':
          valorDesconto = (valorSubtotal * formData.percentual_desconto) / 100;
          break;
      }
    }

    const valorTotal = valorSubtotal - valorDesconto;

    return {
      valorPecas,
      valorServicos,
      valorSubtotal,
      valorDesconto,
      valorTotal
    };
  };

  const valores = calcularValores();
  
  // Usar cliente atualizado se disponível, senão usar o cliente original
  const clienteParaUsar = clienteAtualizado || cliente;

  // Lógica para o campo "Aplicar Desconto Em" baseado no tipo de ordem
  const getDescontoConfig = () => {
    switch (formData.tipo_ordem) {
      case 'VENDA':
        return {
          disabled: true,
          value: 'VENDA',
          placeholder: 'Vendas',
          options: [{ value: 'VENDA', label: 'Vendas' }]
        };
      case 'SERVICO':
        return {
          disabled: true,
          value: 'SERVICO',
          placeholder: 'Serviços',
          options: [{ value: 'SERVICO', label: 'Serviços' }]
        };
      case 'VENDA_SERVICO':
        return {
          disabled: false,
          value: formData.tipo_desconto,
          placeholder: 'Selecione onde aplicar',
          options: TIPOS_DESCONTO
        };
      default:
        return {
          disabled: false,
          value: formData.tipo_desconto,
          placeholder: 'Selecione onde aplicar',
          options: TIPOS_DESCONTO
        };
    }
  };

  const descontoConfig = getDescontoConfig();

  // Verificar se tipo de ordem é válido baseado na presença do veículo
  useEffect(() => {
    const temVeiculo = formData.veiculo_id != null && formData.veiculo_id > 0;
    if (!temVeiculo && (formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO')) {
      setFormData(prev => ({ ...prev, tipo_ordem: 'VENDA' }));
    }
  }, [formData.veiculo_id]);

  // Se um veículo for selecionado e o tipo estiver como 'VENDA', ajustar para 'SERVICO'
  useEffect(() => {
    const temVeiculo = formData.veiculo_id != null && formData.veiculo_id > 0;
    if (temVeiculo && formData.tipo_ordem === 'VENDA') {
      setFormData(prev => ({ ...prev, tipo_ordem: 'SERVICO' }));
    }
  }, [formData.veiculo_id, formData.tipo_ordem]);

  // Atualizar tipo_desconto e limpar campos quando o tipo_ordem mudar
  useEffect(() => {
    // Só executar se o tipo realmente mudou
    if (tipoOrdemAnterior === formData.tipo_ordem) return;
    
    const config = getDescontoConfig();
    
    setFormData(prev => {
      const newFormData = { ...prev };
      
      // Atualizar tipo_desconto se necessário
      if (config.disabled && prev.tipo_desconto !== config.value) {
        newFormData.tipo_desconto = config.value as "VENDA" | "SERVICO" | "TOTAL";
      }
      
      // Limpar campos baseado no tipo de ordem
      switch (formData.tipo_ordem) {
        case 'VENDA':
          // Limpar campos de serviço quando mudou para VENDA
          if (tipoOrdemAnterior !== 'VENDA') {
            newFormData.descricao_servico = '';
            newFormData.valor_servico = 0;
            newFormData.itens = prev.itens.filter(item => item.tipo === 'PRODUTO');
          }
          break;
          
        case 'SERVICO':
          // Limpar itens de produto quando mudou para SERVICO
          if (tipoOrdemAnterior !== 'SERVICO') {
            newFormData.itens = prev.itens.filter(item => item.tipo === 'SERVICO');
          }
          break;
          
        case 'VENDA_SERVICO':
          // Não limpa nada - manter tudo (produtos, serviços e descrição/valor do serviço)
          break;
      }
      
      return newFormData;
    });
    
    // Atualizar o tipo anterior
    setTipoOrdemAnterior(formData.tipo_ordem);
  }, [formData.tipo_ordem, tipoOrdemAnterior]);

  const handleInputChange = async (field: keyof OrdemServicoNova, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validar KM quando o usuário sair do campo (onBlur)
  const handleKmBlur = () => {
    const kmNovo = Number(formData.km_veiculo);
    const veiculoAtual = clienteParaUsar?.veiculos.find(v => v.id === formData.veiculo_id);
    
    if (veiculoAtual && kmNovo > 0 && kmNovo < veiculoAtual.km_atual) {
      // KM menor - mostrar modal de confirmação
      setKmInformado(kmNovo);
      setMostrarModalKmMenor(true);
      // Reverter o valor no campo para o KM atual do veículo
      setFormData(prev => ({ ...prev, km_veiculo: veiculoAtual.km_atual }));
    }
  };

  // Validar desconto quando o usuário sair do campo (onBlur)
  const handleDescontoBlur = () => {
    const descontoNovo = Number(formData.percentual_desconto);
    
    if (descontoNovo > descontoMaximoConfig) {
      // Armazenar o desconto informado
      setDescontoInformado(descontoNovo);
      // Desconto acima do limite - mostrar modal de senha
      setMostrarModalDescontoAlto(true);
      // Reverter o valor para o máximo permitido
      setFormData(prev => ({ ...prev, percentual_desconto: descontoMaximoConfig }));
    }
  };

  const handleVeiculoCadastrado = (veiculo: any) => {
    // Atualizar cliente com o novo veículo
    if (cliente) {
      const novoCliente = {
        ...cliente,
        veiculos: [...(cliente.veiculos || []), veiculo]
      };
      setClienteAtualizado(novoCliente);
      
      // Atualizar formData com o novo veículo
      setFormData(prev => ({
        ...prev,
        veiculo_id: veiculo.id,
        // Se o usuário acabou de cadastrar um veículo, faz sentido sugerir Serviço
        tipo_ordem: prev.tipo_ordem === 'VENDA' ? 'SERVICO' : prev.tipo_ordem
      }));
    }
    setModalCadastroVeiculo(false);
    // Feedback e foco no select de veículo
    toast.success('Veículo cadastrado com sucesso');
    setTimeout(() => {
      veiculoSelectRef.current?.focus();
    }, 50);
  };

  const handleAddProduto = async (produto: ProdutoAutocomplete) => {
    try {
      setProdutoSelecionado(produto);
      
      // Buscar lotes disponíveis do produto
      const dadosLotes: ProdutoComLotes = await apiFetch(`/ordens/produtos/${produto.id}/lotes-disponiveis`);
      
      setLotesDisponiveis(dadosLotes);
      
      // Se tem múltiplos preços, mostrar modal de seleção
      if (dadosLotes.tem_lotes_multiplos && dadosLotes.lotes.length > 1) {
        setModalSelecaoLote(true);
      } else {
        // Se tem apenas um preço ou um lote, adicionar direto
        const lote = dadosLotes.lotes[0];
        adicionarItemComLote(produto, lote);
      }
    } catch (error) {
      console.error('Erro ao buscar lotes:', error);
      // Em caso de erro, adicionar com preço padrão do produto
      adicionarItemComLote(produto, null);
    }
  };

  const adicionarItemComLote = (produto: ProdutoAutocomplete, lote: LoteDisponivel | null) => {
    const preco = lote ? lote.preco_venda_unitario : produto.preco_venda;
    
    const novoItem: ItemOrdemNova = {
      produto_id: produto.id,
      lote_id: lote?.id,
      descricao: produto.nome,
      quantidade: 1,
      valor_unitario: Number(preco ?? 0),
      valor_total: Number(preco ?? 0),
      tipo: 'PRODUTO'
    };

    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, novoItem]
    }));
    
    setModalSelecaoLote(false);
    setProdutoSelecionado(null);
    setLotesDisponiveis(null);
  };

  // Serviços são descritos no campo 'Descrição do Serviço' — não há botão para adicionar serviços


  const handleUpdateItem = (index: number, field: keyof ItemOrdemNova, value: any) => {
    const novosItens = [...formData.itens];
    novosItens[index] = { ...novosItens[index], [field]: value };
    
    // Recalcular valor total do item
    if (field === 'quantidade' || field === 'valor_unitario') {
      novosItens[index].valor_total = Number(novosItens[index].quantidade || 0) * Number(novosItens[index].valor_unitario || 0);
    }

    setFormData(prev => ({ ...prev, itens: novosItens }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErro('');

    try {
      // Validações
      const temVeiculo = clienteParaUsar && clienteParaUsar.veiculos.length > 0 && formData.veiculo_id != null && formData.veiculo_id > 0;
      
      if (!temVeiculo && (formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO')) {
        throw new Error('Para serviços é obrigatório selecionar um veículo');
      }

      if (formData.tipo_ordem !== 'VENDA' && !formData.descricao_servico) {
        throw new Error('Descrição do serviço é obrigatória');
      }

      if ((formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO') && formData.valor_servico <= 0) {
        handleInputChange('valor_servico', 1.00); // Aplicar valor mínimo
      }

      // Preparar payload: converter data_ordem para datetime ISO e garantir números
      const ensureISODateTime = (v?: string) => {
        if (!v) return new Date().toISOString();
        // Se for apenas YYYY-MM-DD, adicionar hora atual
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          const agora = new Date();
          const horas = String(agora.getHours()).padStart(2, '0');
          const minutos = String(agora.getMinutes()).padStart(2, '0');
          return `${v}T${horas}:${minutos}:00`;
        }
        return v;
      };

      const payload = {
        ...formData,
        data_ordem: ensureISODateTime(formData.data_ordem as unknown as string),
        km_veiculo: Number(formData.km_veiculo || 0),
        tempo_estimado_horas: Number(formData.tempo_estimado_horas || 0),
        valor_servico: parseFormattedValue(formData.valor_servico),
        percentual_desconto: Number(formData.percentual_desconto || 0),
        itens: formData.itens.map(item => ({
          ...item,
          produto_id: (item as any).produto_id ?? null,
          quantidade: Number(item.quantidade || 0),
          valor_unitario: Number(item.valor_unitario || 0),
          valor_total: Number(item.valor_total || 0),
        }))
      };

      // Enviar para API
      await apiFetch('/ordens', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Se tem veículo e KM informado, atualizar o KM do veículo
      if (formData.veiculo_id && formData.km_veiculo && formData.km_veiculo > 0) {
        try {
          await apiFetch(`/veiculos/${formData.veiculo_id}/atualizar-km`, {
            method: 'POST',
            body: JSON.stringify({ km_atual: formData.km_veiculo })
          });
        } catch (kmError) {
          console.error('Erro ao atualizar KM do veículo:', kmError);
          // Não bloquear a criação da OS se falhar a atualização do KM
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      // Tentar extrair mensagem de erro mais específica do backend
      let errorMessage = 'Erro ao criar ordem de serviço';
      
      if (error.detail) {
        // Se o backend retornou um detail (mensagem específica)
        if (typeof error.detail === 'string') {
          errorMessage = error.detail;
        } else if (Array.isArray(error.detail)) {
          // Erro de validação Pydantic (422)
          errorMessage = error.detail.map((e: any) => e.msg || e.message).join(', ');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErro(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !cliente) return null;

  const veiculoSelecionado = clienteParaUsar?.veiculos.find(v => v.id === formData.veiculo_id);
  const temVeiculo = formData.veiculo_id != null && formData.veiculo_id > 0;
  const mostrarProdutos = formData.tipo_ordem === 'VENDA' || formData.tipo_ordem === 'VENDA_SERVICO';
  const mostrarServicos = formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Nova Ordem de Serviço
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Informações do Cliente */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-3 flex items-center">
              <User className="mr-2 h-4 w-4" />
              Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>Nome:</strong> {clienteParaUsar?.nome}</p>
                {clienteParaUsar?.cpf_cnpj && (
                  <p>
                    <strong>CPF/CNPJ:</strong> {formatDocument(clienteParaUsar.cpf_cnpj)}
                  </p>
                )}
              </div>
              <div>
                {clienteParaUsar?.telefone && (
                  <p>
                    <strong>Telefone:</strong> {formatPhone(clienteParaUsar.telefone)}
                  </p>
                )}
                {clienteParaUsar?.email && <p><strong>Email:</strong> {clienteParaUsar.email}</p>}
              </div>
            </div>
          </div>

          {/* Seleção de Veículo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Car className="mr-1 h-4 w-4" />
              Veículo {(formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO') ? '*' : ''}
            </label>
            {clienteParaUsar && clienteParaUsar.veiculos.length > 0 ? (
              <>
                <select
                  ref={veiculoSelectRef}
                  value={formData.veiculo_id ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    handleInputChange('veiculo_id', val);
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={(formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO')}
                >
                  <option value="">
                    {formData.tipo_ordem === 'VENDA' ? 'Sem veículo (apenas venda)' : 'Selecione um veículo'}
                  </option>
                  {clienteParaUsar.veiculos.map((veiculo) => (
                    <option key={veiculo.id} value={veiculo.id}>
                      {veiculo.marca} {veiculo.modelo} {veiculo.ano} - {formatPlaca(veiculo.placa)}
                      {veiculo.km_atual > 0 && ` (${veiculo.km_atual.toLocaleString()} km)`}
                    </option>
                  ))}
                </select>
                {veiculoSelecionado && (
                  <p className="text-xs text-gray-500 mt-1">
                    KM atual: {veiculoSelecionado.km_atual?.toLocaleString() || 'Não informado'}
                  </p>
                )}
              </>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Nenhum veículo cadastrado.</strong>
                  {formData.tipo_ordem === 'VENDA' 
                    ? ' Esta ordem será apenas para venda de produtos.' 
                    : ' Para serviços, é necessário cadastrar um veículo.'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Tipo de Ordem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Ordem *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIPOS_ORDEM.map((tipo) => {
                // Regra:
                // - Sem veículo: desabilita SERVIÇO e VENDA_SERVICO
                // - Com veículo: desabilita VENDA
                const isDisabled = (!temVeiculo && (tipo.value === 'SERVICO' || tipo.value === 'VENDA_SERVICO'))
                  || (temVeiculo && tipo.value === 'VENDA');
                
                return (
                  <div
                    key={tipo.value}
                    className={`border rounded-lg p-3 transition-colors ${
                      isDisabled
                        ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                        : formData.tipo_ordem === tipo.value
                        ? 'border-blue-500 bg-blue-50 cursor-pointer'
                        : 'border-gray-300 hover:border-gray-400 cursor-pointer'
                    }`}
                    onClick={isDisabled ? undefined : () => handleInputChange('tipo_ordem', tipo.value)}
                  >
                    <div className="font-medium text-sm">{tipo.label}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {isDisabled ? 'Requer veículo selecionado' : tipo.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dados da Ordem */}
          <div className={`grid grid-cols-1 gap-4 ${formData.veiculo_id != null && formData.veiculo_id > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Calendar className="mr-1 h-4 w-4" />
                Data da Ordem *
              </label>
              <input
                type="date"
                value={formData.data_ordem?.split('T')[0] || ''}
                onChange={(e) => handleInputChange('data_ordem', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {formData.veiculo_id != null && formData.veiculo_id > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KM Atual do Veículo
                  {mostrarServicos && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                  type="number"
                  value={formData.km_veiculo || ''}
                  onChange={(e) => handleInputChange('km_veiculo', Number(e.target.value))}
                  onBlur={handleKmBlur}
                  placeholder={veiculoSelecionado ? `Atual: ${veiculoSelecionado.km_atual}` : ''}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={mostrarServicos}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Clock className="mr-1 h-4 w-4" />
                Tempo Estimado (horas)
                {mostrarServicos && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="number"
                step="1"
                value={formData.tempo_estimado_horas || ''}
                onChange={(e) => handleInputChange('tempo_estimado_horas', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={mostrarServicos ? "1" : "0"}
                required={mostrarServicos}
                placeholder="Ex: 2"
              />
            </div>
          </div>

          {/* Descrição do Serviço */}
          {mostrarServicos && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição do Serviço *
              </label>
              <textarea
                value={formData.descricao_servico || ''}
                onChange={(e) => handleInputChange('descricao_servico', e.target.value)}
                placeholder="Descreva detalhadamente o serviço a ser realizado..."
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={formData.tipo_ordem !== 'VENDA'}
              />
            </div>
          )}

          {/* Valor do Serviço (moved below description) */}
          {mostrarServicos && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor do Serviço (R$) *
              </label>
              <input
                type="text"
                value={formData.valor_servico || ''}
                onChange={(e) => handleInputChange('valor_servico', e.target.value)}
                onBlur={(e) => {
                  const valor = parseFormattedValue(e.target.value) || 1.00;
                  const valorFormatado = valor.toFixed(2).replace('.', ',');
                  handleInputChange('valor_servico', valorFormatado);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1,00"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor mínimo: R$ 1,00
              </p>
            </div>
          )}

          {/* Produtos */}
          {mostrarProdutos && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Produtos/Peças
                </label>
              </div>
              
              <AutocompleteProduto
                onSelect={handleAddProduto}
                placeholder="Buscar produto para adicionar..."
                className="mb-4"
              />

              {formData.itens.filter(item => item.tipo === 'PRODUTO').length > 0 && (
                <div className="space-y-2">
                  {formData.itens.map((item, index) => (
                    item.tipo === 'PRODUTO' && (
                      <div key={index} className="border rounded-md p-3 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Produto
                            </label>
                            <input
                              type="text"
                              value={item.descricao}
                              onChange={(e) => handleUpdateItem(index, 'descricao', e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Qtd
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={Math.round(item.quantidade)}
                              onChange={(e) => handleUpdateItem(index, 'quantidade', parseInt(e.target.value) || 1)}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Valor Unit.
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.valor_unitario}
                              onChange={(e) => handleUpdateItem(index, 'valor_unitario', Number(e.target.value))}
                              onBlur={(e) => {
                                const valor = parseFloat(e.target.value) || 0;
                                handleUpdateItem(index, 'valor_unitario', parseFloat(valor.toFixed(2)));
                              }}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0,00"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-medium text-gray-600">Total:</span>
                              <div className="font-medium text-green-600">
                                R$ {Number(item.valor_total ?? 0).toFixed(2).replace('.', ',')}
                              </div>
                            </div>
                            <div className="w-1/2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Itens de Serviço */}
          {mostrarServicos && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Itens de Serviço Adicionais
                </label>
              </div>

              {formData.itens.filter(item => item.tipo === 'SERVICO').length > 0 && (
                <div className="space-y-2">
                  {formData.itens.map((item, index) => (
                    item.tipo === 'SERVICO' && (
                      <div key={index} className="border rounded-md p-3 bg-yellow-50">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Descrição do Serviço
                            </label>
                            <input
                              type="text"
                              value={item.descricao}
                              onChange={(e) => handleUpdateItem(index, 'descricao', e.target.value)}
                              placeholder="Ex: Ajuste de freios, limpeza..."
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Qtd
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={Math.round(item.quantidade)}
                              onChange={(e) => handleUpdateItem(index, 'quantidade', parseInt(e.target.value) || 1)}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Valor Unit.
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.valor_unitario}
                              onChange={(e) => handleUpdateItem(index, 'valor_unitario', Number(e.target.value))}
                              onBlur={(e) => {
                                const valor = parseFloat(e.target.value) || 0;
                                handleUpdateItem(index, 'valor_unitario', parseFloat(valor.toFixed(2)));
                              }}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0,00"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-medium text-gray-600">Total:</span>
                              <div className="font-medium text-green-600">
                                R$ {Number(item.valor_total ?? 0).toFixed(2).replace('.', ',')}
                              </div>
                            </div>
                            <div className="w-1/2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Desconto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Desconto (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentual_desconto || ''}
                onChange={(e) => handleInputChange('percentual_desconto', Number(e.target.value))}
                onBlur={(e) => {
                  const valor = parseFloat(e.target.value) || 0;
                  handleInputChange('percentual_desconto', parseFloat(valor.toFixed(2)));
                  // Validar desconto após formatar
                  handleDescontoBlur();
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aplicar Desconto Em
              </label>
              <select
                value={descontoConfig.value}
                onChange={(e) => handleInputChange('tipo_desconto', e.target.value)}
                disabled={descontoConfig.disabled}
                className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  descontoConfig.disabled ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
                }`}
              >
                {descontoConfig.disabled && (
                  <option value={descontoConfig.value}>
                    {descontoConfig.placeholder}
                  </option>
                )}
                {!descontoConfig.disabled && descontoConfig.options.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resumo de Valores */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center">
              <Calculator className="mr-2 h-4 w-4" />
              Resumo Financeiro
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Peças/Produtos:</span>
                <div className="font-medium">R$ {valores.valorPecas.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-gray-600">Serviços:</span>
                <div className="font-medium">R$ {valores.valorServicos.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-gray-600">Desconto:</span>
                <div className="font-medium text-red-600">- R$ {valores.valorDesconto.toFixed(2)}</div>
              </div>
              <div className="bg-white border border-blue-300 rounded p-2">
                <span className="text-gray-600">Total:</span>
                <div className="font-bold text-lg text-green-600">R$ {valores.valorTotal.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Campos Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Funcionário Responsável
              </label>
              <input
                type="text"
                value={formData.funcionario_responsavel || ''}
                onChange={(e) => handleInputChange('funcionario_responsavel', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.observacoes || ''}
                onChange={(e) => handleInputChange('observacoes', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-600 text-sm">{erro}</p>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Criar Ordem de Serviço
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de cadastro de veículo */}
      {cliente && (
        <ModalCadastroVeiculo
          isOpen={modalCadastroVeiculo}
          onClose={() => {
            // Ao cancelar o cadastro do veículo, manter o modal da OS aberto
            setModalCadastroVeiculo(false);
          }}
          clienteId={cliente.id}
          onSuccess={handleVeiculoCadastrado}
        />
      )}

      {/* Modal de seleção de lotes */}
      {modalSelecaoLote && produtoSelecionado && lotesDisponiveis && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-[9999] flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Selecionar Lote de Venda
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {lotesDisponiveis.produto.codigo} - {lotesDisponiveis.produto.nome}
                </p>
              </div>
              <button
                onClick={() => {
                  setModalSelecaoLote(false);
                  setProdutoSelecionado(null);
                  setLotesDisponiveis(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>⚠️ Atenção:</strong> Este produto possui lotes com preços de venda diferentes. 
                Selecione o lote desejado ou deixe o sistema usar FIFO (mais antigo primeiro).
              </p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lotesDisponiveis.lotes.map((lote, index) => (
                <button
                  key={lote.id}
                  onClick={() => adicionarItemComLote(produtoSelecionado, lote)}
                  className={`w-full text-left p-4 border-2 rounded-lg hover:bg-gray-50 transition-colors ${
                    index === 0 ? 'border-green-400 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-mono text-gray-600">
                          {lote.numero_lote || `Lote #${lote.id}`}
                        </span>
                        {index === 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                            FIFO - Próximo
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Disponível:</span>
                          <p className="font-medium">{lote.saldo_atual.toFixed(2)} {lotesDisponiveis.produto.unidade}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Entrada:</span>
                          <p className="font-medium">{new Date(lote.data_entrada).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Preço de Venda:</span>
                          <p className="font-bold text-green-600 text-lg">R$ {lote.preco_venda_unitario.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <p className="text-sm text-gray-600">
                Clique no lote desejado para adicionar à ordem
              </p>
              <button
                onClick={() => {
                  setModalSelecaoLote(false);
                  setProdutoSelecionado(null);
                  setLotesDisponiveis(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de KM Menor */}
      {mostrarModalKmMenor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-yellow-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              KM Inferior ao Atual
            </h3>
            
            <p className="text-sm text-gray-700 mb-2">
              O KM informado (<strong>{kmInformado.toLocaleString('pt-BR')}</strong>) é <strong>menor</strong> que 
              o KM atual do veículo (<strong>{clienteParaUsar?.veiculos.find(v => v.id === formData.veiculo_id)?.km_atual.toLocaleString('pt-BR')}</strong>).
            </p>
            
            <p className="text-sm text-gray-700 mb-4">
              Esta ação requer autorização do supervisor. Digite a senha para confirmar:
            </p>
            
            <input
              type="password"
              value={senhaKm}
              onChange={(e) => setSenhaKm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Senha do supervisor"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmarKmMenor();
              }}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarModalKmMenor(false);
                  setSenhaKm('');
                  setKmInformado(0);
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarKmMenor}
                className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Desconto Alto */}
      {mostrarModalDescontoAlto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Desconto Acima do Limite
            </h3>
            
            <p className="text-sm text-gray-700 mb-2">
              O desconto informado (<strong>{descontoInformado}%</strong>) é <strong>maior</strong> que 
              o desconto máximo permitido (<strong>{descontoMaximoConfig}%</strong>).
            </p>
            
            <p className="text-sm text-gray-700 mb-4">
              Esta ação requer autorização do supervisor. Digite a senha para confirmar:
            </p>
            
            <input
              type="password"
              value={senhaDesconto}
              onChange={(e) => setSenhaDesconto(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Senha do supervisor"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmarDescontoAlto();
              }}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarModalDescontoAlto(false);
                  setSenhaDesconto('');
                  // Reverter desconto para o máximo permitido
                  setFormData(prev => ({ ...prev, percentual_desconto: descontoMaximoConfig }));
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDescontoAlto}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}