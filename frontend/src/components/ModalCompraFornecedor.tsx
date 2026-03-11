import React, { useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../hooks/useApi'

interface Produto {
  id: number
  nome: string
  codigo?: string
  quantidade_atual: number
  preco_custo: number
  preco_venda: number
}

interface ItemCompra {
  produto_id: number
  quantidade: number
  preco_custo_unitario: number
  preco_venda_unitario: number | null
  margem_lucro: number | null
}

interface ModalCompraFornecedorProps {
  isOpen: boolean
  fornecedor_id: number
  fornecedor_nome: string
  onClose: () => void
  onSuccess?: () => void
}

const ModalCompraFornecedor: React.FC<ModalCompraFornecedorProps> = ({
  isOpen,
  fornecedor_id,
  fornecedor_nome,
  onClose,
  onSuccess
}) => {
  const api = useApi()
  
  // Estados
  const [numero_nota, setNumeroNota] = useState('')
  const [valor_frete, setValorFrete] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemCompra[]>([
    { produto_id: 0, quantidade: 1, preco_custo_unitario: 0, preco_venda_unitario: null, margem_lucro: null }
  ])

  // Buscar produtos disponíveis
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const res = await api.get('/estoque/produtos?limit=1000')
      return res.data
    },
    enabled: isOpen
  })

  // Mutation para criar compra
  const createCompraMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Enviando compra:', data)
      const res = await api.post('/compras-fornecedor/', data)
      return res.data
    },
    onSuccess: () => {
      // Limpar formulário
      setNumeroNota('')
      setValorFrete('')
      setObservacoes('')
      setItens([{ produto_id: 0, quantidade: 1, preco_custo_unitario: 0, preco_venda_unitario: null, margem_lucro: null }])
      onClose()
      if (onSuccess) onSuccess()
    },
    onError: (error: any) => {
      console.error('Erro na requisição:', error)
      console.error('Status:', error.response?.status)
      console.error('Dados de erro:', error.response?.data)
      alert(`Erro ao criar compra: ${error.response?.data?.detail || error.message}`)
    }
  })

  const handleAddItem = () => {
    setItens([
      ...itens,
      { produto_id: 0, quantidade: 1, preco_custo_unitario: 0, preco_venda_unitario: null, margem_lucro: null }
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItens(itens.filter((_: ItemCompra, i: number) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItens = [...itens]
    const item = newItens[index]

    if (field === 'produto_id') {
      // Quando selecionar um produto, preencher custo padrão e calcular margem
      const produtoSelecionado = produtos.find((p: Produto) => p.id === value)
      if (produtoSelecionado) {
        const custoUnitario = produtoSelecionado.preco_custo || 0
        const precoVenda = produtoSelecionado.preco_venda || 0
        let margemCalculada: number | null = null
        
        // Calcular margem baseado no preço de venda
        if (custoUnitario > 0 && precoVenda > 0) {
          margemCalculada = ((precoVenda - custoUnitario) / custoUnitario) * 100
        }
        
        newItens[index] = {
          ...item,
          produto_id: value,
          preco_custo_unitario: custoUnitario,
          preco_venda_unitario: precoVenda,
          margem_lucro: margemCalculada
        }
      } else {
        newItens[index] = { ...item, produto_id: value }
      }
    } else if (field === 'preco_venda_unitario') {
      // Quando preencher preço de venda, calcular margem
      const novoPrecoVenda = parseFloat(value) || 0
      const custo = parseFloat(String(item.preco_custo_unitario)) || 0
      let novaMargemId: number | null = null
      
      if (custo > 0 && novoPrecoVenda > 0) {
        novaMargemId = ((novoPrecoVenda - custo) / custo) * 100
      }
      
      newItens[index] = {
        ...item,
        preco_venda_unitario: novoPrecoVenda,
        margem_lucro: novaMargemId
      }
    } else if (field === 'margem_lucro') {
      // Quando preencher margem, calcular preço de venda
      const novaMargemId = parseFloat(value) || 0
      const custo = parseFloat(String(item.preco_custo_unitario)) || 0
      let novoPrecoVenda: number | null = null
      
      if (custo > 0) {
        novoPrecoVenda = custo * (1 + novaMargemId / 100)
      }
      
      newItens[index] = {
        ...item,
        margem_lucro: novaMargemId,
        preco_venda_unitario: novoPrecoVenda
      }
    } else if (field === 'quantidade') {
      newItens[index] = { ...item, quantidade: parseInt(String(value)) || 0 }
    } else if (field === 'preco_custo_unitario') {
      // Quando alterar o custo unitário, recalcular margem se preço venda existe
      const novoCusto = parseFloat(String(value)) || 0
      const precoVenda = item.preco_venda_unitario || 0
      let novaMargemId: number | null = item.margem_lucro || null
      
      if (novoCusto > 0 && precoVenda > 0) {
        novaMargemId = ((precoVenda - novoCusto) / novoCusto) * 100
      }
      
      newItens[index] = { 
        ...item, 
        preco_custo_unitario: novoCusto,
        margem_lucro: novaMargemId
      }
    }

    setItens(newItens)
  }

  // Cálculos totais
  const totalItens = itens.reduce((sum: number, item: ItemCompra) => sum + (item.quantidade * item.preco_custo_unitario), 0)
  const totalFrete = parseFloat(valor_frete) || 0
  const totalGeral = totalItens + totalFrete

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validações
    if (itens.length === 0 || itens.some((i: ItemCompra) => i.produto_id === 0)) {
      alert('Selecione pelo menos um produto')
      return
    }

    if (itens.some((i: ItemCompra) => i.quantidade <= 0 || i.preco_custo_unitario <= 0)) {
      alert('Todos os itens devem ter quantidade e custo maior que zero')
      return
    }

    const formData = {
      numero_nota: numero_nota || null,
      fornecedor_id,
      valor_frete: totalFrete || 0,
      observacoes: observacoes || null,
      itens: itens.map((item: ItemCompra) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_custo_unitario: item.preco_custo_unitario,
        preco_venda_unitario: item.preco_venda_unitario,
        margem_lucro: item.margem_lucro
      }))
    }

    createCompraMutation.mutate(formData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-50 border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Adicionar Compra</h2>
            <p className="text-gray-600 text-sm mt-1">Fornecedor: <strong>{fornecedor_nome}</strong></p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Seção de informações da compra */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número da Nota *
              </label>
              <input
                type="text"
                value={numero_nota}
                onChange={(e) => setNumeroNota(e.target.value)}
                placeholder="Ex: NF-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor do Frete
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valor_frete}
                onChange={(e) => setValorFrete(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-md flex flex-col justify-end">
              <p className="text-sm text-gray-600 mb-1">Total com Frete</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {totalGeral.toFixed(2)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Informações adicionais sobre a compra..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Seção de itens */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Itens da Compra</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
              >
                <Plus className="h-4 w-4" />
                Adicionar Item
              </button>
            </div>

            <div className="space-y-4">
              {itens.map((item, idx) => {
                const subtotal = item.quantidade * item.preco_custo_unitario
                return (
                  <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-white hover:bg-gray-50 transition">
                    {/* Primeira linha: Produto e Quantidade */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Produto</label>
                        <select
                          value={item.produto_id}
                          onChange={(e) => handleItemChange(idx, 'produto_id', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={0}>Selecione um produto</option>
                          {produtos.map((p: Produto) => (
                            <option key={p.id} value={p.id}>
                              {p.codigo ? `${p.codigo} - ${p.nome}` : p.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantidade}
                          onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Segunda linha: Custo, Preço Venda, Margem, Subtotal e Ações */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Custo Unit.</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_custo_unitario}
                          onChange={(e) => handleItemChange(idx, 'preco_custo_unitario', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Preço Venda</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_venda_unitario || ''}
                          onChange={(e) => handleItemChange(idx, 'preco_venda_unitario', e.target.value)}
                          placeholder="Auto"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Margem %</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.margem_lucro || ''}
                          onChange={(e) => handleItemChange(idx, 'margem_lucro', e.target.value)}
                          placeholder="Auto"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Subtotal</label>
                        <div className="w-full px-3 py-2 border border-gray-300 rounded bg-blue-50 text-right font-semibold text-blue-600">
                          R$ {subtotal.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-end justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between text-sm mb-2">
                <span>Total dos Itens:</span>
                <span className="font-semibold">R$ {totalItens.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span>Frete:</span>
                <span className="font-semibold">R$ {totalFrete.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-2 font-bold text-blue-600">
                <span>Total Geral:</span>
                <span>R$ {totalGeral.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createCompraMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {createCompraMutation.isPending ? 'Salvando...' : 'Confirmar Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ModalCompraFornecedor
