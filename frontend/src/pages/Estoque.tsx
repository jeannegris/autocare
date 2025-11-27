import * as React from 'react'
import { useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import AutocompleteCategoria from '../components/AutocompleteCategoria'
import { apiFetch } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useValidacao } from '../utils/validations'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package,
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  BarChart3,
  DollarSign,
  Archive,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react'
import { format } from 'date-fns'
// ptBR não é usado neste arquivo — removido

interface LoteEstoque {
  id: number
  produto_id: number
  movimento_entrada_id: number
  fornecedor_id?: number
  fornecedor_nome?: string
  quantidade_inicial: number
  saldo_atual: number
  preco_custo_unitario: number
  preco_venda_unitario?: number
  margem_lucro?: number
  data_entrada: string
  data_validade?: string
  numero_lote?: string
  ativo: boolean
  created_at: string
}

interface LoteConsumido {
  lote_id: number
  numero_lote?: string
  quantidade_consumida: number
  preco_custo_unitario: number
  data_entrada: string
}

interface ItemEstoque {
  id: number
  codigo: string
  nome: string
  categoria: string
  descricao?: string
  unidade: 'UN' | 'PC' | 'KG' | 'LT' | 'MT' | 'M2' | 'M3'
  quantidade_atual: number
  quantidade_minima: number
  preco_custo: number
  preco_venda: number
  fornecedor_id?: number
  fornecedor_nome?: string
  localizacao?: string
  data_ultima_movimentacao?: string
  tipo_ultima_movimentacao?: 'ENTRADA' | 'SAIDA'
  status: 'DISPONIVEL' | 'BAIXO_ESTOQUE' | 'SEM_ESTOQUE' | 'DESCONTINUADO'
  created_at: string
  updated_at: string
  lotes?: LoteEstoque[]
}

interface MovimentacaoEstoque {
  id: number
  item_id: number
  tipo: 'ENTRADA' | 'SAIDA'
  quantidade: number
  preco_unitario?: number
  preco_custo?: number
  preco_venda?: number
  margem_lucro?: number
  valor_total?: number
  motivo: string
  observacoes?: string
  usuario_id: number
  usuario_nome: string
  fornecedor_id?: number
  fornecedor_nome?: string
  ordem_servico_id?: number
  data_movimentacao: string
  created_at: string
  lote_id?: number
  lotes_consumidos?: LoteConsumido[]
}

interface ItemEstoqueFormData {
  codigo: string
  nome: string
  categoria: string
  descricao?: string
  unidade: 'UN' | 'PC' | 'KG' | 'LT' | 'MT' | 'M2' | 'M3'
  quantidade_minima: number
  localizacao?: string
}

interface MovimentacaoFormData {
  tipo: 'ENTRADA' | 'SAIDA'
  quantidade: number
  preco_unitario?: number
  preco_custo?: number
  preco_venda?: number
  margem_lucro?: number
  motivo: string
  observacoes?: string
  fornecedor_id?: number
}

// Hook para buscar itens do estoque
function useEstoque() {
  return useQuery({
    queryKey: ['estoque'],
    queryFn: async (): Promise<ItemEstoque[]> => {
      // Backend exposes produtos under /api/estoque/produtos
      return await apiFetch('/estoque/produtos') as ItemEstoque[]
    },
    placeholderData: [
      {
        id: 1,
        codigo: 'OIL001',
        nome: 'Óleo Motor 5W30 Sintético',
        categoria: 'Fluidos',
        descricao: 'Óleo sintético para motores a gasolina e flex',
        unidade: 'LT' as const,
        quantidade_atual: 15,
        quantidade_minima: 20,
        preco_custo: 25.90,
        preco_venda: 39.90,
        fornecedor_id: 1,
        fornecedor_nome: 'Petróleo Brasil',
        localizacao: 'A1-01',
        data_ultima_movimentacao: '2024-01-10',
        tipo_ultima_movimentacao: 'SAIDA' as const,
        status: 'BAIXO_ESTOQUE' as const,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-10T15:30:00Z'
      },
      {
        id: 2,
        codigo: 'FLT001',
        nome: 'Filtro de Óleo Honda Civic',
        categoria: 'Filtros',
        descricao: 'Filtro de óleo original para Honda Civic',
        unidade: 'UN' as const,
        quantidade_atual: 45,
        quantidade_minima: 10,
        preco_custo: 18.50,
        preco_venda: 29.90,
        fornecedor_id: 2,
        fornecedor_nome: 'AutoPeças São Paulo',
        localizacao: 'B2-15',
        data_ultima_movimentacao: '2024-01-12',
        tipo_ultima_movimentacao: 'ENTRADA' as const,
        status: 'DISPONIVEL' as const,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-12T09:15:00Z'
      },
      {
        id: 3,
        codigo: 'PAD001',
        nome: 'Pastilha de Freio Dianteira',
        categoria: 'Sistema de Freio',
        descricao: 'Pastilha de freio dianteira universal',
        unidade: 'PC' as const,
        quantidade_atual: 0,
        quantidade_minima: 8,
        preco_custo: 65.00,
        preco_venda: 95.00,
        fornecedor_id: 3,
        fornecedor_nome: 'Freios Mineiros',
        localizacao: 'C1-08',
        data_ultima_movimentacao: '2024-01-08',
        tipo_ultima_movimentacao: 'SAIDA' as const,
        status: 'SEM_ESTOQUE' as const,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-08T14:20:00Z'
      }
    ]
  })
}

