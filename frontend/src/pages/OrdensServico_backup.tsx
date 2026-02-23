import React, { useState } from 'react'
import { apiFetch } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  FileText,
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  User,
  Car,
  Calendar,
  Eye,
  Download,
  PlayCircle,
  XCircle,
  Settings,
  Package
} from 'lucide-react'
import { format } from 'date-fns'
import ConfirmModal from '../components/ConfirmModal'

interface OrdemServico {
  id: number
  numero: string
  cliente_id: number
  cliente_nome: string
  cliente_telefone?: string
  veiculo_id: number
  veiculo_placa: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: number
  descricao_problema: string
  observacoes?: string
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'AGUARDANDO_PECA' | 'AGUARDANDO_APROVACAO' | 'CONCLUIDA' | 'CANCELADA'
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'
  data_abertura: string
  data_prevista?: string
  data_conclusao?: string
  km_veiculo: number
  valor_mao_obra: number
  valor_pecas: number
  valor_total: number
  desconto: number
  funcionario_responsavel?: string
  tempo_estimado_horas?: number
  tempo_gasto_horas?: number
  aprovado_cliente: boolean
  created_at: string
  updated_at: string
}

interface ItemOrdemServico {
  id: number
  ordem_id: number
  item_estoque_id?: number
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  tipo: 'SERVICO' | 'PECA'
  observacoes?: string
}

interface OrdemServicoFormData {
  cliente_id: number
  veiculo_id: number
  descricao_problema: string
  observacoes?: string
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'
  data_prevista?: string
  km_veiculo: number
  funcionario_responsavel?: string
  tempo_estimado_horas?: number
}

interface StatusUpdate {
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'AGUARDANDO_PECA' | 'AGUARDANDO_APROVACAO' | 'CONCLUIDA' | 'CANCELADA'
  observacoes?: string
}

// Hook para buscar ordens de serviço
function useOrdensServico() {
  return useQuery({
    queryKey: ['ordens-servico'],
    queryFn: async (): Promise<OrdemServico[]> => {
      // Backend registra este router em /api/ordens
      return await apiFetch('/ordens') as OrdemServico[]
    },
    placeholderData: [
      {
        id: 1,
        numero: 'OS-2024-001',
        cliente_id: 1,
        cliente_nome: 'João Silva',
        cliente_telefone: '(11) 99999-9999',
        veiculo_id: 1,
        veiculo_placa: 'ABC-1234',
        veiculo_marca: 'Honda',
        veiculo_modelo: 'Civic',
        veiculo_ano: 2020,
        descricao_problema: 'Troca de óleo e filtro + revisão dos 45.000km',
        observacoes: 'Cliente solicitou usar óleo sintético',
        status: 'EM_ANDAMENTO' as const,
        prioridade: 'MEDIA' as const,
        data_abertura: '2024-01-15T09:00:00Z',
        data_prevista: '2024-01-15T17:00:00Z',
        data_conclusao: undefined,
        km_veiculo: 45000,
        valor_mao_obra: 150.00,
        valor_pecas: 280.00,
        valor_total: 430.00,
        desconto: 0.00,
        funcionario_responsavel: 'Carlos Mecânico',
        tempo_estimado_horas: 3,
        tempo_gasto_horas: 2,
        aprovado_cliente: true,
        created_at: '2024-01-15T09:00:00Z',
        updated_at: '2024-01-15T14:30:00Z'
      },
      {
        id: 2,
        numero: 'OS-2024-002',
        cliente_id: 2,
        cliente_nome: 'Maria Santos',
        cliente_telefone: '(11) 88888-8888',
        veiculo_id: 2,
        veiculo_placa: 'XYZ-5678',
        veiculo_marca: 'Toyota',
        veiculo_modelo: 'Corolla',
        veiculo_ano: 2019,
        descricao_problema: 'Pastilha de freio rangendo, possível troca necessária',
        observacoes: '',
        status: 'AGUARDANDO_APROVACAO' as const,
        prioridade: 'ALTA' as const,
        data_abertura: '2024-01-16T10:30:00Z',
        data_prevista: '2024-01-17T16:00:00Z',
        data_conclusao: undefined,
        km_veiculo: 62000,
        valor_mao_obra: 120.00,
        valor_pecas: 350.00,
        valor_total: 470.00,
        desconto: 0.00,
        funcionario_responsavel: 'José Técnico',
        tempo_estimado_horas: 2.5,
        tempo_gasto_horas: 0,
        aprovado_cliente: false,
        created_at: '2024-01-16T10:30:00Z',
        updated_at: '2024-01-16T15:45:00Z'
      },
      {
        id: 3,
        numero: 'OS-2024-003',
        cliente_id: 3,
        cliente_nome: 'Carlos Lima',
        cliente_telefone: '(11) 77777-7777',
        veiculo_id: 3,
        veiculo_placa: 'DEF-9012',
        veiculo_marca: 'Volkswagen',
        veiculo_modelo: 'Gol',
        veiculo_ano: 2018,
        descricao_problema: 'Motor falhando, possível problema no sistema de ignição',
        observacoes: 'Urgente - cliente precisa do carro amanhã',
        status: 'AGUARDANDO_PECA' as const,
        prioridade: 'URGENTE' as const,
        data_abertura: '2024-01-14T14:00:00Z',
        data_prevista: '2024-01-16T12:00:00Z',
        data_conclusao: undefined,
        km_veiculo: 85000,
        valor_mao_obra: 200.00,
        valor_pecas: 450.00,
        valor_total: 650.00,
        desconto: 50.00,
        funcionario_responsavel: 'Pedro Eletricista',
        tempo_estimado_horas: 4,
        tempo_gasto_horas: 1.5,
        aprovado_cliente: true,
        created_at: '2024-01-14T14:00:00Z',
        updated_at: '2024-01-16T09:20:00Z'
      }
    ]
  })
}

