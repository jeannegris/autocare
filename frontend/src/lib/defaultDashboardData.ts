export const defaultDashboardData = {
  stats: {
    totalClientes: 124,
    totalVeiculos: 89,
    totalPecasEstoque: 456,
    ordensAbertas: 23,
    ordensHoje: 8,
    receitaMensal: 85420,
    receitaDiaria: 2840,
    crescimentoMensal: 12.5,
    servicosRealizados: 156,
    pecasVendidas: 89,
    alertasEstoque: 12
  },
  chartData: {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
    receitas: [45000, 52000, 48000, 58000, 62000, 85420],
    servicos: [15, 18, 22, 19, 25, 23],
    vendaPecas: [8500, 9200, 7800, 11500, 10200, 12800]
  },
  aniversariantes: [
    {
      id: 1,
      nome: 'João Silva',
      telefone: '(11) 99999-9999',
      email: 'joao@email.com',
      dataNascimento: '1985-09-17',
      diasProximo: 1
    },
    {
      id: 2,
      nome: 'Maria Santos',
      telefone: '(11) 88888-8888',
      email: 'maria@email.com',
      dataNascimento: '1990-09-18',
      diasProximo: 2
    }
  ],
  manutencoesPendentes: [
    {
      id: 1,
      clienteNome: 'Carlos Lima',
      veiculoModelo: 'Honda Civic 2020',
      tipoManutencao: 'Troca de óleo',
      kmAtual: 14800,
      kmProximaManutencao: 15000,
      kmRestante: 200,
      telefone: '(11) 77777-7777'
    },
    {
      id: 2,
      clienteNome: 'Ana Costa',
      veiculoModelo: 'Toyota Corolla 2019',
      tipoManutencao: 'Revisão completa',
      kmAtual: 29500,
      kmProximaManutencao: 30000,
      kmRestante: 500,
      telefone: '(11) 66666-6666'
    }
  ],
  ordemStatus: [
    { status: 'Aguardando Aprovação', quantidade: 5, cor: 'rgba(255, 205, 86, 0.8)' },
    { status: 'Em Andamento', quantidade: 12, cor: 'rgba(54, 162, 235, 0.8)' },
    { status: 'Aguardando Peças', quantidade: 6, cor: 'rgba(255, 159, 64, 0.8)' },
    { status: 'Concluídas', quantidade: 15, cor: 'rgba(75, 192, 192, 0.8)' },
    { status: 'Entregues', quantidade: 8, cor: 'rgba(153, 102, 255, 0.8)' }
  ]
}

export type DefaultDashboardData = typeof defaultDashboardData

export type DashboardStats = DefaultDashboardData['stats']
export type ChartData = DefaultDashboardData['chartData']
export type AniversarianteData = DefaultDashboardData['aniversariantes'][number]
export type ManutencaoVencendo = DefaultDashboardData['manutencoesPendentes'][number]
export type OrdemStatus = DefaultDashboardData['ordemStatus'][number]
