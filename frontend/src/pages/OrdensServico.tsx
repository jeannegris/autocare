import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  User,
  Car,
  Calendar,
  Eye,
  PlayCircle,
  XCircle,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OrdemServicoList, OrdemServicoNova, ClienteBuscaResponse, VeiculoBuscaResponse } from '../types/ordem-servico';
import { formatPlaca } from '../utils/placaMask';
import { 
  useListarOrdens, 
  useEstatisticasOrdens,
  useExcluirOrdem,
  useObterOrdem,
  useAtualizarOrdem,
  useAtualizarStatusOrdem
} from '../hooks/useOrdens';
import ModalBuscaClienteVeiculo from '../components/ModalBuscaClienteVeiculo';
import ModalNovaOrdem from '../components/ModalNovaOrdem';
import ModalCadastroCliente from '../components/ModalCadastroCliente';
import ModalVisualizarOrdem from '../components/ModalVisualizarOrdem';
import ModalEditarOrdem from '../components/ModalEditarOrdem';
import ConfirmModal from '../components/ConfirmModal';
import ModalCadastroVeiculo from '../components/ModalCadastroVeiculo';

// Status disponíveis conforme a imagem
const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'AGUARDANDO_PECA', label: 'Aguardando peça' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando aprovação' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'CANCELADA', label: 'Cancelada' }
];

;