// Hook para buscar clientes (para dropdown)
function useClientes() {
  return useQuery({
    queryKey: ['clientes-dropdown'],
    queryFn: async () => await apiFetch('/clientes'),
    placeholderData: [
      { id: 1, nome: 'João Silva', telefone: '(11) 99999-9999' },
      { id: 2, nome: 'Maria Santos', telefone: '(11) 88888-8888' },
      { id: 3, nome: 'Carlos Lima', telefone: '(11) 77777-7777' },
      { id: 4, nome: 'Ana Costa', telefone: '(11) 66666-6666' }
    ]
  })
}

// Hook para buscar veículos de um cliente
function useVeiculosCliente(clienteId: number) {
  return useQuery({
    queryKey: ['veiculos-cliente', clienteId],
    queryFn: async () => await apiFetch(`/clientes/${clienteId}/veiculos`),
    enabled: !!clienteId,
    placeholderData: [
      { id: 1, placa: 'ABC-1234', marca: 'Honda', modelo: 'Civic', ano: 2020 },
      { id: 2, placa: 'XYZ-5678', marca: 'Toyota', modelo: 'Corolla', ano: 2019 }
    ]
  })
}

// Hook para buscar itens de uma ordem de serviço
function useItensOrdemServico(ordemId: number) {
  return useQuery({
    queryKey: ['itens-ordem-servico', ordemId],
    // Backend exposes ordem itens under /api/ordens/{ordem_id}/itens
    queryFn: async (): Promise<ItemOrdemServico[]> => {
      return await apiFetch(`/ordens/${ordemId}/itens`) as ItemOrdemServico[]
    },
    enabled: !!ordemId,
    placeholderData: [
      {
        id: 1,
        ordem_id: ordemId,
        item_estoque_id: 1,
        descricao: 'Óleo Motor 5W30 Sintético - 4L',
        quantidade: 4,
        valor_unitario: 39.90,
        valor_total: 159.60,
        tipo: 'PECA' as const,
        observacoes: ''
      },
      {
        id: 2,
        ordem_id: ordemId,
        descricao: 'Filtro de óleo',
        quantidade: 1,
        valor_unitario: 29.90,
        valor_total: 29.90,
        tipo: 'PECA' as const,
        observacoes: ''
      },
      {
        id: 3,
        ordem_id: ordemId,
        descricao: 'Mão de obra - Troca de óleo e filtro',
        quantidade: 1,
        valor_unitario: 150.00,
        valor_total: 150.00,
        tipo: 'SERVICO' as const,
        observacoes: ''
      }
    ]
  })
}

