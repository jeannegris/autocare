import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  FileBarChart, 
  Download, 
  Filter,
  TrendingUp,
  Package,
  DollarSign,
  BarChart3,
  FileText,
  Archive,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useApi } from '../hooks/useApi'

interface RelatorioVendas {
  periodo: {
    data_inicio: string
    data_fim: string
  }
  resumo: {
    total_ordens: number
    total_faturamento: number
    total_produtos: number
    total_servicos: number
    ticket_medio: number
  }
  ordens: Array<{
    numero: string
    data_abertura: string
    cliente: string
    veiculo: string
    status: string
    valor_final: number
  }>
}

interface RelatorioEstoque {
  data_relatorio: string
  resumo: {
    total_produtos: number
    valor_total_estoque: number
    produtos_estoque_baixo: number
  }
  produtos: Array<{
    codigo: string
    nome: string
    quantidade_atual: number
    quantidade_minima: number
    valor_estoque: number
    situacao: string
  }>
}

const Relatorios: React.FC = () => {
  const [tipoRelatorio, setTipoRelatorio] = useState('vendas')
  const [dataInicio, setDataInicio] = useState(() => {
    const hoje = new Date()
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    return primeiroDiaMes.toISOString().split('T')[0]
  })
  const [dataFim, setDataFim] = useState(() => {
    const hoje = new Date()
    return hoje.toISOString().split('T')[0]
  })
  // formato é controlado apenas na hora do download; não precisa de estado global aqui
  const [filtros, setFiltros] = useState({
    cliente_id: '',
    status: '',
    estoque_baixo: false,
    produto_id: ''
  })

  // useApi retorna o cliente axios
  const api = useApi()

  // Query para relatório de vendas
  const { data: relatorioVendas, isLoading: loadingVendas, refetch: refetchVendas } = useQuery({
    queryKey: ['relatorio-vendas', dataInicio, dataFim, filtros.cliente_id, filtros.status],
    queryFn: async () => {
      const res = await api.get('/relatorios/vendas', {
        params: {
          data_inicio: dataInicio,
          data_fim: dataFim,
          formato: 'json',
          cliente_id: filtros.cliente_id || undefined,
          status: filtros.status || undefined
        }
      })
      return res.data as RelatorioVendas
    },
    enabled: tipoRelatorio === 'vendas'
  })

  // Query para relatório de estoque
  const { data: relatorioEstoque, isLoading: loadingEstoque, refetch: refetchEstoque } = useQuery({
    queryKey: ['relatorio-estoque', filtros.estoque_baixo],
    queryFn: async () => {
      const res = await api.get('/relatorios/estoque', {
        params: {
          formato: 'json',
          estoque_baixo: filtros.estoque_baixo
        }
      })
      return res.data as RelatorioEstoque
    },
    enabled: tipoRelatorio === 'estoque'
  })

  // Query para relatório de movimentação
  const { data: relatorioMovimentacao, isLoading: loadingMovimentacao, refetch: refetchMovimentacao } = useQuery({
    queryKey: ['relatorio-movimentacao', dataInicio, dataFim, filtros.produto_id],
    queryFn: async () => {
      const res = await api.get('/relatorios/movimentacao-estoque', {
        params: {
          data_inicio: dataInicio,
          data_fim: dataFim,
          formato: 'json',
          produto_id: filtros.produto_id || undefined
        }
      })
      return res.data
    },
    enabled: tipoRelatorio === 'movimentacao'
  })

  const handleDownload = async (formato: 'excel' | 'pdf') => {
    try {
      let url = ''
      let params: any = {}
      
      switch (tipoRelatorio) {
        case 'vendas':
          url = '/relatorios/vendas'
          params = {
            data_inicio: dataInicio,
            data_fim: dataFim,
            formato,
            cliente_id: filtros.cliente_id || undefined,
            status: filtros.status || undefined
          }
          break
        case 'estoque':
          url = '/relatorios/estoque'
          params = {
            formato,
            estoque_baixo: filtros.estoque_baixo
          }
          break
        case 'movimentacao':
          url = '/relatorios/movimentacao-estoque'
          params = {
            data_inicio: dataInicio,
            data_fim: dataFim,
            formato,
            produto_id: filtros.produto_id || undefined
          }
          break
      }

      const response = await api.get(url, { 
        params,
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      
      const extensao = formato === 'excel' ? 'xlsx' : 'pdf'
      const fileName = `relatorio_${tipoRelatorio}_${dataInicio}_${dataFim}.${extensao}`
      link.download = fileName
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Erro ao baixar relatório:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getCurrentData = () => {
    switch (tipoRelatorio) {
      case 'vendas':
        return relatorioVendas
      case 'estoque':
        return relatorioEstoque
      case 'movimentacao':
        return relatorioMovimentacao
      default:
        return null
    }
  }

  const getCurrentLoading = () => {
    switch (tipoRelatorio) {
      case 'vendas':
        return loadingVendas
      case 'estoque':
        return loadingEstoque
      case 'movimentacao':
        return loadingMovimentacao
      default:
        return false
    }
  }

  const handleRefresh = () => {
    switch (tipoRelatorio) {
      case 'vendas':
        refetchVendas()
        break
      case 'estoque':
        refetchEstoque()
        break
      case 'movimentacao':
        refetchMovimentacao()
        break
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600 mt-1">Relatórios e análises do sistema</p>
        </div>
        <button
          onClick={handleRefresh}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {/* Seleção do tipo de relatório */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Tipo de Relatório</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setTipoRelatorio('vendas')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              tipoRelatorio === 'vendas'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6" />
              <div>
                <h3 className="font-medium">Relatório de Vendas</h3>
                <p className="text-sm text-gray-500">Ordens de serviço e faturamento</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setTipoRelatorio('estoque')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              tipoRelatorio === 'estoque'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6" />
              <div>
                <h3 className="font-medium">Relatório de Estoque</h3>
                <p className="text-sm text-gray-500">Situação atual do estoque</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setTipoRelatorio('movimentacao')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              tipoRelatorio === 'movimentacao'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <Archive className="h-6 w-6" />
              <div>
                <h3 className="font-medium">Movimentação de Estoque</h3>
                <p className="text-sm text-gray-500">Entradas e saídas de produtos</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtros de data para vendas e movimentação */}
          {(tipoRelatorio === 'vendas' || tipoRelatorio === 'movimentacao') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Filtros específicos para vendas */}
          {tipoRelatorio === 'vendas' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filtros.status}
                  onChange={(e) => setFiltros({...filtros, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="aberta">Aberta</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </>
          )}

          {/* Filtros específicos para estoque */}
          {tipoRelatorio === 'estoque' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="estoque_baixo"
                checked={filtros.estoque_baixo}
                onChange={(e) => setFiltros({...filtros, estoque_baixo: e.target.checked})}
                className="mr-2"
              />
              <label htmlFor="estoque_baixo" className="text-sm font-medium text-gray-700">
                Apenas estoque baixo
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Resumo/Estatísticas */}
      {getCurrentData() && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {tipoRelatorio === 'vendas' && relatorioVendas && (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total de Ordens</p>
                    <p className="text-2xl font-bold text-gray-900">{relatorioVendas.resumo.total_ordens}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Faturamento</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(relatorioVendas.resumo.total_faturamento)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ticket Médio</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(relatorioVendas.resumo.ticket_medio)}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Produtos</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(relatorioVendas.resumo.total_produtos)}
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-purple-500" />
                </div>
              </div>
            </>
          )}

          {tipoRelatorio === 'estoque' && relatorioEstoque && (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total de Produtos</p>
                    <p className="text-2xl font-bold text-gray-900">{relatorioEstoque.resumo.total_produtos}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Valor Total</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(relatorioEstoque.resumo.valor_total_estoque)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Estoque Baixo</p>
                    <p className="text-2xl font-bold text-red-600">{relatorioEstoque.resumo.produtos_estoque_baixo}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Ações de download */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Download className="h-5 w-5" />
          Exportar Relatório
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleDownload('excel')}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Excel (.xlsx)
          </button>
          <button
            onClick={() => handleDownload('pdf')}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Tabela de dados */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {getCurrentLoading() ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando relatório...</p>
          </div>
        ) : getCurrentData() ? (
          <div className="overflow-x-auto">
            {tipoRelatorio === 'vendas' && relatorioVendas && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Final</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {relatorioVendas.ordens.map((ordem: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{ordem.numero}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(ordem.data_abertura), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">{ordem.cliente}</td>
                      <td className="px-6 py-4">{ordem.veiculo}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          ordem.status === 'concluida' 
                            ? 'bg-green-100 text-green-800'
                            : ordem.status === 'em_andamento'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {ordem.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        {formatCurrency(ordem.valor_final)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tipoRelatorio === 'estoque' && relatorioEstoque && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estoque</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mínimo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Situação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {relatorioEstoque.produtos.map((produto: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{produto.codigo}</td>
                      <td className="px-6 py-4">{produto.nome}</td>
                      <td className="px-6 py-4 text-center">{produto.quantidade_atual}</td>
                      <td className="px-6 py-4 text-center">{produto.quantidade_minima}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(produto.valor_estoque)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          produto.situacao === 'Baixo'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {produto.situacao}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tipoRelatorio === 'movimentacao' && relatorioMovimentacao && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qtd</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {relatorioMovimentacao.movimentos?.map((movimento: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(movimento.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">{movimento.produto_nome}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          movimento.tipo === 'entrada'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {movimento.tipo.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">{movimento.quantidade}</td>
                      <td className="px-6 py-4">{movimento.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <FileBarChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Nenhum dado encontrado</p>
            <p className="text-sm">Ajuste os filtros e tente novamente</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Relatorios