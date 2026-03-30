import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, 
  Car, 
  Package, 
  Wrench, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  AlertTriangle,
  Cake,
  Settings,
  BarChart3,
} from 'lucide-react'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js'
import { format } from 'date-fns'
import { apiFetch } from '../lib/api'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '../contexts/AuthContext'

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
)

// Use `apiFetch` helper which resolves the correct runtime prefix
// (/api in dev via Vite proxy, /autocare-api in production behind Nginx).

// Interfaces TypeScript
interface DashboardStats {
  totalClientes: number;
  totalVeiculos: number;
  totalPecasEstoque: number;
  ordensAbertas: number;
  ordensHoje: number;
  receitaMensal: number;
  receitaDiaria: number;
  crescimentoMensal: number;
  servicosRealizados: number;
  pecasVendidas: number;
  alertasEstoque: number;
  custoPecas: number;
  maoObraAvulsa: number;
  custoMensal: number;
  receitaLiquida: number;
}

interface ChartData {
  labels: string[];
  receitas: number[];
  servicos: number[];
  vendaPecas: number[];
  descontos?: number[];
}

interface Aniversariante {
  tipo: string;
  titulo: string;
  descricao: string;
  data: string;
  prioridade: string;
}

interface ManutencaoPendente {
  tipo: string;
  titulo: string;
  descricao: string;
  km_atual: number;
  km_proximo: number;
  prioridade: string;
}

interface OrdemStatus {
  status: string;
  quantidade: number;
  cor: string;
}

interface DashboardData {
  stats: DashboardStats;
  chartData: ChartData;
  aniversariantes: Aniversariante[];
  manutencoesPendentes: ManutencaoPendente[];
  ordemStatus: OrdemStatus[];
}

type TipoDataFiltroDashboard = 'conclusao' | 'abertura'

function obterMensagemErroDashboard(error: any): string {
  if (typeof error?.detail === 'string' && error.detail.trim()) {
    return error.detail
  }

  if (typeof error?.json?.detail === 'string' && error.json.detail.trim()) {
    return error.json.detail
  }

  return 'Erro ao carregar dados do dashboard'
}

