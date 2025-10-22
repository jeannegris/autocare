import * as React from 'react'
import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { handlePlacaInput, formatPlaca } from '../utils/placaMask'
import ModalVerificacaoVeiculo from '../components/ModalVerificacaoVeiculo'
import Accordion from '../components/ui/Accordion'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Car,
  X,
  Calendar,
  MapPin,
  User,
  Wrench,
  Eye,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle
} from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { format, differenceInDays } from 'date-fns'

interface Veiculo {
  id: number
  placa: string
  marca: string
  modelo: string
  ano: number
  cor: string
  combustivel: 'GASOLINA' | 'ETANOL' | 'DIESEL' | 'FLEX' | 'GNV' | 'ELETRICO' | 'HIBRIDO'
  chassis?: string
  renavam?: string
  km_atual: number
  cliente_id: number
  cliente_nome: string
  cliente_telefone?: string
  observacoes?: string
  created_at: string
  updated_at: string
  // Estatísticas
  total_servicos?: number
  ultima_manutencao?: string
  proxima_manutencao?: string
  km_proxima_manutencao?: number
  status_manutencao?: 'EM_DIA' | 'PROXIMO_VENCIMENTO' | 'ATRASADO'
}

interface ManutencaoHistorico {
  id: number
  veiculo_id: number
  tipo: string
  descricao: string
  km_realizada: number
  data_realizada: string
  km_proxima?: number
  data_proxima?: string
  valor?: number
  observacoes?: string
}

interface VeiculoFormData {
  placa: string
  marca: string
  modelo: string
  ano: number
  cor: string
  combustivel: 'GASOLINA' | 'ETANOL' | 'DIESEL' | 'FLEX' | 'GNV' | 'ELETRICO' | 'HIBRIDO'
  chassis?: string
  renavam?: string
  km_atual: number
  cliente_id: number
  observacoes?: string
}