// Modal de formulário para ordem de serviço
function OrdemServicoModal({ 
  isOpen, 
  onClose, 
  ordem, 
  onSubmit 
}: {
  isOpen: boolean
  onClose: () => void
  ordem?: OrdemServico
  onSubmit: (data: OrdemServicoFormData) => void
}) {
  const { data: clientes = [] } = useClientes()
  
  const [formData, setFormData] = useState<OrdemServicoFormData>({
    cliente_id: ordem?.cliente_id || 0,
    veiculo_id: ordem?.veiculo_id || 0,
    descricao_problema: ordem?.descricao_problema || '',
    observacoes: ordem?.observacoes || '',
    prioridade: ordem?.prioridade || 'MEDIA',
    data_prevista: ordem?.data_prevista ? ordem.data_prevista.split('T')[0] : '',
    km_veiculo: ordem?.km_veiculo || 0,
    funcionario_responsavel: ordem?.funcionario_responsavel || '',
    tempo_estimado_horas: ordem?.tempo_estimado_horas || undefined
  })

  // Garantir que o formulário seja preenchido/limpo quando o modal abrir ou quando a ordem mudar
  React.useEffect(() => {
    if (!isOpen) return
    if (ordem) {
      setFormData({
        cliente_id: ordem.cliente_id || 0,
        veiculo_id: ordem.veiculo_id || 0,
        descricao_problema: ordem.descricao_problema || '',
        observacoes: ordem.observacoes || '',
        prioridade: ordem.prioridade || 'MEDIA',
        data_prevista: ordem.data_prevista ? String(ordem.data_prevista).split('T')[0] : '',
        km_veiculo: ordem.km_veiculo || 0,
        funcionario_responsavel: ordem.funcionario_responsavel || '',
        tempo_estimado_horas: ordem.tempo_estimado_horas || undefined
      })
    } else {
      // Nova ordem: limpar todos os campos
      setFormData({
        cliente_id: 0,
        veiculo_id: 0,
        descricao_problema: '',
        observacoes: '',
        prioridade: 'MEDIA',
        data_prevista: '',
        km_veiculo: 0,
        funcionario_responsavel: '',
        tempo_estimado_horas: undefined
      })
    }
  }, [ordem, isOpen])

  const { data: veiculos = [] } = useVeiculosCliente(formData.cliente_id)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Sanitizar antes de enviar: não enviar string vazia para campos datetime
    const payload: any = { ...formData }
    if (payload.data_prevista === '') delete payload.data_prevista
    // tempo_estimado_horas pode ser undefined — garantir tipo correto
    if (payload.tempo_estimado_horas === '') payload.tempo_estimado_horas = undefined

    onSubmit(payload)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {ordem ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cliente e Veículo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <select
                value={formData.cliente_id}
                onChange={(e) => setFormData({...formData, cliente_id: parseInt(e.target.value), veiculo_id: 0})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value={0}>Selecione um cliente</option>
                {clientes.map((cliente: any) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome} {cliente.telefone && `- ${cliente.telefone}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veículo *</label>
              <select
                value={formData.veiculo_id}
                onChange={(e) => setFormData({...formData, veiculo_id: parseInt(e.target.value)})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!formData.cliente_id}
              >
                <option value={0}>Selecione um veículo</option>
                {veiculos.map((veiculo: any) => (
                  <option key={veiculo.id} value={veiculo.id}>
                    {veiculo.placa} - {veiculo.marca} {veiculo.modelo} ({veiculo.ano})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição do problema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Problema *</label>
            <textarea
              value={formData.descricao_problema}
              onChange={(e) => setFormData({...formData, descricao_problema: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              required
              placeholder="Descreva o problema relatado pelo cliente..."
            />
          </div>

          {/* Prioridade e Data Prevista */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade *</label>
              <select
                value={formData.prioridade}
                onChange={(e) => setFormData({...formData, prioridade: e.target.value as any})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Prevista</label>
              <input
                type="date"
                value={formData.data_prevista}
                onChange={(e) => setFormData({...formData, data_prevista: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* KM e Responsável */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KM do Veículo *</label>
              <input
                type="number"
                value={formData.km_veiculo}
                onChange={(e) => setFormData({...formData, km_veiculo: parseInt(e.target.value) || 0})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                min={0}
                placeholder="45000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário Responsável</label>
              <input
                type="text"
                value={formData.funcionario_responsavel || ''}
                onChange={(e) => setFormData({...formData, funcionario_responsavel: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Carlos Mecânico"
              />
            </div>
          </div>

          {/* Tempo Estimado e Observações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempo Estimado (horas)</label>
              <input
                type="number"
                step="0.5"
                value={formData.tempo_estimado_horas || ''}
                onChange={(e) => setFormData({...formData, tempo_estimado_horas: parseFloat(e.target.value) || undefined})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={0}
                placeholder="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={formData.observacoes || ''}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Observações adicionais..."
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
              {ordem ? 'Atualizar OS' : 'Criar OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal de detalhes da ordem de serviço
function DetalhesOrdemModal({ 
  isOpen, 
  onClose, 
  ordem 
}: {
  isOpen: boolean
  onClose: () => void
  ordem?: OrdemServico
}) {
  const { data: itens = [], isLoading } = useItensOrdemServico(ordem?.id || 0)

  if (!isOpen || !ordem) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-5xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Detalhes da OS - {ordem.numero}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {ordem.cliente_nome} • {ordem.veiculo_marca} {ordem.veiculo_modelo} - {ordem.veiculo_placa}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações da OS */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Informações Gerais</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ordem.status)}`}>
                    {getStatusLabel(ordem.status)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Prioridade:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ordem.prioridade)}`}>
                    {getPriorityLabel(ordem.prioridade)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Abertura:</span>
                  <span className="ml-2">{format(new Date(ordem.data_abertura), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Previsão:</span>
                  <span className="ml-2">{ordem.data_prevista ? format(new Date(ordem.data_prevista), 'dd/MM/yyyy HH:mm') : '-'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">KM:</span>
                  <span className="ml-2">{ordem.km_veiculo != null ? ordem.km_veiculo.toLocaleString() : '-'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Responsável:</span>
                  <span className="ml-2">{ordem.funcionario_responsavel || '-'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Problema Relatado</h4>
              <p className="text-sm text-gray-700">{ordem.descricao_problema}</p>
              {ordem.observacoes && (
                <div className="mt-3">
                  <span className="font-medium text-gray-600">Observações:</span>
                  <p className="text-sm text-gray-700">{ordem.observacoes}</p>
                </div>
              )}
            </div>

            {/* Itens e Serviços */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Itens e Serviços</h4>
              {isLoading ? (
                <div className="flex items-center justify-center h-16">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {itens.map((item) => (
                    <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded border">
                      <div className="flex items-center space-x-3">
                        <div className={`p-1 rounded-full ${item.tipo === 'PECA' ? 'bg-blue-100' : 'bg-green-100'}`}>
                          {item.tipo === 'PECA' ? (
                            <Package className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Settings className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.descricao}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantidade}x R$ {(Number(item.valor_unitario) || 0).toFixed(2)}
                            {item.observacoes && ` • ${item.observacoes}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          R$ {(Number(item.valor_total) || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {itens.length === 0 && (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">
                        Nenhum item/serviço cadastrado
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resumo Financeiro */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Resumo Financeiro</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Mão de obra:</span>
                  <span className="font-medium">R$ {(Number(ordem.valor_mao_obra) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Peças:</span>
                  <span className="font-medium">R$ {(Number(ordem.valor_pecas) || 0).toFixed(2)}</span>
                </div>
                {ordem.desconto > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Desconto:</span>
                    <span className="font-medium">-R$ {(Number(ordem.desconto) || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="font-bold text-xl text-gray-900">
                      R$ {(Number(ordem.valor_total) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    ordem.aprovado_cliente 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {ordem.aprovado_cliente ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Aprovado pelo cliente
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-1" />
                        Aguardando aprovação
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Tempo de Execução */}
            {ordem.tempo_estimado_horas && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Tempo de Execução</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimado:</span>
                    <span className="font-medium">{ordem.tempo_estimado_horas}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gasto:</span>
                    <span className="font-medium">{ordem.tempo_gasto_horas || 0}h</span>
                  </div>
                  {ordem.tempo_estimado_horas && ordem.tempo_gasto_horas && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Eficiência:</span>
                      <span className={`font-medium ${
                        ordem.tempo_gasto_horas <= ordem.tempo_estimado_horas 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {((Number(ordem.tempo_estimado_horas || 0) / (Number(ordem.tempo_gasto_horas) || 1)) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

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

// Função auxiliar para cores de status
function getStatusColor(status: string) {
  switch (status) {
    case 'PENDENTE': return 'text-gray-600 bg-gray-100'
    case 'EM_ANDAMENTO': return 'text-blue-600 bg-blue-100'
    case 'AGUARDANDO_PECA': return 'text-orange-600 bg-orange-100'
    case 'AGUARDANDO_APROVACAO': return 'text-yellow-600 bg-yellow-100'
    case 'CONCLUIDA': return 'text-green-600 bg-green-100'
    case 'CANCELADA': return 'text-red-600 bg-red-100'
    default: return 'text-gray-600 bg-gray-100'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'PENDENTE': return 'Pendente'
    case 'EM_ANDAMENTO': return 'Em andamento'
    case 'AGUARDANDO_PECA': return 'Aguardando peça'
    case 'AGUARDANDO_APROVACAO': return 'Aguardando aprovação'
    case 'CONCLUIDA': return 'Concluída'
    case 'CANCELADA': return 'Cancelada'
    default: return 'N/A'
  }
}

function getPriorityColor(prioridade: string) {
  switch (prioridade) {
    case 'BAIXA': return 'text-green-600 bg-green-100'
    case 'MEDIA': return 'text-blue-600 bg-blue-100'
    case 'ALTA': return 'text-orange-600 bg-orange-100'
    case 'URGENTE': return 'text-red-600 bg-red-100'
    default: return 'text-gray-600 bg-gray-100'
  }
}

function getPriorityLabel(prioridade: string) {
  switch (prioridade) {
    case 'BAIXA': return 'Baixa'
    case 'MEDIA': return 'Média'
    case 'ALTA': return 'Alta'
    case 'URGENTE': return 'Urgente'
    default: return 'N/A'
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'PENDENTE': return <Clock className="h-4 w-4" />
    case 'EM_ANDAMENTO': return <PlayCircle className="h-4 w-4" />
    case 'AGUARDANDO_PECA': return <Package className="h-4 w-4" />
    case 'AGUARDANDO_APROVACAO': return <AlertTriangle className="h-4 w-4" />
    case 'CONCLUIDA': return <CheckCircle className="h-4 w-4" />
    case 'CANCELADA': return <XCircle className="h-4 w-4" />
    default: return <FileText className="h-4 w-4" />
  }
}

export default function OrdensServico() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetalhesOpen, setIsDetalhesOpen] = useState(false)
  const [editingOrdem, setEditingOrdem] = useState<OrdemServico | undefined>()
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemServico | undefined>()
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'PENDENTE' | 'EM_ANDAMENTO' | 'AGUARDANDO_PECA' | 'AGUARDANDO_APROVACAO' | 'CONCLUIDA' | 'CANCELADA'>('TODOS')
  const [filtroPrioridade, setFiltroPrioridade] = useState<'TODOS' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'>('TODOS')
  

  const queryClient = useQueryClient()
  const { data: ordens = [], isLoading, error } = useOrdensServico()

  // Ordenar ordens por número (alfabético) para consistência de exibição
  const orderedOrdens = ordens ? [...ordens].sort((a, b) => (a.numero || '').localeCompare(b.numero || '')) : []

  // Mutações CRUD
  const createMutation = useMutation({
    mutationFn: async (data: OrdemServicoFormData & any) => {
      // Normalizar itens (frontend usa 'PECA'/'SERVICO', backend espera 'produto'/'servico')
      const payload: any = { ...data }
      if (Array.isArray(payload.itens)) {
        payload.itens = payload.itens.map((it: any) => ({
          ...it,
          tipo: (String(it.tipo || '').toLowerCase() === 'peca' || String(it.tipo || '').toLowerCase() === 'peça') ? 'produto' : String(it.tipo || '').toLowerCase() === 'servico' ? 'servico' : String(it.tipo || '').toLowerCase(),
          // garantir números nos campos numéricos
          quantidade: Number(it.quantidade) || 0,
          preco_unitario: Number(it.preco_unitario) || 0
        }))
      }

      return await apiFetch('/ordens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }) as OrdemServico
    },
    onSuccess: (created: OrdemServico) => {
      queryClient.setQueryData<OrdemServico[] | undefined>(['ordens-servico'], (old) => {
        const list = old ? [...old, created] : [created]
        return list.sort((a, b) => (a.numero || '').localeCompare(b.numero || ''))
      })
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] })
    },
    onError: (err: any) => {
      console.error('Erro ao criar ordem de servi\u00e7o', err)
      // Mostrar detalhe detalhado se disponível (Pydantic retorna detalhes em err.json)
      const detail = err?.json?.detail || err?.body || err?.message || JSON.stringify(err)
      alert('Erro ao criar ordem de servi\u00e7o: ' + detail)
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: OrdemServicoFormData }) => {
      return await apiFetch(`/ordens/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as OrdemServico
    },
    onSuccess: (updated: OrdemServico) => {
      queryClient.setQueryData<OrdemServico[] | undefined>(['ordens-servico'], (old) => {
        if (!old) return [updated]
        const next = old.map(o => o.id === updated.id ? updated : o)
        return next.sort((a, b) => (a.numero || '').localeCompare(b.numero || ''))
      })
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] })
    },
    onError: (err: any) => {
      console.error('Erro ao atualizar ordem de serviço', err)
      // Mostrar detalhe do backend quando disponível
      const detail = err?.json?.detail || err?.body || err?.message || JSON.stringify(err)
      alert('Erro ao atualizar ordem de serviço: ' + detail)
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: StatusUpdate }) => {
      // Backend atualiza ordem via PUT /ordens/{id} — enviamos apenas o campo status
      return await apiFetch(`/ordens/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] })
    },
    onError: (err: any) => {
      console.error('Erro ao atualizar status', err)
      alert('Erro ao atualizar status: ' + (err?.message || err))
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiFetch(`/ordens/${id}`, { method: 'DELETE' })
    },
    onSuccess: (updated: any) => {
      console.log('Ordem deletada (resposta):', updated)
      queryClient.setQueryData<OrdemServico[] | undefined>(['ordens-servico'], (old) => {
        if (!old) return old
        return old.filter(o => o.id !== updated.id)
      })
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] })
    },
    onError: (err: any) => {
      console.error('Erro ao deletar ordem de serviço', err)
      alert('Erro ao deletar ordem de serviço: ' + (err?.message || err))
    }
  })

  // Delete confirm modal state (defined after deleteMutation so it's safe to call)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [idToDelete, setIdToDelete] = useState<number | null>(null)

  const confirmDeleteOrder = () => {
    if (idToDelete) deleteMutation.mutate(idToDelete)
    setIsDeleteConfirmOpen(false)
    setIdToDelete(null)
  }

  const handleSubmit = (data: OrdemServicoFormData) => {
    if (editingOrdem) {
      updateMutation.mutate({ id: editingOrdem.id, data })
    } else {
      console.log('Criando OS, payload:', data)
      createMutation.mutate(data)
    }
    setEditingOrdem(undefined)
  }

  const handleEdit = (ordem: OrdemServico) => {
    setEditingOrdem(ordem)
    setIsModalOpen(true)
  }

  const handleDelete = (id: number) => {
    setIdToDelete(id)
    setIsDeleteConfirmOpen(true)
  }

  const handleVerDetalhes = (ordem: OrdemServico) => {
    setSelectedOrdem(ordem)
    setIsDetalhesOpen(true)
  }

  const handleUpdateStatus = (id: number, newStatus: OrdemServico['status']) => {
    updateStatusMutation.mutate({ 
      id, 
      data: { status: newStatus }
    })
  }

  // Filtros
  const filteredOrdens = orderedOrdens.filter(ordem => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = 
      (ordem.numero || '').toLowerCase().includes(term) ||
      (ordem.cliente_nome || '').toLowerCase().includes(term) ||
      (ordem.veiculo_placa || '').toLowerCase().includes(term) ||
      (ordem.veiculo_marca || '').toLowerCase().includes(term) ||
      (ordem.veiculo_modelo || '').toLowerCase().includes(term) ||
      (ordem.descricao_problema || '').toLowerCase().includes(term)

    const matchesStatus = filtroStatus === 'TODOS' || ordem.status === filtroStatus
    const matchesPrioridade = filtroPrioridade === 'TODOS' || ordem.prioridade === filtroPrioridade

    return matchesSearch && matchesStatus && matchesPrioridade
  })

  // Estatísticas
  const stats = {
    total: orderedOrdens.length,
    pendentes: orderedOrdens.filter(o => o.status === 'PENDENTE').length,
    emAndamento: orderedOrdens.filter(o => o.status === 'EM_ANDAMENTO').length,
    aguardandoAprovacao: orderedOrdens.filter(o => o.status === 'AGUARDANDO_APROVACAO').length,
    valorTotal: orderedOrdens.filter(o => o.status === 'CONCLUIDA').reduce((acc, ordem) => acc + ordem.valor_total, 0)
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
        <p className="text-red-800">Erro ao carregar ordens de serviço</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ordens de Serviço</h1>
          <p className="text-gray-600 mt-1">
            {stats.total} ordem{stats.total !== 1 ? 's' : ''} cadastrada{stats.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingOrdem(undefined)
            setIsModalOpen(true)
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova OS
        </button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pendentes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendentes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <PlayCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Em Andamento</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.emAndamento}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Aprovação</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.aguardandoAprovacao}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Faturado</p>
              <p className="text-2xl font-semibold text-gray-900">
                R$ {stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
            placeholder="Buscar por número, cliente, veículo, problema..."
          />
        </div>
        
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as any)}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="TODOS">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="AGUARDANDO_PECA">Aguardando peça</option>
          <option value="AGUARDANDO_APROVACAO">Aguardando aprovação</option>
          <option value="CONCLUIDA">Concluída</option>
          <option value="CANCELADA">Cancelada</option>
        </select>

        <select
          value={filtroPrioridade}
          onChange={(e) => setFiltroPrioridade(e.target.value as any)}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="TODOS">Todas as prioridades</option>
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="URGENTE">Urgente</option>
        </select>
      </div>

      {/* Cards de Ordens */}
      <div className="grid grid-cols-1 gap-4">
        {filteredOrdens.map((ordem) => (
          <div key={ordem.id} className="bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 bg-blue-100 rounded-full">
                      {getStatusIcon(ordem.status)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {ordem.numero}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ordem.status)}`}>
                        <span className="ml-1">{getStatusLabel(ordem.status)}</span>
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ordem.prioridade)}`}>
                        <span className="ml-1">{getPriorityLabel(ordem.prioridade)}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-3">
                      <div className="flex items-center text-gray-600">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="truncate">{ordem.cliente_nome}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <Car className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{ordem.veiculo_marca} {ordem.veiculo_modelo} - {ordem.veiculo_placa}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{format(new Date(ordem.data_abertura), 'dd/MM/yyyy')}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="font-bold">R$ {(Number(ordem.valor_total) || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {ordem.descricao_problema}
                      </p>
                    </div>

                    {/* Informações adicionais */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        {ordem.funcionario_responsavel && (
                          <span>👷‍♂️ {ordem.funcionario_responsavel}</span>
                        )}
                        {ordem.data_prevista && (
                          <span>
                            🕒 Previsão: {format(new Date(ordem.data_prevista), 'dd/MM HH:mm')}
                          </span>
                        )}
                        {ordem.tempo_estimado_horas && (
                          <span>⏱️ {ordem.tempo_estimado_horas}h estimado</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {!ordem.aprovado_cliente && ordem.status === 'AGUARDANDO_APROVACAO' && (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                            ❗ Pendente aprovação
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center space-x-2 ml-4">
                  {/* Ações rápidas de status */}
                  {ordem.status === 'PENDENTE' && (
                    <button
                      onClick={() => handleUpdateStatus(ordem.id, 'EM_ANDAMENTO')}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                      title="Iniciar atendimento"
                    >
                      <PlayCircle className="h-4 w-4" />
                    </button>
                  )}
                  
                  {ordem.status === 'EM_ANDAMENTO' && (
                    <button
                      onClick={() => handleUpdateStatus(ordem.id, 'AGUARDANDO_APROVACAO')}
                      className="text-yellow-600 hover:text-yellow-900 p-1 rounded hover:bg-yellow-50"
                      title="Enviar para aprovação"
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </button>
                  )}

                  {ordem.status === 'AGUARDANDO_APROVACAO' && ordem.aprovado_cliente && (
                    <button
                      onClick={() => handleUpdateStatus(ordem.id, 'CONCLUIDA')}
                      className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                      title="Finalizar OS"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleVerDetalhes(ordem)}
                    className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50"
                    title="Ver detalhes"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => handleEdit(ordem)}
                    className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                    title="Editar OS"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  
                  <button
                    className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                    title="Exportar/Imprimir"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDelete(ordem.id)}
                    className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                    title="Excluir OS"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Estado vazio */}
      {filteredOrdens.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchTerm || filtroStatus !== 'TODOS' || filtroPrioridade !== 'TODOS' ? 'Nenhuma OS encontrada' : 'Nenhuma OS cadastrada'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filtroStatus !== 'TODOS' || filtroPrioridade !== 'TODOS'
              ? 'Tente ajustar os filtros de busca.' 
              : 'Comece criando uma nova ordem de serviço.'
            }
          </p>
          {!searchTerm && filtroStatus === 'TODOS' && filtroPrioridade === 'TODOS' && (
            <div className="mt-6">
              <button
                onClick={() => {
                  setEditingOrdem(undefined)
                  setIsModalOpen(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova OS
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <OrdemServicoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingOrdem(undefined)
        }}
        ordem={editingOrdem}
        onSubmit={handleSubmit}
      />

      <DetalhesOrdemModal
        isOpen={isDetalhesOpen}
        onClose={() => {
          setIsDetalhesOpen(false)
          setSelectedOrdem(undefined)
        }}
        ordem={selectedOrdem}
      />
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Confirmar exclusão"
        message="Deseja realmente excluir esta ordem de serviço? Esta ação marcá-la-á como inativa."
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmDeleteOrder}
        onCancel={() => { setIsDeleteConfirmOpen(false); setIdToDelete(null) }}
      />
    </div>
  )
}