// Hook personalizado para buscar dados do dashboard
function useDashboardData(
  dataInicio?: string,
  dataFim?: string,
  tipoData: TipoDataFiltroDashboard = 'conclusao',
  habilitado = true
): { data: DashboardData | null, isLoading: boolean, error: any } {
  const resumoQuery = useQuery({
    queryKey: ['dashboard-resumo', dataInicio, dataFim, tipoData],
    enabled: habilitado,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dataInicio) params.append('data_inicio', dataInicio)
      if (dataFim) params.append('data_fim', dataFim)
      params.append('tipo_data', tipoData)
      const queryString = params.toString()
      const url = queryString ? `/dashboard/resumo?${queryString}` : '/dashboard/resumo'
      return await apiFetch(url)
    }
  });

  const vendasQuery = useQuery({
    queryKey: ['vendas-mensais', tipoData, dataFim],
    enabled: habilitado,
    queryFn: async () => {
      const formatarDataISO = (d: Date) => d.toISOString().split('T')[0]
      const dataReferencia = dataFim ? new Date(`${dataFim}T00:00:00`) : new Date()

      // Janela móvel de 12 meses ancorada na data final do filtro.
      const inicioJanela = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() - 11, 1)
      const fimJanela = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0)

      const params = new URLSearchParams()
      params.append('data_inicio', formatarDataISO(inicioJanela))
      params.append('data_fim', formatarDataISO(fimJanela))
      params.append('tipo_data', tipoData)
      const queryString = params.toString()
      const url = queryString ? `/dashboard/vendas-mensais?${queryString}` : '/dashboard/vendas-mensais'
      return await apiFetch(url)
    }
  });

  const ordensStatusQuery = useQuery({
    queryKey: ['ordens-status', dataInicio, dataFim, tipoData],
    enabled: habilitado,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dataInicio) params.append('data_inicio', dataInicio)
      if (dataFim) params.append('data_fim', dataFim)
      params.append('tipo_data', tipoData)
      const queryString = params.toString()
      const url = queryString ? `/dashboard/ordens-status?${queryString}` : '/dashboard/ordens-status'
      return await apiFetch(url)
    }
  });

  const alertasQuery = useQuery({
    queryKey: ['dashboard-alertas', dataInicio, dataFim],
    enabled: habilitado,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (dataInicio) params.append('data_inicio', dataInicio)
      if (dataFim) params.append('data_fim', dataFim)
      const queryString = params.toString()
      const url = queryString ? `/dashboard/alertas?${queryString}` : '/dashboard/alertas'
      return await apiFetch(url)
    }
  });

  // Combine all data
  if (!habilitado) {
    return { data: null, isLoading: false, error: null };
  }

  const isLoading = resumoQuery.isLoading || vendasQuery.isLoading || ordensStatusQuery.isLoading || alertasQuery.isLoading;
  const error = resumoQuery.error || vendasQuery.error || ordensStatusQuery.error || alertasQuery.error;

  if (isLoading || error || !resumoQuery.data || !vendasQuery.data || !ordensStatusQuery.data || !alertasQuery.data) {
    return { data: null, isLoading, error };
  }

  // Transform data to expected frontend format
  const transformedData: DashboardData = {
    stats: {
      totalClientes: resumoQuery.data?.contadores?.total_clientes || 0,
      totalVeiculos: resumoQuery.data?.contadores?.total_veiculos || 0,
      totalPecasEstoque: resumoQuery.data?.contadores?.total_produtos || 0,
      ordensAbertas: resumoQuery.data?.ordens_servico?.abertas || 0,
      ordensHoje: resumoQuery.data?.ordens_servico?.em_andamento || 0,
      receitaMensal: resumoQuery.data?.financeiro?.faturamento_mes || 0,
      receitaDiaria: resumoQuery.data?.financeiro?.faturamento_hoje || 0,
      crescimentoMensal: 0,
      servicosRealizados: resumoQuery.data?.financeiro?.servicos_realizados || 0,
      pecasVendidas: resumoQuery.data?.financeiro?.pecas_vendidas || 0,
      alertasEstoque: resumoQuery.data?.contadores?.produtos_estoque_baixo || 0,
      custoPecas: resumoQuery.data?.financeiro?.custo_pecas || 0,
      maoObraAvulsa: resumoQuery.data?.financeiro?.mao_obra_avulsa || 0,
      custoMensal: resumoQuery.data?.financeiro?.custo_mensal || 0,
      receitaLiquida: resumoQuery.data?.financeiro?.receita_liquida || 0
    },
    chartData: {
      labels: vendasQuery.data?.meses || ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      receitas: vendasQuery.data?.vendas || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      servicos: vendasQuery.data?.vendas_servicos || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      vendaPecas: vendasQuery.data?.vendas_pecas || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      descontos: vendasQuery.data?.descontos || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    aniversariantes: alertasQuery.data?.alertas?.filter((a: any) => a.tipo === 'aniversario') || [],
    manutencoesPendentes: alertasQuery.data?.alertas?.filter((a: any) => a.tipo === 'manutencao') || [],
    ordemStatus: ordensStatusQuery.data?.map((item: any) => ({
      status: item.status,
      quantidade: item.quantidade,
      cor: item.cor
    })) || []
  };

  return { data: transformedData, isLoading, error };
}