// Função para obter cor do status
const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDENTE':
      return 'bg-yellow-100 text-yellow-800';
    case 'EM_ANDAMENTO':
      return 'bg-blue-100 text-blue-800';
    case 'AGUARDANDO_PECA':
      return 'bg-orange-100 text-orange-800';
    case 'AGUARDANDO_APROVACAO':
      return 'bg-purple-100 text-purple-800';
    case 'CONCLUIDA':
      return 'bg-green-100 text-green-800';
    case 'CANCELADA':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Função para obter ícone do status
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PENDENTE':
      return <Clock className="h-4 w-4" />;
    case 'EM_ANDAMENTO':
      return <PlayCircle className="h-4 w-4" />;
    case 'AGUARDANDO_PECA':
      return <Package className="h-4 w-4" />;
    case 'AGUARDANDO_APROVACAO':
      return <AlertTriangle className="h-4 w-4" />;
    case 'CONCLUIDA':
      return <CheckCircle className="h-4 w-4" />;
    case 'CANCELADA':
      return <XCircle className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export default function OrdensServicoNova() {
  const [filtros, setFiltros] = useState({
    search: '',
    status: '',
    data_inicio: '',
    data_fim: ''
  });

  // Estados para ordenação
  // Ordenação padrão: Ordem (número) decrescente
  const [ordenacao, setOrdenacao] = useState<{
    coluna: string | null;
    direcao: 'asc' | 'desc';
  }>({
    coluna: 'ordem',
    direcao: 'desc'
  });

  // Estados para redimensionamento de colunas
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    ordem: 120,
    cliente: 220,
    tipo: 150,
    status: 180,
    data: 180,
    valor: 140,
    acoes: 120
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const [modalBusca, setModalBusca] = useState(false);
  const [modalOrdem, setModalOrdem] = useState(false);
  const [modalCadastro, setModalCadastro] = useState(false);
  const [termoBuscaAtual, setTermoBuscaAtual] = useState('');
  const [modalVisualizar, setModalVisualizar] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBuscaResponse['cliente'] | null>(null);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<VeiculoBuscaResponse['veiculo'] | null>(null);
  const [modalCadastroVeiculo, setModalCadastroVeiculo] = useState(false);
  const [placaPreenchidaParaVeiculo, setPlacaPreenchidaParaVeiculo] = useState<string>('');
  const [ordemSelecionada, setOrdemSelecionada] = useState<number | null>(null);
  const [ordemParaExcluir, setOrdemParaExcluir] = useState<number | null>(null);

  // Função para lidar com ordenação
  const handleSort = (coluna: string) => {
    setOrdenacao(prev => {
      if (prev.coluna === coluna) {
        return {
          coluna,
          direcao: prev.direcao === 'asc' ? 'desc' : 'asc'
        };
      }
      return { coluna, direcao: 'asc' };
    });
  };

  // Função para iniciar redimensionamento
  const handleMouseDownResize = (e: React.MouseEvent, coluna: string) => {
    e.preventDefault();
    e.stopPropagation(); // Impede que o clique acione a ordenação
    
    setResizingColumn(coluna);
    setStartX(e.clientX);
    setStartWidth(columnWidths[coluna]);
  };

  // Função para redimensionar durante o arrasto
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn) {
        const diff = e.clientX - startX;
        const newWidth = Math.max(80, startWidth + diff); // Largura mínima de 80px
        
        setColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth
        }));
      }
    };

    const handleMouseUp = () => {
      
      setResizingColumn(null);
      document.body.classList.remove('resizing');
    };

    if (resizingColumn) {
      
      document.body.classList.add('resizing');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, startX, startWidth]);

  // Query para buscar ordens de serviço
  const { data: ordens = [], isLoading, refetch } = useListarOrdens({
    status: filtros.status || undefined,
    data_inicio: filtros.data_inicio || undefined,
    data_fim: filtros.data_fim || undefined
  });

  // Query para buscar ordem específica
  const { data: ordemDetalhada } = useObterOrdem(ordemSelecionada || 0, !!ordemSelecionada);

  // Mutações
  const excluirOrdemMutation = useExcluirOrdem();
  const atualizarOrdemMutation = useAtualizarOrdem();
  const atualizarStatusMutation = useAtualizarStatusOrdem();

  // Filtro de busca local por texto
  const ordensFiltradasPorTexto = ordens.filter(ordem => {
    if (!filtros.search) return true;
    const searchLower = filtros.search.toLowerCase();
    return (
      ordem.numero?.toLowerCase().includes(searchLower) ||
      ordem.cliente_nome?.toLowerCase().includes(searchLower) ||
      ordem.veiculo_placa?.toLowerCase().includes(searchLower)
    );
  });

  // Aplicar ordenação
  const ordensOrdenadas = [...ordensFiltradasPorTexto].sort((a, b) => {
    if (!ordenacao.coluna) return 0;

    let valorA: any;
    let valorB: any;

    switch (ordenacao.coluna) {
      case 'ordem':
        valorA = a.numero || '';
        valorB = b.numero || '';
        break;
      case 'cliente':
        valorA = a.cliente_nome || '';
        valorB = b.cliente_nome || '';
        break;
      case 'tipo':
        valorA = a.tipo_ordem || '';
        valorB = b.tipo_ordem || '';
        break;
      case 'status':
        valorA = a.status || '';
        valorB = b.status || '';
        break;
      case 'data':
        valorA = new Date(a.data_abertura).getTime();
        valorB = new Date(b.data_abertura).getTime();
        break;
      case 'valor':
        valorA = parseFloat(String(a.valor_total)) || 0;
        valorB = parseFloat(String(b.valor_total)) || 0;
        break;
      default:
        return 0;
    }

    if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
    if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
    return 0;
  });

  // Query para estatísticas
  const { data: estatisticas } = useEstatisticasOrdens();

  // Estatísticas das ordens (fallback se API de estatísticas falhar)
  const stats = estatisticas || {
    total: ordensOrdenadas.length,
    pendentes: ordensOrdenadas.filter((o: OrdemServicoList) => o.status === 'PENDENTE').length,
    em_andamento: ordensOrdenadas.filter((o: OrdemServicoList) => o.status === 'EM_ANDAMENTO').length,
    aguardando_peca: ordensOrdenadas.filter((o: OrdemServicoList) => o.status === 'AGUARDANDO_PECA').length,
    aguardando_aprovacao: ordensOrdenadas.filter((o: OrdemServicoList) => o.status === 'AGUARDANDO_APROVACAO').length,
    concluidas: ordensOrdenadas.filter((o: OrdemServicoList) => o.status === 'CONCLUIDA').length,
    canceladas: ordensOrdenadas.filter((o: OrdemServicoList) => o.status === 'CANCELADA').length,
    valor_total: ordensOrdenadas.reduce((sum: number, o: OrdemServicoList) => sum + parseFloat(String(o.valor_total)) || 0, 0),
    valor_mes_atual: ordensOrdenadas
      .filter((o: OrdemServicoList) => o.status === 'CONCLUIDA')
      .reduce((sum: number, o: OrdemServicoList) => sum + parseFloat(String(o.valor_total)) || 0, 0)
  };

  const handleNovaOrdem = () => {
    setModalBusca(true);
  };

  const handleClienteEncontrado = (cliente: ClienteBuscaResponse['cliente'], veiculoPreSelecionado?: VeiculoBuscaResponse['veiculo']) => {
    setClienteSelecionado(cliente);
    // Se um veículo foi pré-selecionado (busca por placa), defini-lo
    if (veiculoPreSelecionado) {
      setVeiculoSelecionado(veiculoPreSelecionado);
    }
    setModalOrdem(true);
  };

  // Recebe possivelmente um termo de busca (CPF/CNPJ/telefone) vindo do modal de
  // busca; armazena em estado e abre o modal de cadastro apenas após o termo
  // ser aplicado, evitando que o modal monte com prop vazia.
  const handleNovoCliente = (termoBusca = '') => {
    // Passa termo diretamente via estado (sem usar localStorage) e abre modal no mesmo ciclo
    if (termoBusca && termoBusca.trim()) {
      setTermoBuscaAtual(termoBusca.trim());
      setModalCadastro(true);
    } else {
      setTermoBuscaAtual('');
      setModalCadastro(true);
    }
  };

  // Quando termoBuscaAtual for definido, abrir modal (garante que o prop será
  // populado no mount do ModalCadastroCliente)
  // useEffect anterior para abrir modal baseado em termoBuscaAtual não é mais necessário
  // pois agora abrimos imediatamente em handleNovoCliente; mantido vazio para evitar
  // regressões caso outros fluxos alterem termoBuscaAtual.
  useEffect(() => {}, [termoBuscaAtual]);

  const handleTrocarProprietario = (veiculo: VeiculoBuscaResponse['veiculo'], termo?: string) => {
    setVeiculoSelecionado(veiculo);
    // Se houve um termo (CPF/CNPJ/telefone) passado, usá-lo para pré-preencher
    if (termo && termo.trim()) {
      setTermoBuscaAtual(termo.trim());
    } else {
      // Para novo veículo (placa não encontrada), não usar termo de busca por padrão
      setTermoBuscaAtual('');
    }
    setModalCadastro(true);
  };

  

  const handleCadastrarVeiculoParaCliente = (cliente: ClienteBuscaResponse['cliente'], veiculo?: any) => {
    
    // selecionar cliente e abrir modal de cadastro de veículo com placa preenchida
    setClienteSelecionado(cliente);
    setVeiculoSelecionado(veiculo || null);
    setModalCadastro(false);
    setPlacaPreenchidaParaVeiculo(veiculo?.placa || '');
    setTimeout(() => {
      
      setModalCadastroVeiculo(true);
    }, 50);
  };

  // Listener global para fallback se o modal filho não tiver passado a prop corretamente
  useEffect(() => {
    const handler = (e: any) => {
      const { cliente, veiculo } = e.detail || {};
      
      if (cliente) {
        handleCadastrarVeiculoParaCliente(cliente, veiculo);
      }
    };
    window.addEventListener('autocare:cadastrar-veiculo', handler as EventListener);
    return () => {
      window.removeEventListener('autocare:cadastrar-veiculo', handler as EventListener);
    };
  }, []);

  const handleClienteCadastrado = (cliente: any) => {
    // Guardar cliente selecionado
    setClienteSelecionado(cliente);

    // Se há um veículo selecionado marcado como novo, abrir o modal de cadastro de veículo
    if (veiculoSelecionado && (veiculoSelecionado as any).novoVeiculo) {
      setModalCadastro(false);
      setPlacaPreenchidaParaVeiculo((veiculoSelecionado as any).placa || '');
      // Garantir que o cliente selecionado esteja definido antes de abrir o modal de veículo
      setTimeout(() => {
        setModalCadastroVeiculo(true);
      }, 50);
      return;
    }

    // Caso contrário, abrir a criação de ordem normalmente
    setModalOrdem(true);
  };

  const handleVeiculoCadastradoFromCadastro = (veiculo: any) => {
    // Atualizar cliente selecionado com o novo veículo
    setClienteSelecionado(prev => {
      if (!prev) return prev;
      // Remover qualquer veículo temporário (id === 0) e garantir que o veículo criado
      // venha primeiro na lista para ser selecionado por padrão na criação da ordem.
      const veiculosExistentes = (prev.veiculos || []).filter((v: any) => !(v.id === 0));
      return {
        ...prev,
        veiculos: [veiculo, ...veiculosExistentes]
      };
    });

    setModalCadastroVeiculo(false);
    // Após cadastrar veículo, abrir modal de ordem
    setModalOrdem(true);
  };

  const handleOrdemCriada = () => {
    refetch();
    setClienteSelecionado(null);
  };

  const handleExcluirOrdem = (id: number) => {
    setOrdemParaExcluir(id);
  };

  const handleVisualizarOrdem = (id: number) => {
    setOrdemSelecionada(id);
    setModalVisualizar(true);
  };

  const handleEditarOrdem = (id: number) => {
    setOrdemSelecionada(id);
    setModalEditar(true);
  };

  const handleChangeStatus = (novoStatus: string, motivoCancelamento?: string) => {
    if (ordemSelecionada) {
      const payload: any = { status: novoStatus };
      if (novoStatus === 'CANCELADA' && motivoCancelamento) {
        payload.motivo_cancelamento = motivoCancelamento;
      }
      
      atualizarStatusMutation.mutate({ id: ordemSelecionada, ...payload }, {
        onSuccess: () => {
          setModalVisualizar(false);
          refetch();
        }
      });
    }
  };

  const handleSalvarEdicao = (dadosAtualizados: Partial<OrdemServicoNova>) => {
    if (ordemSelecionada) {
      atualizarOrdemMutation.mutate({ id: ordemSelecionada, dados: dadosAtualizados }, {
        onSuccess: () => {
          setModalEditar(false);
          refetch();
        }
      });
    }
  };

  const confirmarExclusao = () => {
    if (ordemParaExcluir) {
      excluirOrdemMutation.mutate(ordemParaExcluir, {
        onSuccess: () => {
          setOrdemParaExcluir(null);
          refetch(); // Atualizar lista de ordens
        }
      });
    }
  };

  const formatarData = (data: string) => {
    try {
      return format(new Date(data), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
          <p className="text-gray-600">{stats.total} ordem{stats.total !== 1 ? 's' : ''} cadastrada{stats.total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleNovaOrdem}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nova OS</span>
        </button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{stats.pendentes}</div>
              <div className="text-sm text-gray-600">Pendentes</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <PlayCircle className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{stats.em_andamento}</div>
              <div className="text-sm text-gray-600">Em Andamento</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">R$ {stats.valor_mes_atual.toFixed(2).replace('.', ',')}</div>
              <div className="text-sm text-gray-600">Faturado</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Busca por texto - campo maior */}
          <div className="relative md:col-span-5">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, veículo..."
              value={filtros.search}
              onChange={(e) => setFiltros(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro por Status - tamanho exato para "Aguardando Aprovação" */}
          <div className="md:col-span-3">
            <select
              value={filtros.status}
              onChange={(e) => setFiltros(prev => ({ ...prev, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Data Início - tamanho otimizado para dd/mm/aaaa */}
          <div className="md:col-span-2">
            <input
              type="date"
              placeholder="Data início"
              value={filtros.data_inicio}
              onChange={(e) => setFiltros(prev => ({ ...prev, data_inicio: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtro por Data Fim - mesmo tamanho da Data Início */}
          <div className="md:col-span-2">
            <input
              type="date"
              placeholder="Data fim"
              value={filtros.data_fim}
              onChange={(e) => setFiltros(prev => ({ ...prev, data_fim: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Botão para limpar filtros */}
        {(filtros.search || filtros.status || filtros.data_inicio || filtros.data_fim) && (
          <div className="mt-3">
            <button
              onClick={() => setFiltros({ search: '', status: '', data_inicio: '', data_fim: '' })}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista de Ordens */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Carregando ordens...</span>
          </div>
        ) : ordens.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma ordem encontrada</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filtros.search || filtros.status ? 
                'Tente ajustar os filtros de busca.' : 
                'Comece criando uma nova ordem de serviço.'}
            </p>
            {!filtros.search && !filtros.status && (
              <button
                onClick={handleNovaOrdem}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Ordem</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table ref={tableRef} className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
              {/* Colgroup para aplicar largura em TODA a coluna (thead + tbody) */}
              <colgroup>
                <col style={{ width: `${columnWidths.ordem}px` }} />
                <col style={{ width: `${columnWidths.cliente}px` }} />
                <col style={{ width: `${columnWidths.tipo}px` }} />
                <col style={{ width: `${columnWidths.status}px` }} />
                <col style={{ width: `${columnWidths.data}px` }} />
                <col style={{ width: `${columnWidths.valor}px` }} />
                <col style={{ width: `${columnWidths.acoes}px` }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  {/* Coluna Ordem */}
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 relative select-none group"
                    style={{ width: `${columnWidths.ordem}px` }}
                    onClick={() => handleSort('ordem')}
                  >
                    <div className="flex items-center justify-center">
                      <span className="flex items-center">
                        Ordem
                        {ordenacao.coluna === 'ordem' && (
                          <span className="ml-1">
                            {ordenacao.direcao === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                        {ordenacao.coluna !== 'ordem' && (
                          <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                        )}
                      </span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize"
                        onMouseDown={(e) => handleMouseDownResize(e, 'ordem')}
                        onClick={(e) => e.stopPropagation()}
                        title="Arraste para redimensionar"
                      >
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400" />
                      </div>
                    </div>
                  </th>

                  {/* Coluna Cliente/Veículo */}
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 relative select-none group"
                    style={{ width: `${columnWidths.cliente}px` }}
                    onClick={() => handleSort('cliente')}
                  >
                    <div className="flex items-center justify-center">
                      <span className="flex items-center">
                        Cliente/Veículo
                        {ordenacao.coluna === 'cliente' && (
                          <span className="ml-1">
                            {ordenacao.direcao === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                        {ordenacao.coluna !== 'cliente' && (
                          <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                        )}
                      </span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize"
                        onMouseDown={(e) => handleMouseDownResize(e, 'cliente')}
                        onClick={(e) => e.stopPropagation()}
                        title="Arraste para redimensionar"
                      >
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400" />
                      </div>
                    </div>
                  </th>

                  {/* Coluna Tipo */}
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 relative select-none group"
                    style={{ width: `${columnWidths.tipo}px` }}
                    onClick={() => handleSort('tipo')}
                  >
                    <div className="flex items-center justify-center">
                      <span className="flex items-center">
                        Tipo
                        {ordenacao.coluna === 'tipo' && (
                          <span className="ml-1">
                            {ordenacao.direcao === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                        {ordenacao.coluna !== 'tipo' && (
                          <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                        )}
                      </span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize"
                        onMouseDown={(e) => handleMouseDownResize(e, 'tipo')}
                        onClick={(e) => e.stopPropagation()}
                        title="Arraste para redimensionar"
                      >
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400" />
                      </div>
                    </div>
                  </th>

                  {/* Coluna Status */}
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 relative select-none group"
                    style={{ width: `${columnWidths.status}px` }}
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center">
                      <span className="flex items-center">
                        Status
                        {ordenacao.coluna === 'status' && (
                          <span className="ml-1">
                            {ordenacao.direcao === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                        {ordenacao.coluna !== 'status' && (
                          <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                        )}
                      </span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize"
                        onMouseDown={(e) => handleMouseDownResize(e, 'status')}
                        onClick={(e) => e.stopPropagation()}
                        title="Arraste para redimensionar"
                      >
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400" />
                      </div>
                    </div>
                  </th>

                  {/* Coluna Data */}
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 relative select-none group"
                    style={{ width: `${columnWidths.data}px` }}
                    onClick={() => handleSort('data')}
                  >
                    <div className="flex items-center justify-center">
                      <span className="flex items-center">
                        Data
                        {ordenacao.coluna === 'data' && (
                          <span className="ml-1">
                            {ordenacao.direcao === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                        {ordenacao.coluna !== 'data' && (
                          <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                        )}
                      </span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize"
                        onMouseDown={(e) => handleMouseDownResize(e, 'data')}
                        onClick={(e) => e.stopPropagation()}
                        title="Arraste para redimensionar"
                      >
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400" />
                      </div>
                    </div>
                  </th>

                  {/* Coluna Valor */}
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 relative select-none group"
                    style={{ width: `${columnWidths.valor}px` }}
                    onClick={() => handleSort('valor')}
                  >
                    <div className="flex items-center justify-center">
                      <span className="flex items-center">
                        Valor
                        {ordenacao.coluna === 'valor' && (
                          <span className="ml-1">
                            {ordenacao.direcao === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )}
                          </span>
                        )}
                        {ordenacao.coluna !== 'valor' && (
                          <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
                        )}
                      </span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize"
                        onMouseDown={(e) => handleMouseDownResize(e, 'valor')}
                        onClick={(e) => e.stopPropagation()}
                        title="Arraste para redimensionar"
                      >
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-blue-400" />
                      </div>
                    </div>
                  </th>

                  {/* Coluna Ações */}
                  <th 
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                    style={{ width: `${columnWidths.acoes}px` }}
                  >
                    <div className="flex items-center justify-center">
                      <span>Ações</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ordensOrdenadas.map((ordem: OrdemServicoList) => (
                  <tr key={ordem.id} className="hover:bg-gray-50">
                    {/* 1ª coluna alinhada à esquerda */}
                    <td className="px-6 py-4 text-left">
                      <div className="text-sm font-medium text-gray-900">#{ordem.numero}</div>
                    </td>
                    
                    {/* Demais colunas centralizadas */}
                    <td className="px-6 py-4 text-center break-words">
                      <div className="text-center">
                        <div className="flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-sm font-medium text-gray-900 break-words">
                            {ordem.cliente_nome}
                          </div>
                        </div>
                        <div className="flex items-center justify-center mt-1">
                          <Car className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-xs text-gray-500 break-words">
                            {formatPlaca(ordem.veiculo_placa || '')}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {ordem.tipo_ordem?.replace('_', ' + ') || 'SERVICO'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ordem.status)}`}>
                        {getStatusIcon(ordem.status)}
                        <span className="ml-1">
                          {STATUS_OPTIONS.find(s => s.value === ordem.status)?.label || ordem.status}
                        </span>
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                        <div className="text-sm text-gray-900">
                          {formatarData(ordem.data_abertura)}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                        <div className="text-sm font-medium text-green-600">
                          R$ {parseFloat(String(ordem.valor_total)).toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center text-sm font-medium">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleVisualizarOrdem(ordem.id)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditarOrdem(ordem.id)}
                          className="text-gray-600 hover:text-gray-700"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {ordem.status !== 'CONCLUIDA' && (
                          <button
                            onClick={() => handleExcluirOrdem(ordem.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Cancelar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ModalBuscaClienteVeiculo
        isOpen={modalBusca}
        onClose={() => setModalBusca(false)}
        onClienteEncontrado={handleClienteEncontrado}
        onNovoCliente={handleNovoCliente}
        onTrocarProprietario={handleTrocarProprietario}
        onCadastrarVeiculoParaCliente={handleCadastrarVeiculoParaCliente}
      />

      <ModalCadastroCliente
        isOpen={modalCadastro}
        onClose={() => {
          setModalCadastro(false);
          setVeiculoSelecionado(null);
          setTermoBuscaAtual('');
        }}
        onSuccess={handleClienteCadastrado}
        termoBusca={termoBuscaAtual}
        veiculoParaTransferir={veiculoSelecionado}
      />

      {/* Modal de cadastro de veículo que pode ser disparado após cadastrar cliente */}
      <ModalCadastroVeiculo
        isOpen={modalCadastroVeiculo}
        onClose={() => setModalCadastroVeiculo(false)}
        clienteId={clienteSelecionado?.id || 0}
        onSuccess={handleVeiculoCadastradoFromCadastro}
        placaPreenchida={placaPreenchidaParaVeiculo}
      />

      {clienteSelecionado && (
        <ModalNovaOrdem
          isOpen={modalOrdem}
          onClose={() => {
            setModalOrdem(false);
            setClienteSelecionado(null);
            setVeiculoSelecionado(null); // Limpar veículo selecionado
          }}
          cliente={clienteSelecionado}
          onSuccess={handleOrdemCriada}
          veiculoPreSelecionado={veiculoSelecionado}
        />
      )}

      {/* Modal de Visualização */}
      <ModalVisualizarOrdem
        isOpen={modalVisualizar}
        onClose={() => {
          setModalVisualizar(false);
          setOrdemSelecionada(null);
        }}
        ordem={ordemDetalhada || null}
        onChangeStatus={handleChangeStatus}
      />

      {/* Modal de Edição */}
      <ModalEditarOrdem
        isOpen={modalEditar}
        onClose={() => {
          setModalEditar(false);
          setOrdemSelecionada(null);
        }}
        ordem={ordemDetalhada || null}
        onSave={handleSalvarEdicao}
      />

      <ConfirmModal
        isOpen={ordemParaExcluir !== null}
        title="Cancelar Ordem de Serviço"
        message="Tem certeza que deseja cancelar esta ordem de serviço? Esta ação não pode ser desfeita."
        confirmText="Cancelar Ordem"
        cancelText="Manter Ordem"
        onConfirm={confirmarExclusao}
        onCancel={() => setOrdemParaExcluir(null)}
      />
    </div>
  );
}