// Hook para buscar fornecedores (para dropdown)
function useFornecedores(enabled: boolean = false) {
  return useQuery({
    queryKey: ['fornecedores-dropdown'],
    queryFn: async () => await apiFetch('/fornecedores'),
    placeholderData: [
      { id: 1, nome: 'Petróleo Brasil' },
      { id: 2, nome: 'AutoPeças São Paulo' },
      { id: 3, nome: 'Freios Mineiros' },
      { id: 4, nome: 'Elétrica Automotiva' }
    ],
    enabled // só roda quando explicitamente habilitado
  })
}

// Hook para buscar movimentações de um item
function useMovimentacoes(itemId: number) {
  return useQuery({
    queryKey: ['movimentacoes', itemId],
    queryFn: async (): Promise<MovimentacaoEstoque[]> => {
      // Backend exposes movimentos em /api/estoque/movimentos?produto_id=<id>
      return await apiFetch(`/estoque/movimentos?produto_id=${itemId}`) as MovimentacaoEstoque[]
    },
    enabled: !!itemId,
    placeholderData: [
      {
        id: 1,
        item_id: itemId,
        tipo: 'ENTRADA' as const,
        quantidade: 50,
        preco_unitario: 25.90,
        valor_total: 1295.00,
        motivo: 'Compra de fornecedor',
        observacoes: 'Nota fiscal 12345',
        usuario_id: 1,
        usuario_nome: 'João Silva',
        fornecedor_id: 1,
        fornecedor_nome: 'Petróleo Brasil',
        data_movimentacao: '2024-01-05',
        created_at: '2024-01-05T14:30:00Z'
      },
      {
        id: 2,
        item_id: itemId,
        tipo: 'SAIDA' as const,
        quantidade: 5,
        preco_unitario: 39.90,
        valor_total: 199.50,
        motivo: 'Venda/Serviço',
        observacoes: 'Ordem de serviço #123',
        usuario_id: 2,
        usuario_nome: 'Maria Santos',
        ordem_servico_id: 123,
        data_movimentacao: '2024-01-10',
        created_at: '2024-01-10T15:30:00Z'
      }
    ]
  })
}

// Hook para buscar lotes de um produto
function useLotesEstoque(produtoId: number) {
  return useQuery({
    queryKey: ['lotes', produtoId],
    queryFn: async (): Promise<LoteEstoque[]> => {
      return await apiFetch(`/estoque/produtos/${produtoId}/lotes`) as LoteEstoque[]
    },
    enabled: !!produtoId,
    placeholderData: []
  })
}