export default function Dashboard() {
  const { hasPermission } = useAuth()
  
  // Estados para o intervalo de datas
  const hoje = new Date()
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  
  const formatoData = (data: Date) => data.toISOString().split('T')[0]
  const [dataInicio, setDataInicio] = useState(formatoData(primeiroDiaMes))
  const [dataFim, setDataFim] = useState(formatoData(ultimoDiaMes))
  const [tipoData, setTipoData] = useState<TipoDataFiltroDashboard>('conclusao')
  const mensagemErroDatas = dataInicio > dataFim
    ? 'Data Inicio não pode ser maior que a Data Fim, favor ajustar!'
    : null
  
  const { data, isLoading, error } = useDashboardData(dataInicio, dataFim, tipoData, !mensagemErroDatas)

  // Verificar se o usuário tem permissão gerencial (pode ver valores de receita)
  const temPermissaoGerencial = hasPermission('dashboard_gerencial')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-32 h-32 border-b-2 border-blue-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (mensagemErroDatas) {
    return (
      <div className="p-4 rounded-md bg-red-50 border border-red-200">
        <p className="text-red-800 font-medium">{mensagemErroDatas}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-md bg-red-50 border border-red-200">
        <p className="text-red-800 font-medium">{obterMensagemErroDashboard(error)}</p>
      </div>
    )
  }

  const { stats, chartData, aniversariantes, manutencoesPendentes, ordemStatus } = data;

  // Configuração do gráfico de receitas
  const revenueChartData = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Receita Total (R$)',
        data: chartData.receitas,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Receita Serviços (R$)',
        data: chartData.servicos,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Venda Peças (R$)',
        data: chartData.vendaPecas,
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Descontos (R$)',
        data: chartData.descontos || [],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderDash: [6, 6],
        tension: 0.3,
      },
    ],
  }

  // Configuração do gráfico de ordens por status
  const ordersChartData = {
    labels: ordemStatus.map((o: OrdemStatus) => o.status),
    datasets: [
      {
        data: ordemStatus.map((o: OrdemStatus) => o.quantidade),
        backgroundColor: ordemStatus.map((o: OrdemStatus) => o.cor),
        borderColor: ordemStatus.map((o: OrdemStatus) => o.cor.replace('0.8', '1')),
        borderWidth: 1,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard AutoCenter</h1>
          <p className="mt-1 text-gray-600">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-2" />
          {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </div>

      {/* Seletor de Data */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período de Análise
            </label>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="w-full sm:max-w-xs">
                <label className="block text-xs text-gray-600 mb-1">Filtrar OS por</label>
                <select
                  value={tipoData}
                  onChange={(e) => setTipoData(e.target.value as TipoDataFiltroDashboard)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="conclusao">Data de conclusão da OS</option>
                  <option value="abertura">Data de abertura da OS</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Data Final</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
                  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
                  setDataInicio(formatoData(primeiroDia))
                  setDataFim(formatoData(ultimoDia))
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                Mês Atual
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Primeira linha */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        <div className="overflow-hidden bg-white border-l-4 border-blue-500 rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium leading-5 text-gray-500">Total Clientes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalClientes}</p>
              </div>
              <div className="flex-shrink-0">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-white border-l-4 border-green-500 rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium leading-5 text-gray-500">Veículos Cadastrados</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalVeiculos}</p>
              </div>
              <div className="flex-shrink-0">
                <Car className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-white border-l-4 border-yellow-500 rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium leading-5 text-gray-500">Peças em Estoque</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalPecasEstoque}</p>
                {stats.alertasEstoque > 0 && (
                  <p className="flex items-center mt-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {stats.alertasEstoque} com estoque baixo
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <Package className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-white border-l-4 border-purple-500 rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium leading-5 text-gray-500">Ordens Abertas</p>
                <p className="text-3xl font-bold text-gray-900">{stats.ordensAbertas}</p>
                <p className="mt-1 text-xs text-gray-600">{stats.ordensHoje} hoje</p>
              </div>
              <div className="flex-shrink-0">
                <Wrench className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Serviços Realizados</p>
                <p className="text-3xl font-bold text-gray-900">{stats.servicosRealizados}</p>
              </div>
              <div className="flex-shrink-0">
                <Settings className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">Este mês</div>
          </div>
        </div>

        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Peças Vendidas</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pecasVendidas}</p>
              </div>
              <div className="flex-shrink-0">
                <BarChart3 className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">Este mês</div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Segunda linha */}
      {temPermissaoGerencial && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="overflow-hidden bg-white rounded-lg shadow">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Receita Bruta</p>
                  <p className="text-3xl font-bold text-gray-900">
                    R$ {(stats.receitaMensal != null ? stats.receitaMensal : 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center">
                  {stats.crescimentoMensal >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                  <span className={`ml-1 text-sm font-medium ${
                    stats.crescimentoMensal >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats.crescimentoMensal > 0 ? '+' : ''}{stats.crescimentoMensal}%
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                Receita hoje: R$ {(stats.receitaDiaria != null ? stats.receitaDiaria : 0).toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          <div className="overflow-hidden bg-white rounded-lg shadow">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Custo Mensal</p>
                  <p className="text-3xl font-bold text-gray-900">
                    R$ {(stats.custoMensal != null ? stats.custoMensal : 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <TrendingDown className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs text-gray-600 border-t pt-3">
                <div className="flex justify-between">
                  <span>Custo de Peças:</span>
                  <span className="font-semibold text-gray-900">R$ {(stats.custoPecas != null ? stats.custoPecas : 0).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mão de Obra Avulsa:</span>
                  <span className="font-semibold text-gray-900">R$ {(stats.maoObraAvulsa != null ? stats.maoObraAvulsa : 0).toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden bg-white rounded-lg shadow border-l-4 border-green-500">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Receita Líquida</p>
                  <p className="text-3xl font-bold text-green-600">
                    R$ {(stats.receitaLiquida != null ? stats.receitaLiquida : 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                Bruta - Custos
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alertas e Notificações */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Aniversariantes */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center mb-4">
              <Cake className="w-5 h-5 mr-2 text-pink-600" />
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Aniversariantes
              </h3>
            </div>
            <div className="space-y-3">
              {aniversariantes.map((alerta: Aniversariante, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-md bg-pink-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{alerta.titulo}</p>
                    <p className="text-xs text-gray-600">{alerta.descricao}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-pink-600">
                      {alerta.data}
                    </p>
                  </div>
                </div>
              ))}
              {aniversariantes.length === 0 && (
                <p className="py-4 text-sm text-center text-gray-500">
                  Nenhum aniversariante próximo
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Manutenções Vencendo */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Manutenções Próximas
              </h3>
            </div>
            <div className="space-y-3">
              {manutencoesPendentes.map((manutencao: ManutencaoPendente, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-md bg-yellow-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{manutencao.titulo}</p>
                    <p className="text-xs text-gray-600">{manutencao.descricao}</p>
                    <p className="text-xs text-yellow-700">
                      {manutencao.prioridade === 'alta' ? 'Vencido' : 'Próximo'}
                    </p>
                  </div>
                  <div className="text-right">
                    {manutencao.km_atual && manutencao.km_proximo && (
                      <>
                        <p className="text-xs font-medium text-yellow-600">
                          {Math.max(0, manutencao.km_proximo - manutencao.km_atual)} km restantes
                        </p>
                        <p className="text-xs text-gray-500">
                          {manutencao.km_atual?.toLocaleString()} / {manutencao.km_proximo?.toLocaleString()} km
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {manutencoesPendentes.length === 0 && (
                <p className="py-4 text-sm text-center text-gray-500">
                  Nenhuma manutenção próxima
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className={`grid grid-cols-1 gap-5 ${temPermissaoGerencial ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
        {temPermissaoGerencial && (
          <div className="overflow-hidden bg-white rounded-lg shadow lg:col-span-2">
            <div className="p-5">
              <h3 className="mb-4 text-lg font-medium leading-6 text-gray-900">
                Receitas dos Últimos 12 Meses
              </h3>
              <Line data={revenueChartData} options={chartOptions} />
            </div>
          </div>
        )}

        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="p-5">
            <h3 className="mb-4 text-lg font-medium leading-6 text-gray-900">
              Status das Ordens de Serviço
            </h3>
            <div className="flex items-center justify-center h-64">
              <Doughnut 
                data={ordersChartData} 
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      position: 'bottom' as const,
                    }
                  }
                }} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}