// Hook para buscar veículos
function useVeiculos() {
  return useQuery({
    queryKey: ['veiculos'],
    queryFn: async (): Promise<Veiculo[]> => {
      return await apiFetch('/veiculos') as Veiculo[]
    },
    // Dados mockados para desenvolvimento
    placeholderData: [
      {
        id: 1,
        placa: 'ABC-1234',
        marca: 'Honda',
        modelo: 'Civic',
        ano: 2020,
        cor: 'Prata',
        combustivel: 'FLEX' as const,
        chassis: '1HGBH41JXMN109186',
        renavam: '12345678901',
        km_atual: 45000,
        cliente_id: 1,
        cliente_nome: 'João Silva',
        cliente_telefone: '(11) 99999-9999',
        observacoes: 'Veículo em ótimo estado',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        total_servicos: 8,
        ultima_manutencao: '2024-08-15',
        proxima_manutencao: '2024-11-15',
        km_proxima_manutencao: 50000,
        status_manutencao: 'PROXIMO_VENCIMENTO' as const
      },
      {
        id: 2,
        placa: 'XYZ-5678',
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2019,
        cor: 'Branco',
        combustivel: 'FLEX' as const,
        chassis: '2T1BURHE0KC123456',
        renavam: '98765432101',
        km_atual: 62000,
        cliente_id: 2,
        cliente_nome: 'Maria Santos',
        cliente_telefone: '(11) 88888-8888',
        observacoes: '',
        created_at: '2024-01-16T14:30:00Z',
        updated_at: '2024-01-16T14:30:00Z',
        total_servicos: 12,
        ultima_manutencao: '2024-09-10',
        proxima_manutencao: '2024-12-10',
        km_proxima_manutencao: 65000,
        status_manutencao: 'EM_DIA' as const
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
      { id: 1, nome: 'João Silva' },
      { id: 2, nome: 'Maria Santos' },
      { id: 3, nome: 'Carlos Lima' },
      { id: 4, nome: 'Ana Costa' }
    ]
  })
}

// Hook para buscar histórico de manutenções
function useManutencaoHistorico(veiculoId: number) {
  return useQuery({
    queryKey: ['manutencao-historico', veiculoId],
    queryFn: async (): Promise<ManutencaoHistorico[]> => {
      return await apiFetch(`/veiculos/${veiculoId}/manutencoes`) as ManutencaoHistorico[]
    },
    enabled: !!veiculoId,
    placeholderData: [
      {
        id: 1,
        veiculo_id: veiculoId,
        tipo: 'Troca de óleo',
        descricao: 'Troca de óleo e filtro',
        km_realizada: 40000,
        data_realizada: '2024-08-15',
        km_proxima: 45000,
        data_proxima: '2024-11-15',
        valor: 180.00,
        observacoes: 'Usado óleo sintético'
      },
      {
        id: 2,
        veiculo_id: veiculoId,
        tipo: 'Revisão completa',
        descricao: 'Revisão dos 30.000km',
        km_realizada: 30000,
        data_realizada: '2024-02-10',
        km_proxima: 40000,
        valor: 450.00,
        observacoes: ''
      }
    ]
  })
}

// Hook para buscar sugestões de manutenção
function useSugestoesManutencao(veiculoId: number) {
  return useQuery({
    queryKey: ['sugestoes-manutencao', veiculoId],
    queryFn: async () => {
      return await apiFetch(`/veiculos/${veiculoId}/sugestoes-manutencao`)
    },
    enabled: !!veiculoId
  })
}

// Modal de formulário
function VeiculoModal({ 
  isOpen, 
  onClose, 
  veiculo, 
  onSubmit,
  dadosPreenchidos
}: {
  isOpen: boolean
  onClose: () => void
  veiculo?: Veiculo
  onSubmit: (data: VeiculoFormData) => void
  dadosPreenchidos?: { placa?: string; renavam?: string }
}) {
  const { data: clientes = [] } = useClientes()
  
  const [formData, setFormData] = useState<VeiculoFormData>({
    placa: '',
    marca: '',
    modelo: '',
    ano: new Date().getFullYear(),
    cor: '',
    combustivel: 'FLEX',
    chassis: '',
    renavam: '',
    km_atual: 0,
    cliente_id: 0,
    observacoes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Sincroniza formulário quando a prop veiculo muda (prefill ao editar)
  useEffect(() => {
    if (!isOpen) return
    if (veiculo) {
      setFormData({
        placa: veiculo.placa || '',
        marca: veiculo.marca || '',
        modelo: veiculo.modelo || '',
        ano: veiculo.ano || new Date().getFullYear(),
        cor: veiculo.cor || '',
        combustivel: veiculo.combustivel || 'FLEX',
        chassis: veiculo.chassis || '',
        renavam: veiculo.renavam || '',
        km_atual: veiculo.km_atual || 0,
        cliente_id: veiculo.cliente_id || 0,
        observacoes: veiculo.observacoes || ''
      })
    } else {
      setFormData({
        placa: dadosPreenchidos?.placa || '',
        marca: '', 
        modelo: '', 
        ano: new Date().getFullYear(),
        cor: '', 
        combustivel: 'FLEX', 
        chassis: '', 
        renavam: dadosPreenchidos?.renavam || '', 
        km_atual: 0, 
        cliente_id: 0, 
        observacoes: ''
      })
    }
    // Limpar erros quando o modal abre/fecha
    setErrors({})
    setTouched({})
  }, [veiculo, dadosPreenchidos, isOpen])

  const validateField = (name: string, value: any): string => {
    switch (name) {
      case 'cliente_id':
        if (!value || value === 0) return 'Selecione um cliente'
        break
      case 'placa':
        if (!value || value.trim() === '') return 'Placa é obrigatória'
        if (value.length < 7) return 'Placa inválida'
        break
      case 'marca':
        if (!value || value.trim() === '') return 'Marca é obrigatória'
        break
      case 'modelo':
        if (!value || value.trim() === '') return 'Modelo é obrigatório'
        break
      case 'ano':
        if (!value) return 'Ano é obrigatório'
        if (value < 1990 || value > new Date().getFullYear() + 1) return 'Ano inválido'
        break
      case 'cor':
        if (!value || value.trim() === '') return 'Cor é obrigatória'
        break
      case 'km_atual':
        if (value === undefined || value === null || value === '') return 'KM atual é obrigatório'
        if (value < 0) return 'KM não pode ser negativo'
        break
    }
    return ''
  }

  const handleBlur = (name: string) => {
    setTouched({ ...touched, [name]: true })
    const error = validateField(name, formData[name as keyof VeiculoFormData])
    setErrors({ ...errors, [name]: error })
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    const requiredFields: (keyof VeiculoFormData)[] = ['cliente_id', 'placa', 'marca', 'modelo', 'ano', 'cor', 'km_atual']
    
    requiredFields.forEach(field => {
      const error = validateField(field, formData[field])
      if (error) newErrors[field] = error
    })

    setErrors(newErrors)
    setTouched(Object.fromEntries(requiredFields.map(f => [f, true])))
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    onSubmit(formData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {veiculo ? 'Editar Veículo' : 'Novo Veículo'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <select
              value={formData.cliente_id}
              onChange={(e) => {
                const value = parseInt(e.target.value)
                setFormData({...formData, cliente_id: value})
                if (touched.cliente_id) {
                  setErrors({ ...errors, cliente_id: validateField('cliente_id', value) })
                }
              }}
              onBlur={() => handleBlur('cliente_id')}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                touched.cliente_id && errors.cliente_id
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            >
              <option value={0}>Selecione um cliente</option>
              {clientes.map((cliente: any) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            {touched.cliente_id && errors.cliente_id && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                {errors.cliente_id}
              </p>
            )}
          </div>

          {/* Dados do Veículo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placa *</label>
              <input
                type="text"
                value={formData.placa}
                onChange={(e) => {
                  handlePlacaInput(e.target.value, (formatted) => {
                    setFormData({...formData, placa: formatted})
                    if (touched.placa) {
                      setErrors({ ...errors, placa: validateField('placa', formatted) })
                    }
                  })
                }}
                onBlur={() => handleBlur('placa')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  touched.placa && errors.placa
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="ABC-1234"
                maxLength={8}
              />
              {touched.placa && errors.placa && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {errors.placa}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
              <input
                type="text"
                value={formData.marca}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({...formData, marca: value})
                  if (touched.marca) {
                    setErrors({ ...errors, marca: validateField('marca', value) })
                  }
                }}
                onBlur={() => handleBlur('marca')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  touched.marca && errors.marca
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Honda"
              />
              {touched.marca && errors.marca && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {errors.marca}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
              <input
                type="text"
                value={formData.modelo}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({...formData, modelo: value})
                  if (touched.modelo) {
                    setErrors({ ...errors, modelo: validateField('modelo', value) })
                  }
                }}
                onBlur={() => handleBlur('modelo')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  touched.modelo && errors.modelo
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Civic"
              />
              {touched.modelo && errors.modelo && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {errors.modelo}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
              <input
                type="number"
                value={formData.ano}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  setFormData({...formData, ano: value})
                  if (touched.ano) {
                    setErrors({ ...errors, ano: validateField('ano', value) })
                  }
                }}
                onBlur={() => handleBlur('ano')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  touched.ano && errors.ano
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                min={1990}
                max={new Date().getFullYear() + 1}
              />
              {touched.ano && errors.ano && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {errors.ano}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cor *</label>
              <input
                type="text"
                value={formData.cor}
                onChange={(e) => {
                  const value = e.target.value
                  setFormData({...formData, cor: value})
                  if (touched.cor) {
                    setErrors({ ...errors, cor: validateField('cor', value) })
                  }
                }}
                onBlur={() => handleBlur('cor')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  touched.cor && errors.cor
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Prata"
              />
              {touched.cor && errors.cor && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {errors.cor}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Combustível *</label>
              <select
                value={formData.combustivel}
                onChange={(e) => setFormData({...formData, combustivel: e.target.value as any})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="GASOLINA">Gasolina</option>
                <option value="ETANOL">Etanol</option>
                <option value="DIESEL">Diesel</option>
                <option value="FLEX">Flex</option>
                <option value="GNV">GNV</option>
                <option value="ELETRICO">Elétrico</option>
                <option value="HIBRIDO">Híbrido</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KM Atual *</label>
              <input
                type="number"
                value={formData.km_atual}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0
                  setFormData({...formData, km_atual: value})
                  if (touched.km_atual) {
                    setErrors({ ...errors, km_atual: validateField('km_atual', value) })
                  }
                }}
                onBlur={() => handleBlur('km_atual')}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  touched.km_atual && errors.km_atual
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                min={0}
                placeholder="45000"
              />
              {touched.km_atual && errors.km_atual && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {errors.km_atual}
                </p>
              )}
            </div>
          </div>

          {/* Dados Opcionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chassis</label>
              <input
                type="text"
                value={formData.chassis || ''}
                onChange={(e) => setFormData({...formData, chassis: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1HGBH41JXMN109186"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RENAVAM</label>
              <input
                type="text"
                value={formData.renavam || ''}
                onChange={(e) => setFormData({...formData, renavam: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="12345678901"
                maxLength={11}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={formData.observacoes || ''}
              onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Informações adicionais sobre o veículo..."
            />
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
              {veiculo ? 'Atualizar Veículo' : 'Cadastrar Veículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal de histórico de manutenções
function HistoricoModal({ 
  isOpen, 
  onClose, 
  veiculo 
}: {
  isOpen: boolean
  onClose: () => void
  veiculo?: Veiculo
}) {
  const { data: historico = [], isLoading } = useManutencaoHistorico(veiculo?.id || 0)
  const { data: sugestoes, isLoading: isLoadingSugestoes } = useSugestoesManutencao(veiculo?.id || 0)

  if (!isOpen || !veiculo) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Histórico de Manutenções
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {veiculo.marca} {veiculo.modelo} - {veiculo.placa}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Sugestões de manutenção com Accordion */}
        {!isLoadingSugestoes && sugestoes && sugestoes.sugestoes && sugestoes.sugestoes.length > 0 && (
          <div className="mb-6">
            <Accordion
              title={
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>🔔 Manutenções Sugeridas</span>
                </div>
              }
              badge={sugestoes.total_sugestoes}
              variant="warning"
              defaultOpen={false}
            >
              <div className="space-y-3">
                <p className="text-xs text-gray-700 mb-3">
                  KM atual do veículo: <strong>{sugestoes.km_atual?.toLocaleString()} km</strong>
                </p>
                
                {sugestoes.sugestoes.map((sugestao: any, index: number) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg ${
                      sugestao.proxima_prevista.urgencia === 'urgente' 
                        ? 'bg-red-50 border border-red-200' 
                        : 'bg-blue-50 border border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          sugestao.proxima_prevista.urgencia === 'urgente' 
                            ? 'text-red-800' 
                            : 'text-blue-800'
                        }`}>
                          {sugestao.proxima_prevista.urgencia === 'urgente' ? '⚠️' : '🔔'} {sugestao.tipo}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Última realização: {sugestao.ultima_realizacao.km.toLocaleString()} km
                        </p>
                        <p className="text-xs text-gray-600">
                          Prevista para: {sugestao.proxima_prevista.km.toLocaleString()} km
                        </p>
                      </div>
                      <div className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ml-2 ${
                        sugestao.proxima_prevista.urgencia === 'urgente'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {sugestao.proxima_prevista.km_restantes <= 0 
                          ? `${Math.abs(sugestao.proxima_prevista.km_restantes).toLocaleString()} km atrasada` 
                          : `Faltam ${sugestao.proxima_prevista.km_restantes.toLocaleString()} km`
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Accordion>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {historico.map((item) => (
              <div key={item.id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{item.tipo}</h4>
                    <p className="text-sm text-gray-600">{item.descricao}</p>
                  </div>
                  {item.valor != null && (
                    <span className="text-lg font-bold text-green-600">
                      R$ {(Number(item.valor) || 0).toFixed(2)}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Data:</span> {format(new Date(item.data_realizada), 'dd/MM/yyyy')}
                  </div>
                  <div>
                    <span className="font-medium">KM:</span> {item.km_realizada.toLocaleString()}
                  </div>
                  {item.km_proxima && (
                    <div>
                      <span className="font-medium">Próxima em:</span> {item.km_proxima.toLocaleString()} km
                    </div>
                  )}
                  {item.data_proxima && (
                    <div>
                      <span className="font-medium">Próxima data:</span> {format(new Date(item.data_proxima), 'dd/MM/yyyy')}
                    </div>
                  )}
                </div>
                
                {item.observacoes && (
                  <div className="mt-2">
                    <span className="font-medium text-sm text-gray-600">Observações:</span>
                    <p className="text-sm text-gray-600">{item.observacoes}</p>
                  </div>
                )}
              </div>
            ))}
            
            {historico.length === 0 && (
              <div className="text-center py-8">
                <Wrench className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nenhuma manutenção registrada
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Ainda não há histórico de manutenções para este veículo.
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

// Modal exibido quando há conflito (placa/chassis já existe)
function ConflictModal({
  isOpen,
  onClose,
  existingId,
  existingAtivo,
  onView,
  onReativar
}: {
  isOpen: boolean,
  onClose: () => void,
  existingId?: number | null,
  existingAtivo?: boolean | null,
  onView: (id: number) => void,
  onReativar: (id: number) => void
}) {
  if (!isOpen || !existingId) return null
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border max-w-lg shadow-lg rounded-md bg-white">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Conflito de cadastro</h3>
          <p className="text-sm text-gray-600">Já existe um veículo cadastrado com esta informação.</p>
        </div>
        <div className="space-x-3 flex justify-end">
          <button onClick={() => onView(existingId)} className="px-4 py-2 bg-white border rounded">Ver</button>
          {!existingAtivo && (
            <button onClick={() => onReativar(existingId)} className="px-4 py-2 bg-green-600 text-white rounded">Reativar</button>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Fechar</button>
        </div>
      </div>
    </div>
  )
}

export default function Veiculos() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHistoricoOpen, setIsHistoricoOpen] = useState(false)
  const [isVerificacaoModalOpen, setIsVerificacaoModalOpen] = useState(false)
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | undefined>()
  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | undefined>()
  const [veiculoPreenchido, setVeiculoPreenchido] = useState<any>(null)
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'EM_DIA' | 'PROXIMO_VENCIMENTO' | 'ATRASADO'>('TODOS')

  const queryClient = useQueryClient()
  const { data: veiculos = [], isLoading, error } = useVeiculos()
  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictExistingId, setConflictExistingId] = useState<number | null>(null)
  const [conflictExistingAtivo, setConflictExistingAtivo] = useState<boolean | null>(null)

  // Abrir visualização do veículo existente
  const handleViewExisting = async (id: number) => {
    try {
      const v = await apiFetch(`/veiculos/${id}`) as Veiculo
      setEditingVeiculo(v)
      setIsModalOpen(true)
      setConflictOpen(false)
    } catch (e: any) {
      alert('Erro ao buscar veículo existente: ' + (e?.message || JSON.stringify(e)))
    }
  }

  // Reativar veículo inativo
  const handleReativarExisting = async (id: number) => {
    try {
      await apiFetch(`/veiculos/${id}/reativar`, { method: 'POST' })
      queryClient.invalidateQueries({ queryKey: ['veiculos'] })
      alert('Veículo reativado com sucesso')
      setConflictOpen(false)
    } catch (e: any) {
      alert('Erro ao reativar veículo: ' + (e?.message || JSON.stringify(e?.json || e?.body || e)))
    }
  }

  // Mutações CRUD
  const createMutation = useMutation({
    mutationFn: async (data: VeiculoFormData) => {
      return await apiFetch('/veiculos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Veiculo
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] })
      setIsModalOpen(false)
      setEditingVeiculo(undefined)
    },
    onError: (err: any) => {
      console.error('Erro ao criar veículo', err)
      alert('Erro ao criar veículo: ' + (err?.message || err))
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: VeiculoFormData }) => {
      return await apiFetch(`/veiculos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Veiculo
    },
    // Suporte a atualização otimista com rollback
    onMutate: async ({ id, data }: { id: number; data: VeiculoFormData }) => {
      await queryClient.cancelQueries({ queryKey: ['veiculos'] })
      const previous = queryClient.getQueryData(['veiculos'])
      // aplicar mudança otimista
      queryClient.setQueryData(['veiculos'], (old: any) => {
        if (!old) return old
        return old.map((v: Veiculo) => v.id === id ? { ...v, ...data, updated_at: new Date().toISOString() } : v)
      })
      return { previous }
    },
    onError: (err: any, _variables: any, context: any) => {
      console.error('Erro ao atualizar veículo', err)
      // rollback se disponível
      if (context?.previous) {
        queryClient.setQueryData(['veiculos'], context.previous)
      }
      // Se backend respondeu com detalhe de conflito (409), abrir modal de conflito
      const status = err?.status || (err?.json && err.json.status) || null
      const detail = err?.json?.detail || err?.body || null
      if (status === 409 && detail && typeof detail === 'object' && detail.existing_id) {
        setConflictExistingId(detail.existing_id)
        setConflictExistingAtivo(detail.ativo ?? null)
        setConflictOpen(true)
        return
      }
      const msg = detail?.message || err?.message || JSON.stringify(err?.json || err?.body || err)
      alert('Erro ao atualizar veículo: ' + msg)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] })
    },
    onSuccess: (updated: Veiculo) => {
      // garante que cache tenha o valor retornado pelo servidor
      queryClient.setQueryData(['veiculos'], (old: any) => {
        if (!old) return [updated]
        return old.map((v: Veiculo) => v.id === updated.id ? updated : v)
      })
      setIsModalOpen(false)
      setEditingVeiculo(undefined)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/veiculos/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] })
    },
    onError: (err: any) => {
      console.error('Erro ao deletar veículo', err)
      alert('Erro ao deletar veículo: ' + (err?.message || err))
    }
  })

  const handleSubmit = (data: VeiculoFormData) => {
    if (editingVeiculo) {
      // Atualização otimista: atualiza cache local com os valores do formulário
      try {
        const optimistic: Veiculo = { ...editingVeiculo, ...data, updated_at: new Date().toISOString() }
        queryClient.setQueryData(['veiculos'], (old: any) => {
          if (!old) return [optimistic]
          return old.map((v: Veiculo) => v.id === optimistic.id ? optimistic : v)
        })
      } catch (e) {
        // ignore
      }
      updateMutation.mutate({ id: editingVeiculo.id, data })
    } else {
      createMutation.mutate(data)
    }
    // Modal será fechado no onSuccess das mutations
  }

  const handleEdit = async (veiculo: Veiculo) => {
    // Preferir buscar a versão mais recente no servidor para garantir que o modal seja preenchido
    try {
      const fresh = await apiFetch(`/veiculos/${veiculo.id}`) as Veiculo
      setEditingVeiculo(fresh)
    } catch (e) {
      // Se o fetch falhar, tentar usar a versão do cache ou o objeto passado
      try {
        const cached: Veiculo[] | undefined = queryClient.getQueryData(['veiculos'])
        const freshCache = cached ? cached.find(v => v.id === veiculo.id) : undefined
        setEditingVeiculo(freshCache || veiculo)
      } catch (e2) {
        setEditingVeiculo(veiculo)
      }
    }
    setIsModalOpen(true)
  }

  // Funções para o modal de verificação de veículo
  const handleVeiculoEncontrado = (veiculo: any) => {
    // Exibir o veículo encontrado permitindo visualização/edição
    setEditingVeiculo(veiculo)
    setIsVerificacaoModalOpen(false)
    setIsModalOpen(true)
  }

  const handleCriarNovoVeiculo = (placa: string, renavam?: string) => {
    // Criar novo veículo com dados pré-preenchidos
    setVeiculoPreenchido({
      placa: placa,
      renavam: renavam || ''
    })
    setEditingVeiculo(undefined)
    setIsVerificacaoModalOpen(false)
    setIsModalOpen(true)
  }

  const handleReativarVeiculo = async (veiculo: any) => {
    try {
      await apiFetch(`/veiculos/${veiculo.id}/reativar`, {
        method: 'PATCH'
      })
      queryClient.invalidateQueries({ queryKey: ['veiculos'] })
      setIsVerificacaoModalOpen(false)
      alert('Veículo reativado com sucesso!')
    } catch (error) {
      console.error('Erro ao reativar veículo:', error)
      alert('Erro ao reativar veículo')
    }
  }

  // Confirm modal for deletion
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [idToDelete, setIdToDelete] = useState<number | null>(null)

  const handleDelete = (id: number) => {
    setIdToDelete(id)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDelete = () => {
    if (idToDelete) deleteMutation.mutate(idToDelete)
    setIsDeleteConfirmOpen(false)
    setIdToDelete(null)
  }

  const handleVerHistorico = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo)
    setIsHistoricoOpen(true)
  }

  // Filtros
  const marcasUnicas = [...new Set(veiculos.map(v => v.marca))].sort()
  
  const filteredVeiculos = veiculos.filter(veiculo => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = 
      (veiculo.placa || '').toLowerCase().includes(term) ||
      (veiculo.marca || '').toLowerCase().includes(term) ||
      (veiculo.modelo || '').toLowerCase().includes(term) ||
      (veiculo.cliente_nome || '').toLowerCase().includes(term)

    const matchesMarca = filtroMarca === '' || veiculo.marca === filtroMarca
    const matchesStatus = filtroStatus === 'TODOS' || veiculo.status_manutencao === filtroStatus

    return matchesSearch && matchesMarca && matchesStatus
  })

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'EM_DIA': return 'text-green-600 bg-green-100'
      case 'PROXIMO_VENCIMENTO': return 'text-yellow-600 bg-yellow-100'
      case 'ATRASADO': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'EM_DIA': return <CheckCircle className="h-4 w-4" />
      case 'PROXIMO_VENCIMENTO': return <Clock className="h-4 w-4" />
      case 'ATRASADO': return <AlertTriangle className="h-4 w-4" />
      default: return <CheckCircle className="h-4 w-4" />
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'EM_DIA': return 'Em dia'
      case 'PROXIMO_VENCIMENTO': return 'Próximo vencimento'
      case 'ATRASADO': return 'Atrasado'
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
        <p className="text-red-800">Erro ao carregar veículos</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Veículos</h1>
          <p className="text-gray-600 mt-1">
            {veiculos.length} veículo{veiculos.length !== 1 ? 's' : ''} cadastrado{veiculos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setVeiculoPreenchido(null)
            setIsVerificacaoModalOpen(true)
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Veículo
        </button>
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
            placeholder="Buscar por placa, marca, modelo, cliente..."
          />
        </div>
        
        <select
          value={filtroMarca}
          onChange={(e) => setFiltroMarca(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todas as marcas</option>
          {marcasUnicas.map((marca) => (
            <option key={marca} value={marca}>{marca}</option>
          ))}
        </select>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as any)}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="TODOS">Todos os status</option>
          <option value="EM_DIA">Em dia</option>
          <option value="PROXIMO_VENCIMENTO">Próximo vencimento</option>
          <option value="ATRASADO">Atrasado</option>
        </select>
      </div>

      {/* Cards de Veículos */}
      <div className="grid grid-cols-1 gap-6">
        {filteredVeiculos.map((veiculo) => (
          <div key={veiculo.id} className="bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-200 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <Car className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 bg-blue-100 rounded-full p-2" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {veiculo.marca} {veiculo.modelo}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-base sm:text-lg font-mono font-bold text-blue-600">
                          {formatPlaca(veiculo.placa)}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(veiculo.status_manutencao)}`}>
                          {getStatusIcon(veiculo.status_manutencao)}
                          <span className="ml-1">{getStatusLabel(veiculo.status_manutencao)}</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm mb-4">
                      <div className="flex items-center text-gray-600">
                        <User className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{veiculo.cliente_nome}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{veiculo.ano} • {veiculo.cor}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{veiculo.km_atual != null ? veiculo.km_atual.toLocaleString() + ' km' : '-'}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <Wrench className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{veiculo.total_servicos || 0} serviços</span>
                      </div>
                    </div>

                    {/* Informações de manutenção */}
                    {veiculo.proxima_manutencao && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700">Próxima manutenção</p>
                            <p className="text-xs text-gray-600">
                              {format(new Date(veiculo.proxima_manutencao), 'dd/MM/yyyy')} • {veiculo.km_proxima_manutencao != null ? veiculo.km_proxima_manutencao.toLocaleString() + ' km' : '-'}
                            </p>
                          </div>
                          {veiculo.km_proxima_manutencao && (
                            <div className="text-left sm:text-right">
                              <p className="text-sm font-medium text-gray-700">
                                  { (veiculo.km_proxima_manutencao != null && veiculo.km_atual != null) ? (veiculo.km_proxima_manutencao - veiculo.km_atual).toLocaleString() + ' km' : '-' }
                                </p>
                              <p className="text-xs text-gray-600">
                                {differenceInDays(new Date(veiculo.proxima_manutencao), new Date())} dias
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {veiculo.observacoes && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                          <strong>Obs:</strong> {veiculo.observacoes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações - Agora responsivo para mobile */}
                <div className="flex items-center justify-end lg:justify-start space-x-2 lg:ml-4 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-200">
                  <button
                    onClick={() => handleVerHistorico(veiculo)}
                    className="text-purple-600 hover:text-purple-900 p-2 rounded-lg hover:bg-purple-50"
                    title="Ver histórico de manutenções"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(veiculo)}
                    className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50"
                    title="Editar veículo"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50"
                    title="Exportar dados"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(veiculo.id)}
                    className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50"
                    title="Excluir veículo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de conflito */}
      <ConflictModal
        isOpen={conflictOpen}
        onClose={() => setConflictOpen(false)}
        existingId={conflictExistingId}
        existingAtivo={conflictExistingAtivo}
        onView={handleViewExisting}
        onReativar={handleReativarExisting}
      />

      {/* Estado vazio */}
      {filteredVeiculos.length === 0 && (
        <div className="text-center py-12">
          <Car className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchTerm || filtroMarca || filtroStatus !== 'TODOS' ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filtroMarca || filtroStatus !== 'TODOS' 
              ? 'Tente ajustar os filtros de busca.' 
              : 'Comece cadastrando um novo veículo para o seu AutoCenter.'
            }
          </p>
          {!searchTerm && !filtroMarca && filtroStatus === 'TODOS' && (
            <div className="mt-6">
              <button
                onClick={() => {
                  setVeiculoPreenchido(null)
                  setIsVerificacaoModalOpen(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Veículo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      <VeiculoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingVeiculo(undefined)
          setVeiculoPreenchido(null)
        }}
        veiculo={editingVeiculo}
        onSubmit={handleSubmit}
        dadosPreenchidos={veiculoPreenchido}
      />

      <HistoricoModal
        isOpen={isHistoricoOpen}
        onClose={() => {
          setIsHistoricoOpen(false)
          setSelectedVeiculo(undefined)
        }}
        veiculo={selectedVeiculo}
      />

      <ModalVerificacaoVeiculo
        isOpen={isVerificacaoModalOpen}
        onClose={() => setIsVerificacaoModalOpen(false)}
        onVeiculoEncontrado={handleVeiculoEncontrado}
        onCriarNovo={handleCriarNovoVeiculo}
        onReativar={handleReativarVeiculo}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Excluir veículo"
        message="Tem certeza que deseja deletar este veículo? Essa ação marcará o veículo como inativo."
        confirmText="Excluir"
        cancelText="Cancelar"
        onCancel={() => { setIsDeleteConfirmOpen(false); setIdToDelete(null) }}
        onConfirm={confirmDelete}
      />
    </div>
  )
}