// Modal de formulário para item
function ItemEstoqueModal({ 
  isOpen, 
  onClose, 
  item, 
  onSubmit 
}: {
  isOpen: boolean
  onClose: () => void
  item?: ItemEstoque
  onSubmit: (data: ItemEstoqueFormData) => void
}) {
  const { erros, validarCampo, limparErro, limparTodosErros } = useValidacao()
  
  const [formData, setFormData] = useState<ItemEstoqueFormData>({
    codigo: item?.codigo || '',
    nome: item?.nome || '',
    categoria: item?.categoria || '',
    descricao: item?.descricao || '',
    unidade: item?.unidade || 'UN',
    quantidade_minima: item?.quantidade_minima || 1,
    localizacao: item?.localizacao || ''
  })

  // Atualiza o estado do formulário quando o item ou o estado de abertura do modal mudam
  React.useEffect(() => {
    setFormData({
      codigo: item?.codigo || '',
      nome: item?.nome || '',
      categoria: item?.categoria || '',
      descricao: item?.descricao || '',
      unidade: item?.unidade || 'UN',
      quantidade_minima: item?.quantidade_minima || 1,
      localizacao: item?.localizacao || ''
    })
    limparTodosErros()
  }, [item, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar campos obrigatórios
    let formValido = true
    if (!validarCampo('codigo', formData.codigo, 'obrigatorio')) formValido = false
    if (!validarCampo('nome', formData.nome, 'obrigatorio')) formValido = false
    if (!validarCampo('categoria', formData.categoria, 'obrigatorio')) formValido = false
    
    if (!formValido) return
    
    onSubmit(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {item ? 'Editar Item' : 'Novo Item de Estoque'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) => {
                  setFormData({...formData, codigo: e.target.value})
                  if (e.target.value.trim()) {
                    limparErro('codigo')
                  } else {
                    validarCampo('codigo', e.target.value, 'obrigatorio')
                  }
                }}
                onBlur={(e) => validarCampo('codigo', e.target.value, 'obrigatorio')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.codigo 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
                placeholder="OIL001"
              />
              {erros.codigo && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.codigo}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => {
                  setFormData({...formData, nome: e.target.value})
                  if (e.target.value.trim()) {
                    limparErro('nome')
                  } else {
                    validarCampo('nome', e.target.value, 'obrigatorio')
                  }
                }}
                onBlur={(e) => validarCampo('nome', e.target.value, 'obrigatorio')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.nome 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
                placeholder="Óleo Motor 5W30 Sintético"
              />
              {erros.nome && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.nome}
                </p>
              )}
            </div>
          </div>

          {/* Categoria e Unidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <AutocompleteCategoria
                value={formData.categoria}
                onSelect={(categoria) => {
                  setFormData({...formData, categoria})
                  if (categoria.trim()) {
                    limparErro('categoria')
                  } else {
                    validarCampo('categoria', categoria, 'obrigatorio')
                  }
                }}
                placeholder="Buscar ou criar categoria..."
              />
              {erros.categoria && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.categoria}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade *</label>
              <select
                value={formData.unidade}
                onChange={(e) => setFormData({...formData, unidade: e.target.value as any})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="UN">Unidade</option>
                <option value="PC">Peça</option>
                <option value="KG">Quilograma</option>
                <option value="LT">Litro</option>
                <option value="MT">Metro</option>
                <option value="M2">Metro²</option>
                <option value="M3">Metro³</option>
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={formData.descricao || ''}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Descrição detalhada do item..."
            />
          </div>

          {/* Estoque Mínimo e Localização */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo *</label>
              <input
                type="number"
                value={formData.quantidade_minima}
                onChange={(e) => setFormData({...formData, quantidade_minima: parseInt(e.target.value) || 1})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                min={1}
                placeholder="20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
              <input
                type="text"
                value={formData.localizacao || ''}
                onChange={(e) => setFormData({...formData, localizacao: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="A1-01"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {item ? 'Atualizar Item' : 'Cadastrar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal de movimentação
function MovimentacaoModal({ 
  isOpen, 
  onClose, 
  item, 
  onSubmit 
}: {
  isOpen: boolean
  onClose: () => void
  item?: ItemEstoque
  onSubmit: (data: MovimentacaoFormData) => void
}) {
  const { data: fornecedores = [] } = useFornecedores(isOpen)
  
  const [formData, setFormData] = useState<MovimentacaoFormData>({
    tipo: 'ENTRADA',
    quantidade: 1,
    preco_unitario: 0,
    preco_custo: 0,
    preco_venda: 0,
    margem_lucro: 0,
    motivo: '',
    observacoes: '',
    fornecedor_id: undefined
  })
  
  const [fornecedorError, setFornecedorError] = useState<string>('')

  // Resetar formulário quando o modal abrir
  React.useEffect(() => {
    if (isOpen && item) {
      setFormData({
        tipo: 'ENTRADA',
        quantidade: 1,
        preco_unitario: 0,
        preco_custo: 0,
        preco_venda: 0,
        margem_lucro: 0,
        motivo: '',
        observacoes: '',
        fornecedor_id: undefined
      })
      setFornecedorError('')
    }
  }, [isOpen, item])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Limpar erros anteriores
    setFornecedorError('')
    
    // Validação para entrada: fornecedor é obrigatório
    if (formData.tipo === 'ENTRADA') {
      if (!formData.fornecedor_id) {
        setFornecedorError('Escolha um Fornecedor, caso não esteja na lista cadastre um fornecedor e depois retorne para dar entrada no estoque!')
        return
      }
    }
    
    onSubmit(formData)
    onClose()
  }

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Nova Movimentação
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {item.codigo} - {item.nome}
            </p>
            <p className="text-sm text-gray-500">
              Estoque atual: {item.quantidade_atual} {item.unidade}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de movimentação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimentação *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormData({...formData, tipo: 'ENTRADA'})
                  setFornecedorError('')
                }}
                className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                  formData.tipo === 'ENTRADA'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="h-5 w-5 mx-auto mb-1" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData({...formData, tipo: 'SAIDA'})
                  setFornecedorError('')
                }}
                className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                  formData.tipo === 'SAIDA'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <TrendingDown className="h-5 w-5 mx-auto mb-1" />
                Saída
              </button>
            </div>
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
            <input
              type="number"
              value={formData.quantidade}
              onChange={(e) => setFormData({...formData, quantidade: parseInt(e.target.value) || 1})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              min={1}
              max={formData.tipo === 'SAIDA' ? item.quantidade_atual : undefined}
            />
            {formData.tipo === 'SAIDA' && formData.quantidade > item.quantidade_atual && (
              <p className="text-sm text-red-600 mt-1">
                Quantidade não pode ser maior que o estoque atual ({item.quantidade_atual})
              </p>
            )}
          </div>

          {/* Campos específicos para ENTRADA */}
          {formData.tipo === 'ENTRADA' && (
            <>
              {/* Preço de Custo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço de Custo Unitário *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.preco_custo || ''}
                  onChange={(e) => {
                    const precoCusto = parseFloat(e.target.value) || 0
                    setFormData({...formData, preco_custo: precoCusto, preco_unitario: precoCusto})
                    
                    // Se já tem margem, recalcula o preço de venda
                    if (formData.margem_lucro && formData.margem_lucro > 0) {
                      const novoPrecoVenda = precoCusto * (1 + formData.margem_lucro / 100)
                      setFormData({...formData, preco_custo: precoCusto, preco_unitario: precoCusto, preco_venda: parseFloat(novoPrecoVenda.toFixed(2))})
                    }
                  }}
                  onBlur={(e) => {
                    const valor = parseFloat(e.target.value) || 0
                    setFormData({...formData, preco_custo: parseFloat(valor.toFixed(2)), preco_unitario: parseFloat(valor.toFixed(2))})
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  min={0}
                  placeholder="0,00"
                />
              </div>

              {/* Grid com Preço de Venda e Margem de Lucro */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Preço de Venda */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço de Venda *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.preco_venda || ''}
                    onChange={(e) => {
                      const valor = e.target.value
                      
                      // Se o campo estiver vazio, limpar tudo
                      if (valor === '' || valor === null) {
                        setFormData({...formData, preco_venda: undefined, margem_lucro: undefined})
                        return
                      }
                      
                      const precoVenda = parseFloat(valor)
                      
                      // Se não for um número válido, não fazer nada
                      if (isNaN(precoVenda)) {
                        return
                      }
                      
                      // Calcula a margem automaticamente se houver preço de custo
                      if (formData.preco_custo && formData.preco_custo > 0 && precoVenda > 0) {
                        const margem = ((precoVenda - formData.preco_custo) / formData.preco_custo) * 100
                        setFormData({...formData, preco_venda: precoVenda, margem_lucro: parseFloat(margem.toFixed(2))})
                      } else {
                        setFormData({...formData, preco_venda: precoVenda, margem_lucro: undefined})
                      }
                    }}
                    onBlur={(e) => {
                      const valor = parseFloat(e.target.value)
                      if (!isNaN(valor) && valor > 0) {
                        setFormData({...formData, preco_venda: parseFloat(valor.toFixed(2))})
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min={0}
                    placeholder="0,00"
                  />
                </div>

                {/* Margem de Lucro */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Margem de Lucro (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.margem_lucro || ''}
                    onChange={(e) => {
                      const valor = e.target.value
                      
                      // Se o campo estiver vazio, limpar tudo
                      if (valor === '' || valor === null) {
                        setFormData({...formData, margem_lucro: undefined, preco_venda: undefined})
                        return
                      }
                      
                      const margem = parseFloat(valor)
                      
                      // Se não for um número válido, não fazer nada
                      if (isNaN(margem)) {
                        return
                      }
                      
                      // Calcula o preço de venda automaticamente se houver preço de custo
                      if (formData.preco_custo && formData.preco_custo > 0) {
                        const precoVenda = formData.preco_custo * (1 + margem / 100)
                        setFormData({...formData, margem_lucro: margem, preco_venda: parseFloat(precoVenda.toFixed(2))})
                      } else {
                        setFormData({...formData, margem_lucro: margem})
                      }
                    }}
                    onBlur={(e) => {
                      const valor = parseFloat(e.target.value)
                      if (!isNaN(valor)) {
                        setFormData({...formData, margem_lucro: parseFloat(valor.toFixed(2))})
                      }
                    }}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min={0}
                    placeholder="0,00"
                    disabled={!formData.preco_custo || formData.preco_custo <= 0}
                  />
                  {(!formData.preco_custo || formData.preco_custo <= 0) && (
                    <p className="mt-1 text-xs text-gray-500 flex items-start">
                      <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                      <span>Preencha o Preço de Custo primeiro</span>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Campo de Preço Unitário para SAÍDA */}
          {formData.tipo === 'SAIDA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço Unitário (Venda)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.preco_unitario || ''}
                onChange={(e) => setFormData({...formData, preco_unitario: parseFloat(e.target.value) || 0})}
                onBlur={(e) => {
                  const valor = parseFloat(e.target.value) || 0
                  setFormData({...formData, preco_unitario: parseFloat(valor.toFixed(2))})
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
                placeholder={(Number(item.preco_venda) || 0).toFixed(2).replace('.', ',')}
              />
            </div>
          )}

          {/* Fornecedor (apenas para entrada) */}
          {formData.tipo === 'ENTRADA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fornecedor *
              </label>
              <select
                value={formData.fornecedor_id || ''}
                onChange={(e) => {
                  setFormData({...formData, fornecedor_id: e.target.value ? parseInt(e.target.value) : undefined})
                  if (e.target.value) {
                    setFornecedorError('')
                  }
                }}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-blue-500 ${
                  fornecedorError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
              >
                <option value="">Selecione um fornecedor</option>
                {fornecedores.map((fornecedor: any) => (
                  <option key={fornecedor.id} value={fornecedor.id}>
                    {fornecedor.nome}
                  </option>
                ))}
              </select>
              {fornecedorError && (
                <p className="mt-1 text-sm text-red-600 flex items-start">
                  <AlertCircle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                  <span>{fornecedorError}</span>
                </p>
              )}
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
            <input
              type="text"
              value={formData.motivo}
              onChange={(e) => setFormData({...formData, motivo: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              placeholder={formData.tipo === 'ENTRADA' ? 'Compra de fornecedor' : 'Venda/Serviço'}
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Informações adicionais..."
            />
          </div>

          {/* Resumo */}
          {formData.quantidade > 0 && formData.preco_unitario != null && formData.preco_unitario > 0 && (
            <div className={`p-4 rounded-lg border-2 ${formData.tipo === 'ENTRADA' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h4 className={`text-sm font-semibold mb-3 ${formData.tipo === 'ENTRADA' ? 'text-green-800' : 'text-red-800'}`}>
                Resumo da Movimentação
              </h4>
              
              {/* Valor Total */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Valor Total:</span>
                <span className={`text-lg font-bold ${formData.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {(Number(formData.quantidade || 0) * (Number(formData.preco_unitario) || 0)).toFixed(2)}
                </span>
              </div>

              {/* Informações específicas para ENTRADA */}
              {formData.tipo === 'ENTRADA' && formData.preco_custo && formData.preco_custo > 0 && (
                <div className="border-t border-green-200 pt-2 mt-2 space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Preço de Custo (unit.):</span>
                    <span className="font-medium text-gray-800">R$ {Number(formData.preco_custo).toFixed(2)}</span>
                  </div>
                  
                  {formData.preco_venda && formData.preco_venda > 0 && (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Preço de Venda (unit.):</span>
                        <span className="font-medium text-gray-800">R$ {Number(formData.preco_venda).toFixed(2)}</span>
                      </div>
                      
                      {formData.margem_lucro != null && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Margem de Lucro:</span>
                          <span className="font-medium text-green-700">{Number(formData.margem_lucro).toFixed(2)}%</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-sm pt-1 border-t border-green-200">
                        <span className="text-gray-600">Lucro por unidade:</span>
                        <span className="font-semibold text-green-700">
                          R$ {(Number(formData.preco_venda) - Number(formData.preco_custo)).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Estoque após movimentação */}
              <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-300">
                <span className="text-sm font-medium text-gray-700">Estoque após movimentação:</span>
                <span className={`text-sm font-bold ${formData.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}>
                  {formData.tipo === 'ENTRADA' 
                    ? item.quantidade_atual + formData.quantidade 
                    : item.quantidade_atual - formData.quantidade
                  } {item.unidade}
                </span>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 ${
                formData.tipo === 'ENTRADA'
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              }`}
              disabled={formData.tipo === 'SAIDA' && formData.quantidade > item.quantidade_atual}
            >
              Confirmar {formData.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal para visualizar lotes disponíveis de um produto
function LotesDisponiveisModal({ 
  isOpen, 
  onClose, 
  item 
}: {
  isOpen: boolean
  onClose: () => void
  item?: ItemEstoque
}) {
  const { data: lotes = [], isLoading } = useLotesEstoque(item?.id || 0)
  
  if (!isOpen || !item) return null

  const lotesAtivos = lotes.filter(l => l.ativo && l.saldo_atual > 0)
  const totalEstoque = lotesAtivos.reduce((acc, lote) => acc + Number(lote.saldo_atual), 0)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-5xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Lotes Disponíveis (FIFO)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {item.codigo} - {item.nome}
            </p>
            <p className="text-sm font-medium text-blue-600 mt-1">
              Total em estoque: {totalEstoque.toFixed(2)} {item.unidade}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {lotesAtivos.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lote
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Entrada
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qtd. Inicial
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Saldo Atual
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo Unit.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fornecedor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lotesAtivos.map((lote, idx) => {
                      const valorTotal = Number(lote.saldo_atual) * Number(lote.preco_custo_unitario)
                      return (
                        <tr key={lote.id} className={idx === 0 ? 'bg-green-50' : ''}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {lote.numero_lote || `#${lote.id}`}
                            {idx === 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Próximo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {format(new Date(lote.data_entrada), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                            {Number(lote.quantidade_inicial).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {Number(lote.saldo_atual).toFixed(2)} {item.unidade}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                            R$ {Number(lote.preco_custo_unitario).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            R$ {valorTotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {lote.fornecedor_nome || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900">
                        TOTAL
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                        {totalEstoque.toFixed(2)} {item.unidade}
                      </td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                        R$ {lotesAtivos.reduce((acc, l) => acc + (Number(l.saldo_atual) * Number(l.preco_custo_unitario)), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nenhum lote disponível
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Não há lotes com saldo disponível para este produto.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-6 border-t mt-6">
          <div className="text-sm text-gray-600">
            <p><strong>FIFO:</strong> First In, First Out - Os lotes mais antigos são consumidos primeiro nas saídas.</p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal de histórico de movimentações
function HistoricoMovimentacoesModal({ 
  isOpen, 
  onClose, 
  item 
}: {
  isOpen: boolean
  onClose: () => void
  item?: ItemEstoque
}) {
  const { data: movimentacoes = [], isLoading } = useMovimentacoes(item?.id || 0)

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Histórico de Movimentações
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {item.codigo} - {item.nome}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {movimentacoes.map((mov) => (
              <div key={mov.id} className={`relative p-4 rounded-lg border-l-4 ${
                mov.tipo === 'ENTRADA' ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`p-1 rounded-full ${mov.tipo === 'ENTRADA' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {mov.tipo === 'ENTRADA' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {mov.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'} - {mov.motivo}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(mov.data_movimentacao), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${mov.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.tipo === 'ENTRADA' ? '+' : '-'}{mov.quantidade} {item.unidade}
                    </p>
                    {mov.valor_total != null && (
                      <p className="text-sm text-gray-600">
                        R$ {Number(mov.valor_total ?? 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mt-2">
                  {mov.preco_unitario != null && (
                    <div>
                      <span className="font-medium">Preço unitário:</span> R$ {Number(mov.preco_unitario ?? 0).toFixed(2)}
                    </div>
                  )}
                  {mov.preco_custo != null && mov.preco_custo > 0 && (
                    <div>
                      <span className="font-medium">Preço de Custo:</span> R$ {Number(mov.preco_custo).toFixed(2)}
                    </div>
                  )}
                  {mov.preco_venda != null && mov.preco_venda > 0 && (
                    <div>
                      <span className="font-medium">Preço de Venda:</span> R$ {Number(mov.preco_venda).toFixed(2)}
                    </div>
                  )}
                  {mov.margem_lucro != null && mov.margem_lucro > 0 && (
                    <div>
                      <span className="font-medium">Margem de Lucro:</span> 
                      <span className="text-green-600 font-semibold"> {Number(mov.margem_lucro).toFixed(2)}%</span>
                    </div>
                  )}
                  {mov.fornecedor_nome && (
                    <div>
                      <span className="font-medium">Fornecedor:</span> {mov.fornecedor_nome}
                    </div>
                  )}
                </div>
                
                {/* Mostrar lotes consumidos em saídas */}
                {mov.tipo === 'SAIDA' && mov.lotes_consumidos && mov.lotes_consumidos.length > 0 && (
                  <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Lotes Consumidos (FIFO):</p>
                    <div className="space-y-1">
                      {mov.lotes_consumidos.map((lote, idx) => (
                        <div key={idx} className="text-xs text-gray-600 flex justify-between">
                          <span>
                            {lote.numero_lote ? `Lote ${lote.numero_lote}` : `Lote #${lote.lote_id}`} 
                            {' • '}
                            {format(new Date(lote.data_entrada), 'dd/MM/yyyy')}
                          </span>
                          <span className="font-medium">
                            {lote.quantidade_consumida} {item.unidade} × R$ {Number(lote.preco_custo_unitario).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {mov.observacoes && (
                  <div className="mt-2">
                    <span className="font-medium text-sm text-gray-600">Observações:</span>
                    <p className="text-sm text-gray-600">{mov.observacoes}</p>
                  </div>
                )}
                
                {/* Informação do usuário no canto inferior direito */}
                {mov.usuario_nome && (
                  <div className="mt-3 text-right">
                    <p className="text-xs text-gray-500 italic">
                      Movimentado por: {mov.usuario_nome}
                    </p>
                  </div>
                )}
              </div>
            ))}
            
            {movimentacoes.length === 0 && (
              <div className="text-center py-8">
                <RefreshCw className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nenhuma movimentação registrada
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Ainda não há movimentações para este item.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-6 border-t mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Estoque() {
  const [searchTerm, setSearchTerm] = useState('')
  // Ordenação e redimensionamento (tabela principal)
  const colunas = ['item', 'categoria', 'estoque', 'precos', 'status', 'acoes'] as const
  type Coluna = typeof colunas[number]
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; direcao: 'asc' | 'desc' }>({ coluna: 'item', direcao: 'asc' })
  const [columnWidths, setColumnWidths] = useState<number[]>([320, 160, 160, 180, 140, 160])
  const [resizingColumn, setResizingColumn] = useState<number | null>(null)
  const [startX, setStartX] = useState<number>(0)
  const [startWidth, setStartWidth] = useState<number>(0)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isMovimentacaoModalOpen, setIsMovimentacaoModalOpen] = useState(false)
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false)
  const [isLotesModalOpen, setIsLotesModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemEstoque | undefined>()
  const [selectedItem, setSelectedItem] = useState<ItemEstoque | undefined>()
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'DISPONIVEL' | 'BAIXO_ESTOQUE' | 'SEM_ESTOQUE'>('TODOS')

  // Delete confirm modal state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [idToDelete, setIdToDelete] = useState<number | null>(null)

  const confirmDeleteItem = () => {
    if (idToDelete) deleteItemMutation.mutate(idToDelete)
    setIsDeleteConfirmOpen(false)
    setIdToDelete(null)
  }

  const queryClient = useQueryClient()
  const { data: itens = [], isLoading, error } = useEstoque()

  // Mutações CRUD
  const createItemMutation = useMutation({
    mutationFn: async (data: ItemEstoqueFormData) => {
      // Criar produto -> POST /api/estoque/produtos
      return await apiFetch('/estoque/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as ItemEstoque
    },
    onSuccess: (created: ItemEstoque) => {
      // Tentar enriquecer com o nome do fornecedor a partir do cache de fornecedores
      const fornecedoresCache = queryClient.getQueryData<any[]>(['fornecedores-dropdown']) || []
      const fornecedor = fornecedoresCache.find(f => f.id === created.fornecedor_id)
      const itemToInsert = fornecedor ? { ...created, fornecedor_nome: fornecedor.nome } : created

      // Inserir no cache e manter ordem alfabética
      queryClient.setQueryData<ItemEstoque[] | undefined>(['estoque'], (old) => {
        const list = old ? [...old, itemToInsert] : [itemToInsert]
        return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      })
      // Garantir que a lista de fornecedores esteja atualizada
      queryClient.invalidateQueries({ queryKey: ['fornecedores-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      // Fechar modal após sucesso
      setIsItemModalOpen(false)
      setEditingItem(undefined)
    },
    onError: (err: any) => {
      
      alert('Erro ao criar item: ' + (err?.message || err))
    }
  })

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ItemEstoqueFormData }) => {
      // Atualizar produto -> PUT /api/estoque/produtos/{id}
      return await apiFetch(`/estoque/produtos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as ItemEstoque
    },
    onSuccess: (updated: ItemEstoque) => {
      // Tentar enriquecer o objeto atualizado com fornecedor_nome a partir do cache de fornecedores
      const fornecedoresCache = queryClient.getQueryData<any[]>(['fornecedores-dropdown']) || []
      const fornecedor = fornecedoresCache.find(f => f.id === updated.fornecedor_id)
      const itemToSet = fornecedor ? { ...updated, fornecedor_nome: fornecedor.nome } : updated

      // Substituir item no cache e manter ordem
      queryClient.setQueryData<ItemEstoque[] | undefined>(['estoque'], (old) => {
        if (!old) return [itemToSet]
        const next = old.map(i => i.id === itemToSet.id ? itemToSet : i)
        return next.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      })
      // Garantir que a lista de fornecedores esteja atualizada (caso o backend tenha criado/alterado)
      queryClient.invalidateQueries({ queryKey: ['fornecedores-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
    },
    onError: (err: any) => {
      
      alert('Erro ao atualizar item: ' + (err?.message || err))
    }
  })

  const deleteItemMutation = useMutation({
    // Remoção otimista: atualizar cache imediatamente e fazer rollback se falhar
    mutationFn: async (id: number) => {
      await apiFetch(`/estoque/produtos/${id}`, { method: 'DELETE' })
      return id
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ['estoque'] })
      const previous = queryClient.getQueryData<ItemEstoque[]>(['estoque'])
      queryClient.setQueryData<ItemEstoque[] | undefined>(['estoque'], (old) => {
        if (!old) return old
        return old.filter(i => i.id !== id)
      })
      return { previous }
    },
    onError: (err: any, _variables: any, context: any) => {
      // Rollback
      if (context?.previous) {
        queryClient.setQueryData(['estoque'], context.previous)
      }
      alert('Erro ao deletar item: ' + (err?.message || err))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
    }
  })

  const createMovimentacaoMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: MovimentacaoFormData }) => {
      // Criar movimentação -> POST /api/estoque/movimentos (item_id no body)
      const body = { ...data, item_id: itemId }
      return await apiFetch(`/estoque/movimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }) as MovimentacaoEstoque
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] })
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] })
    },
    onError: (err: any) => {
      
      alert('Erro ao registrar movimentação: ' + (err?.message || err))
    }
  })

  const handleSubmitItem = (data: ItemEstoqueFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data })
    } else {
      createItemMutation.mutate(data)
    }
    // Modal será fechado no onSuccess das mutations
  }

  const handleSubmitMovimentacao = (data: MovimentacaoFormData) => {
    if (selectedItem) {
      createMovimentacaoMutation.mutate({ itemId: selectedItem.id, data })
    }
    setSelectedItem(undefined)
  }

  const handleEditItem = async (item: ItemEstoque) => {
    try {
      // Tentar buscar versão atualizada do backend para evitar problemas de cache
      const fresh = await apiFetch(`/estoque/produtos/${item.id}`)
      if (fresh) {
        setEditingItem(fresh as ItemEstoque)
      } else {
        setEditingItem(item)
      }
    } catch (err) {
      setEditingItem(item)
    }
    setIsItemModalOpen(true)
  }

  const handleDeleteItem = (id: number) => {
    setIdToDelete(id)
    setIsDeleteConfirmOpen(true)
  }

  const handleMovimentacao = (item: ItemEstoque) => {
    setSelectedItem(item)
    setIsMovimentacaoModalOpen(true)
  }

  const handleVerHistorico = (item: ItemEstoque) => {
    setSelectedItem(item)
    setIsHistoricoModalOpen(true)
  }

  const handleVerLotes = (item: ItemEstoque) => {
    setSelectedItem(item)
    setIsLotesModalOpen(true)
  }

  // Filtros
  // Ordenar itens alfabeticamente por nome no front-end para manter previsibilidade
  const orderedItens = itens ? [...itens].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) : []

  const categoriasUnicas = [...new Set(orderedItens.map(i => i.categoria))].sort()

  const filteredItens = orderedItens.filter(item => {
    const matchesSearch = 
  (String(item.codigo || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())) ||
  (String(item.nome || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())) ||
  (String(item.categoria || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())) ||
  (item.fornecedor_nome && String(item.fornecedor_nome).toLowerCase().includes(String(searchTerm || '').toLowerCase()))
    
    const matchesCategoria = filtroCategoria === '' || item.categoria === filtroCategoria
    const matchesStatus = filtroStatus === 'TODOS' || item.status === filtroStatus
    
    return matchesSearch && matchesCategoria && matchesStatus
  })

  // Ordenação aplicada após filtros
  const itensOrdenados = React.useMemo(() => {
    const data = [...filteredItens]
    const dir = ordenacao.direcao === 'asc' ? 1 : -1
    data.sort((a, b) => {
      switch (ordenacao.coluna) {
        case 'item': {
          const aStr = `${a.codigo || ''} - ${a.nome || ''}`.toLowerCase()
          const bStr = `${b.codigo || ''} - ${b.nome || ''}`.toLowerCase()
          return aStr.localeCompare(bStr) * dir
        }
        case 'categoria':
          return (a.categoria || '').localeCompare(b.categoria || '') * dir
        case 'estoque':
          return ((a.quantidade_atual || 0) - (b.quantidade_atual || 0)) * dir
        case 'precos':
          return ((Number(a.preco_venda) || 0) - (Number(b.preco_venda) || 0)) * dir
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * dir
        default:
          return 0
      }
    })
    return data
  }, [filteredItens, ordenacao])

  const handleSort = (coluna: Coluna) => {
    setOrdenacao(prev => {
      if (prev.coluna === coluna) {
        return { coluna, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' }
      }
      return { coluna, direcao: 'asc' }
    })
  }

  const handleMouseDownResize = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(index)
    setStartX(e.clientX)
    setStartWidth(columnWidths[index])
    document.body.classList.add('resizing')
  }

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (resizingColumn == null) return
      const delta = e.clientX - startX
      setColumnWidths(prev => {
        const next = [...prev]
        const newWidth = Math.max(80, startWidth + delta)
        next[resizingColumn!] = newWidth
        return next
      })
    }
    const onMouseUp = () => {
      if (resizingColumn != null) {
        setResizingColumn(null)
        document.body.classList.remove('resizing')
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizingColumn, startX, startWidth])

  // Estatísticas
  const stats = {
    total: orderedItens.length,
    baixoEstoque: orderedItens.filter(i => i.status === 'BAIXO_ESTOQUE').length,
    semEstoque: orderedItens.filter(i => i.status === 'SEM_ESTOQUE').length,
    valorTotal: orderedItens.reduce((acc, item) => acc + (item.quantidade_atual * item.preco_custo), 0)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DISPONIVEL': return 'text-green-600 bg-green-100'
      case 'BAIXO_ESTOQUE': return 'text-yellow-600 bg-yellow-100'
      case 'SEM_ESTOQUE': return 'text-red-600 bg-red-100'
      case 'DESCONTINUADO': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DISPONIVEL': return <CheckCircle className="h-4 w-4" />
      case 'BAIXO_ESTOQUE': return <AlertTriangle className="h-4 w-4" />
      case 'SEM_ESTOQUE': return <AlertTriangle className="h-4 w-4" />
      case 'DESCONTINUADO': return <Archive className="h-4 w-4" />
      default: return <Package className="h-4 w-4" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DISPONIVEL': return 'Disponível'
      case 'BAIXO_ESTOQUE': return 'Baixo estoque'
      case 'SEM_ESTOQUE': return 'Sem estoque'
      case 'DESCONTINUADO': return 'Descontinuado'
      default: return 'N/A'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">Erro ao carregar estoque</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Controle de Estoque</h1>
          <p className="text-gray-600 mt-1">
            {stats.total} ite{stats.total !== 1 ? 'ns' : 'm'} cadastrado{stats.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingItem(undefined)
            setIsItemModalOpen(true)
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Item
        </button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total de Itens</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Baixo Estoque</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.baixoEstoque}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Sem Estoque</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.semEstoque}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Valor Total</p>
              <p className="text-2xl font-semibold text-gray-900">
                R$ {(stats.valorTotal != null ? stats.valorTotal : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Buscar por código, nome, categoria..."
          />
        </div>
        
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todas as categorias</option>
          {categoriasUnicas.map((categoria) => (
            <option key={categoria} value={categoria}>{categoria}</option>
          ))}
        </select>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as any)}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="TODOS">Todos os status</option>
          <option value="DISPONIVEL">Disponível</option>
          <option value="BAIXO_ESTOQUE">Baixo estoque</option>
          <option value="SEM_ESTOQUE">Sem estoque</option>
        </select>
      </div>

      {/* Lista de Itens */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <colgroup>
              {columnWidths.map((w, idx) => (
                <col key={idx} style={{ width: w }} />
              ))}
            </colgroup>
            <thead className="bg-gray-50 select-none">
              <tr>
                {[
                  { key: 'item', label: 'Item', align: 'left' },
                  { key: 'categoria', label: 'Categoria', align: 'center' },
                  { key: 'estoque', label: 'Estoque', align: 'center' },
                  { key: 'precos', label: 'Preços', align: 'center' },
                  { key: 'status', label: 'Status', align: 'center' },
                  { key: 'acoes', label: 'Ações', align: 'center' }
                ].map((col, idx) => (
                  <th
                    key={col.key}
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${col.align === 'left' ? 'text-left' : 'text-center'}`}
                  >
                    <div className="relative group flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => col.key !== 'acoes' && handleSort(col.key as Coluna)}
                        className={`flex items-center gap-1 ${col.align === 'left' ? 'justify-start w-full' : ''}`}
                      >
                        <span>{col.label}</span>
                        {col.key !== 'acoes' && (
                          ordenacao.coluna === (col.key as Coluna)
                            ? (ordenacao.direcao === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />)
                            : <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                        )}
                      </button>
                      {col.key !== 'acoes' && (
                        <div
                          onMouseDown={(e) => handleMouseDownResize(idx, e)}
                          className="absolute -right-2 top-0 h-full w-4 cursor-col-resize flex items-center justify-center"
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Redimensionar coluna ${col.label}`}
                        >
                          <div className="w-px h-4 bg-gray-300 group-hover:bg-blue-500" />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {itensOrdenados.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.codigo} - {item.nome}
                      </div>
                      {item.descricao && (
                        <div className="text-sm text-gray-500 break-words max-w-xs">
                          {item.descricao}
                        </div>
                      )}
                      {item.localizacao && (
                        <div className="text-xs text-gray-400">
                          📍 {item.localizacao}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-center">
                    {item.categoria}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{item.quantidade_atual}</span> {item.unidade}
                    </div>
                    <div className="text-xs text-gray-500">
                      Mín: {item.quantidade_minima} {item.unidade}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-center">
                    <div>Custo: R$ {(Number(item.preco_custo) || 0).toFixed(2)}</div>
                    <div>Venda: R$ {(Number(item.preco_venda) || 0).toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {getStatusIcon(item.status)}
                      <span className="ml-1">{getStatusLabel(item.status)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleMovimentacao(item)}
                        className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50"
                        title="Registrar movimentação"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleVerHistorico(item)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                        title="Ver histórico"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleVerLotes(item)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                        title="Ver lotes (FIFO)"
                      >
                        <Package className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditItem(item)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                        title="Editar item"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        className="text-orange-600 hover:text-orange-900 p-1 rounded hover:bg-orange-50"
                        title="Exportar dados"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                        title="Excluir item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estado vazio */}
      {filteredItens.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchTerm || filtroCategoria || filtroStatus !== 'TODOS' ? 'Nenhum item encontrado' : 'Nenhum item cadastrado'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filtroCategoria || filtroStatus !== 'TODOS' 
              ? 'Tente ajustar os filtros de busca.' 
              : 'Comece cadastrando itens para controlar o estoque do seu AutoCenter.'
            }
          </p>
          {!searchTerm && !filtroCategoria && filtroStatus === 'TODOS' && (
            <div className="mt-6">
              <button
                onClick={() => {
                  setEditingItem(undefined)
                  setIsItemModalOpen(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <ItemEstoqueModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false)
          setEditingItem(undefined)
        }}
        item={editingItem}
        onSubmit={handleSubmitItem}
      />

      <MovimentacaoModal
        isOpen={isMovimentacaoModalOpen}
        onClose={() => {
          setIsMovimentacaoModalOpen(false)
          setSelectedItem(undefined)
        }}
        item={selectedItem}
        onSubmit={handleSubmitMovimentacao}
      />

      <HistoricoMovimentacoesModal
        isOpen={isHistoricoModalOpen}
        onClose={() => {
          setIsHistoricoModalOpen(false)
          setSelectedItem(undefined)
        }}
        item={selectedItem}
      />

      <LotesDisponiveisModal
        isOpen={isLotesModalOpen}
        onClose={() => {
          setIsLotesModalOpen(false)
          setSelectedItem(undefined)
        }}
        item={selectedItem}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Excluir item"
        message="Tem certeza que deseja deletar este item do estoque?"
        confirmText="Excluir"
        cancelText="Cancelar"
        onCancel={() => { setIsDeleteConfirmOpen(false); setIdToDelete(null) }}
        onConfirm={confirmDeleteItem}
      />
    </div>
  )
}