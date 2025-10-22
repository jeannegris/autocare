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
}

interface ChartData {
  labels: string[];
  receitas: number[];
  servicos: number[];
  vendaPecas: number[];
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

// Hook personalizado para buscar dados do dashboard
function useDashboardData(): { data: DashboardData | null, isLoading: boolean, error: any } {
  const resumoQuery = useQuery({
    queryKey: ['dashboard-resumo'],
    queryFn: async () => {
      return await apiFetch('/dashboard/resumo')
    }
  });

  const vendasQuery = useQuery({
    queryKey: ['vendas-mensais'],
    queryFn: async () => {
      return await apiFetch('/dashboard/vendas-mensais')
    }
  });

  const ordensStatusQuery = useQuery({
    queryKey: ['ordens-status'],
    queryFn: async () => {
      return await apiFetch('/dashboard/ordens-status')
    }
  });

  const alertasQuery = useQuery({
    queryKey: ['dashboard-alertas'],
    queryFn: async () => {
      return await apiFetch('/dashboard/alertas')
    }
  });

  // Combine all data
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
      receitaDiaria: 0,
      crescimentoMensal: 0,
      servicosRealizados: resumoQuery.data?.ordens_servico?.concluidas_mes || 0,
      pecasVendidas: 0,
      alertasEstoque: resumoQuery.data?.contadores?.produtos_estoque_baixo || 0
    },
    chartData: {
      labels: vendasQuery.data?.meses || ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
      receitas: vendasQuery.data?.vendas || [0, 0, 0, 0, 0, 0],
      servicos: [15, 18, 22, 19, 25, resumoQuery.data?.ordens_servico?.concluidas_mes || 0],
      vendaPecas: [8500, 9200, 7800, 11500, 10200, 12800] // TODO: dados reais
    },
    aniversariantes: alertasQuery.data?.alertas?.filter((a: any) => a.tipo === 'aniversario') || [],
    manutencoesPendentes: alertasQuery.data?.alertas?.filter((a: any) => a.tipo === 'manutencao') || [],
    ordemStatus: ordensStatusQuery.data?.map((item: any) => ({
      status: item.status,
      quantidade: item.quantidade,
      cor: item.status === 'Aberta' ? 'rgba(59, 130, 246, 0.8)' :
           item.status === 'Em Andamento' ? 'rgba(245, 158, 11, 0.8)' :
           item.status === 'Concluída' ? 'rgba(34, 197, 94, 0.8)' :
           'rgba(107, 114, 128, 0.8)'
    })) || []
  };

  return { data: transformedData, isLoading, error };
}

export default function Dashboard() {
  const { data, isLoading, error } = useDashboardData()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">Erro ao carregar dados do dashboard</p>
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
        data: chartData.servicos.map((v: number) => v * 120), // Mock: servicos * valor médio
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard AutoCenter</h1>
          <p className="text-gray-600 mt-1">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="h-4 w-4 mr-2" />
          {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </div>
      </div>

      {/* Stats Grid - Primeira linha */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Clientes
                  </dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {stats.totalClientes}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-green-500">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Car className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Veículos Cadastrados
                  </dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {stats.totalVeiculos}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-yellow-500">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Peças em Estoque
                  </dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {stats.totalPecasEstoque}
                  </dd>
                  {stats.alertasEstoque > 0 && (
                    <dd className="text-xs text-red-600 flex items-center mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {stats.alertasEstoque} com estoque baixo
                    </dd>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-purple-500">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Wrench className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Ordens Abertas
                  </dt>
                  <dd className="text-2xl font-bold text-gray-900">
                    {stats.ordensAbertas}
                  </dd>
                  <dd className="text-xs text-gray-600 mt-1">
                    {stats.ordensHoje} hoje
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Segunda linha */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Receita Mensal</p>
                <p className="text-3xl font-bold text-gray-900">
                  R$ {(stats.receitaMensal != null ? stats.receitaMensal : 0).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center">
                {stats.crescimentoMensal >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
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

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Serviços Realizados</p>
                <p className="text-3xl font-bold text-gray-900">{stats.servicosRealizados}</p>
              </div>
              <div className="flex-shrink-0">
                <Settings className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">Este mês</div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Peças Vendidas</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pecasVendidas}</p>
              </div>
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">Este mês</div>
          </div>
        </div>
      </div>

      {/* Alertas e Notificações */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Aniversariantes */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center mb-4">
              <Cake className="h-5 w-5 text-pink-600 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Aniversariantes
              </h3>
            </div>
            <div className="space-y-3">
              {aniversariantes.map((alerta: Aniversariante, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-pink-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{alerta.titulo}</p>
                    <p className="text-xs text-gray-600">{alerta.descricao}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-pink-600 font-medium">
                      {alerta.data}
                    </p>
                  </div>
                </div>
              ))}
              {aniversariantes.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum aniversariante próximo
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Manutenções Vencendo */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Manutenções Próximas
              </h3>
            </div>
            <div className="space-y-3">
              {manutencoesPendentes.map((manutencao: ManutencaoPendente, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-md">
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
                        <p className="text-xs text-yellow-600 font-medium">
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
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhuma manutenção próxima
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg lg:col-span-2">
          <div className="p-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Receitas dos Últimos 6 Meses
            </h3>
            <Line data={revenueChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Status das Ordens de Serviço
            </h3>
            <div className="h-64 flex items-center justify-center">
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