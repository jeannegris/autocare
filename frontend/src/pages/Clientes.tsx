import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { Toaster, toast } from 'sonner'
import { apiFetch } from '../lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { handleDocumentInput, handlePhoneInput, cleanDocumentForSubmit, cleanPhoneForSubmit, formatDocument } from '../utils/documentMask'
import PeriodoFilter from '../components/PeriodoFilter'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin,
  User,
  X,
  Calendar,
  Car,
  FileText,
  Building,
  Users,
  Cake,
  Eye,
  Download,
  AlertCircle
} from 'lucide-react'
import { DollarSign, Wrench } from 'lucide-react'
import { format, differenceInYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ModalVerificacaoCliente from '../components/ModalVerificacaoCliente'
import {
  buscarCEP,
  useValidacao
} from '../utils/validations'
interface Cliente {
  id: number
  nome: string
  email: string
  telefone: string
  telefone2?: string
  whatsapp?: string
  endereco: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  cpf_cnpj: string
  rg_ie?: string
  tipo: 'PF' | 'PJ'
  data_nascimento?: string
  nome_fantasia?: string
  razao_social?: string
  contato_responsavel?: string
  observacoes?: string
  created_at: string
  updated_at: string
  total_gasto?: number
  total_servicos?: number
  ultima_visita?: string
  veiculos_count?: number
}

interface ClienteFormData {
  nome: string
  email: string
  telefone: string
  telefone2?: string
  whatsapp?: string
  endereco: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  cpf_cnpj: string
  rg_ie?: string
  tipo: 'PF' | 'PJ'
  data_nascimento?: string
  nome_fantasia?: string
  razao_social?: string
  contato_responsavel?: string
  observacoes?: string
}

// Hook para buscar clientes
function useClientes(periodo: string = 'T') {
  return useQuery({
    queryKey: ['clientes', periodo],
    queryFn: async (): Promise<Cliente[]> => {
      const res = await apiFetch(`/clientes?periodo=${periodo}`)
      if (!Array.isArray(res)) {
        // eslint-disable-next-line no-console
        console.error('useClientes: esperado array de clientes, recebeu:', res)
        return [] as Cliente[]
      }
      return res as Cliente[]
    },
    // Sempre buscar dados frescos ao montar/trocar período
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: 0
  })
}

// Modal de formulário
function ClienteModal({ 
  isOpen, 
  onClose, 
  cliente, 
  clientePreenchido,
  onSubmit 
}: {
  isOpen: boolean
  onClose: () => void
  cliente?: Cliente
  clientePreenchido?: { cpf_cnpj: string; tipo: 'PF' | 'PJ' } | null
  onSubmit: (data: ClienteFormData) => void
}) {
  const { erros, validarCampo, limparErro, limparTodosErros } = useValidacao()
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [formData, setFormData] = useState<ClienteFormData>({
    nome: '',
    email: '',
    telefone: '',
    telefone2: '',
    whatsapp: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    cpf_cnpj: '',
    rg_ie: '',
    tipo: 'PF',
    data_nascimento: '',
    nome_fantasia: '',
    razao_social: '',
    contato_responsavel: '',
    observacoes: ''
  })

  // Sincroniza o estado do formulário com a prop `cliente` ou `clientePreenchido`
  useEffect(() => {
    // Só executa quando o modal abre (isOpen muda de false para true)
    if (!isOpen) return
    
    console.log('useEffect do formulário executando com cliente:', cliente)
    
    if (cliente) {
      console.log('Preenchendo formulário com dados do cliente:', {
        endereco: cliente.endereco,
        numero: cliente.numero,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep
      })
      
      setFormData({
        nome: cliente.nome || '',
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        telefone2: cliente.telefone2 || '',
        whatsapp: cliente.whatsapp || '',
        endereco: cliente.endereco || '',
        numero: cliente.numero || '',
        complemento: cliente.complemento || '',
        bairro: cliente.bairro || '',
        cidade: cliente.cidade || '',
        estado: cliente.estado || '',
        cep: cliente.cep || '',
        cpf_cnpj: cliente.cpf_cnpj || '',
        rg_ie: cliente.rg_ie || '',
        tipo: cliente.tipo || 'PF',
        data_nascimento: cliente.data_nascimento || '',
        nome_fantasia: cliente.nome_fantasia || '',
        razao_social: cliente.razao_social || '',
        contato_responsavel: cliente.contato_responsavel || '',
        observacoes: cliente.observacoes || ''
      })
    } else if (clientePreenchido) {
      // Se há dados pré-preenchidos, use-os
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        telefone2: '',
        whatsapp: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: '',
        cpf_cnpj: clientePreenchido.cpf_cnpj,
        rg_ie: '',
        tipo: clientePreenchido.tipo,
        data_nascimento: '',
        nome_fantasia: '',
        razao_social: '',
        contato_responsavel: '',
        observacoes: ''
      })
    } else {
      // Ao abrir modal para novo cliente, limpa o formulário
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        telefone2: '',
        whatsapp: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        cep: '',
        cpf_cnpj: '',
        rg_ie: '',
        tipo: 'PF',
        data_nascimento: '',
        nome_fantasia: '',
        razao_social: '',
        contato_responsavel: '',
        observacoes: ''
      })
    }
    
    // Limpar erros ao abrir o modal
    limparTodosErros()
  }, [cliente, clientePreenchido]) // Removido isOpen e limparTodosErros das dependências

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar todos os campos obrigatórios antes de submeter
    let formValido = true
    
    // Validar CPF/CNPJ
    if (!validarCampo('cpf_cnpj', formData.cpf_cnpj, formData.tipo === 'PF' ? 'CPF' : 'CNPJ')) {
      formValido = false
    }
    
    // Validar email
    if (!validarCampo('email', formData.email, 'email')) {
      formValido = false
    }
    
    // Validar telefone
    if (!validarCampo('telefone', formData.telefone, 'telefone')) {
      formValido = false
    }
    
    if (formValido) {
      // Preparar dados para envio (limpar máscaras)
      const dadosParaEnvio = {
        ...formData,
        cpf_cnpj: formData.cpf_cnpj ? cleanDocumentForSubmit(formData.cpf_cnpj) : '',
        telefone: formData.telefone ? cleanPhoneForSubmit(formData.telefone) : '',
        telefone2: formData.telefone2 ? cleanPhoneForSubmit(formData.telefone2) : '',
        whatsapp: formData.whatsapp ? cleanPhoneForSubmit(formData.whatsapp) : '',
      }
      
      onSubmit(dadosParaEnvio)
      // Modal será fechado após sucesso da mutação
    }
  }

  // Função para lidar com mudanças no CPF/CNPJ
  const handleCpfCnpjChange = (value: string) => {
    // Aplicar máscara de documento
    handleDocumentInput(value, (maskedValue) => {
      setFormData({...formData, cpf_cnpj: maskedValue})
      
      // Validar em tempo real se o campo não estiver vazio
      if (maskedValue.trim()) {
        validarCampo('cpf_cnpj', maskedValue, formData.tipo === 'PF' ? 'CPF' : 'CNPJ')
      } else {
        limparErro('cpf_cnpj')
      }
    })
  }

  // Função para lidar com mudanças no telefone
  const handleTelefoneChange = (campo: 'telefone' | 'telefone2' | 'whatsapp', value: string) => {
    // Aplicar máscara de telefone
    handlePhoneInput(value, (maskedValue) => {
      setFormData({...formData, [campo]: maskedValue})
      
      // Validar em tempo real apenas para telefone principal
      if (campo === 'telefone' && maskedValue.trim()) {
        validarCampo(campo, maskedValue, 'telefone')
      } else if (campo === 'telefone' && !maskedValue.trim()) {
        limparErro(campo)
      }
    })
  }

  // Função para lidar com mudanças no email
  const handleEmailChange = (value: string) => {
    setFormData({...formData, email: value})
    
    // Validar em tempo real se o campo não estiver vazio
    if (value.trim()) {
      validarCampo('email', value, 'email')
    } else {
      limparErro('email')
    }
  }

  // Função para lidar com mudanças no CEP
  const handleCepChange = async (value: string) => {
    // Aplicar máscara de CEP diretamente
    const valorFormatado = value.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')
    setFormData({...formData, cep: valorFormatado})
    
    const cepLimpo = value.replace(/\D/g, '')
    if (cepLimpo.length === 8) {
      setLoadingCEP(true)
      try {
        const resultado = await buscarCEP(value)
        if (resultado.sucesso && resultado.endereco) {
          setFormData(prev => ({
            ...prev,
            cep: resultado.endereco!.cep,
            endereco: resultado.endereco!.logradouro,
            bairro: resultado.endereco!.bairro,
            cidade: resultado.endereco!.cidade,
            estado: resultado.endereco!.estado
          }))
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error)
      } finally {
        setLoadingCEP(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Pessoa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Pessoa *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({...formData, tipo: e.target.value as 'PF' | 'PJ'})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </div>
          </div>

          {/* Dados Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.tipo === 'PF' ? 'Nome Completo' : 'Razão Social'} *
              </label>
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
                placeholder={formData.tipo === 'PF' ? 'Ex: João Silva Santos' : 'Ex: Empresa XYZ Ltda'}
              />
              {erros.nome && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.nome}
                </p>
              )}
            </div>

            {formData.tipo === 'PJ' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  value={formData.nome_fantasia || ''}
                  onChange={(e) => setFormData({...formData, nome_fantasia: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Auto Peças XYZ"
                />
              </div>
            )}
          </div>

          {/* Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.tipo === 'PF' ? 'CPF' : 'CNPJ'} *
              </label>
              <input
                type="text"
                value={formData.cpf_cnpj}
                onChange={(e) => handleCpfCnpjChange(e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.cpf_cnpj 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
                placeholder={formData.tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
              {erros.cpf_cnpj && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.cpf_cnpj}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.tipo === 'PF' ? 'RG' : 'Inscrição Estadual'}
              </label>
              <input
                type="text"
                value={formData.rg_ie || ''}
                onChange={(e) => setFormData({...formData, rg_ie: e.target.value})}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={formData.tipo === 'PF' ? '00.000.000-0' : '000.000.000.000'}
              />
            </div>

            {formData.tipo === 'PF' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  value={formData.data_nascimento || ''}
                  onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {formData.tipo === 'PJ' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contato Responsável</label>
                <input
                  type="text"
                  value={formData.contato_responsavel || ''}
                  onChange={(e) => setFormData({...formData, contato_responsavel: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Maria Santos"
                />
              </div>
            )}
          </div>

          {/* Contatos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Principal *</label>
              <input
                type="text"
                value={formData.telefone}
                onChange={(e) => handleTelefoneChange('telefone', e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.telefone 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
                placeholder="(11) 99999-9999"
              />
              {erros.telefone && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.telefone}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Secundário</label>
              <input
                type="text"
                value={formData.telefone2 || ''}
                onChange={(e) => handleTelefoneChange('telefone2', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="(11) 3333-4444"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                type="text"
                value={formData.whatsapp || ''}
                onChange={(e) => handleTelefoneChange('whatsapp', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                erros.email 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              required
              placeholder="exemplo@email.com"
            />
            {erros.email && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {erros.email}
              </p>
            )}
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Endereço</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">CEP *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {loadingCEP && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro *</label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  placeholder="Rua das Flores"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
                <input
                  type="text"
                  value={formData.numero}
                  onChange={(e) => setFormData({...formData, numero: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  placeholder="123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                <input
                  type="text"
                  value={formData.complemento || ''}
                  onChange={(e) => setFormData({...formData, complemento: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Apto 45"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro *</label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) => setFormData({...formData, bairro: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  placeholder="Centro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  placeholder="São Paulo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
                <input
                  type="text"
                  value={formData.estado}
                  readOnly
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-not-allowed"
                  placeholder="Estado"
                />
              </div>
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
              placeholder="Informações adicionais sobre o cliente..."
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
              {cliente ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Clientes() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | undefined>()
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'PF' | 'PJ'>('TODOS')
  // Controle de período por cliente: { [clienteId]: 'T' | 'A' | 'M' }
  const [periodoPorCliente, setPeriodoPorCliente] = useState<Record<number, 'T' | 'A' | 'M'>>({})
  // Cache de estatísticas por cliente e período: { [clienteId]: { T?: Stats; A?: Stats; M?: Stats } }
  type Stats = { total_gasto: number; total_servicos: number; veiculos_count?: number }
  const [statsPorCliente, setStatsPorCliente] = useState<Record<number, { T?: Stats; A?: Stats; M?: Stats }>>({})
  const [loadingStatsCliente, setLoadingStatsCliente] = useState<Record<number, boolean>>({})
  
  // Estados para o novo modal de verificação
  const [isVerificacaoModalOpen, setIsVerificacaoModalOpen] = useState(false)
  const [clientePreenchido, setClientePreenchido] = useState<{
    cpf_cnpj: string
    tipo: 'PF' | 'PJ'
  } | null>(null)

  const queryClient = useQueryClient()
  // Buscamos a lista de clientes com período padrão Total (T)
  const { data: clientes = [], isLoading, error } = useClientes('T')
  const [pendingReactivation, setPendingReactivation] = useState<{
    existingId: number
    message: string
  } | null>(null)

  // Guardar o último payload de criação para usar no fallback em caso de erro
  const lastCreatePayload = useRef<ClienteFormData | null>(null)
  const [deletePending, setDeletePending] = useState<{
    id: number
    nome?: string
  } | null>(null)

  // Mutação para criar cliente
  const createMutation = useMutation({
    mutationFn: async (data: ClienteFormData) => {
      return await apiFetch('/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Cliente
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Cliente criado com sucesso')
      // limpar payload guardado
      lastCreatePayload.current = null
      // Fechar modal apenas após sucesso
      setEditingCliente(undefined)
      setIsModalOpen(false)
    },
    onError: async (err: any) => {
      console.error('Erro ao criar cliente', err)
      // Se backend indicou existing_id (409), oferecer reativação
      const parsed = err?.json || (err?.body ? (() => { try { return JSON.parse(err.body) } catch { return null } })() : null)
      if (err?.status === 409 && parsed?.existing_id) {
        const existingId = parsed.existing_id
        const ativo = parsed.ativo
        const msg = parsed.message || 'CPF/CNPJ já cadastrado'
        if (!ativo) {
          setPendingReactivation({ existingId: existingId, message: msg })
          return
        }
        toast.error(msg)
        return
      }

      // Fallback: se a resposta contiver mensagem textual indicando CPF/CNPJ duplicado,
      // podemos tentar localizar o cliente existente via busca para obter o id e estado.
      try {
        const txt = parsed?.detail || parsed?.message || err?.body || err?.message || ''
        if (/cpf|cnpj/i.test(txt) && /já cadastrado/i.test(txt)) {
          // Usar o payload que foi enviado na tentativa de criação para localizar o cliente
          const payloadCpf = lastCreatePayload.current?.cpf_cnpj || ''
          const searchTerm = payloadCpf || ''
          if (searchTerm) {
            const results = await apiFetch('/clientes?search=' + encodeURIComponent(searchTerm)).catch(() => null)
            if (Array.isArray(results)) {
              const found = results.find((c: any) => c.cpf_cnpj && c.cpf_cnpj.replace(/\D/g,'') === searchTerm.replace(/\D/g,''))
              if (found) {
                if (!found.ativo) {
                  setPendingReactivation({ existingId: found.id, message: 'CPF/CNPJ já cadastrado' })
                  return
                }
                toast.error('CPF/CNPJ já cadastrado (registro ativo)')
                return
              }
            }
          }
        }
      } catch (e) {
        console.error('Fallback de busca por CPF falhou', e)
      }

      toast.error('Erro ao criar cliente: ' + formatApiError(err))
    }
  })

  // Mutação para atualizar cliente
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ClienteFormData }) => {
      console.log('updateMutation executando para ID:', id, 'com data:', data)
      const response = await apiFetch(`/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }) as Cliente
      console.log('Resposta da API de atualização:', response)
      return response
    },
    onSuccess: (data) => {
      console.log('Update bem-sucedido, dados retornados:', data)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Cliente atualizado com sucesso')
      // Fechar modal apenas após sucesso
      setEditingCliente(undefined)
      setIsModalOpen(false)
    },
    onError: (err: any) => {
      console.error('Erro ao atualizar cliente', err)
  toast.error('Erro ao atualizar cliente: ' + formatApiError(err))
    }
  })

  // Mutação para deletar cliente
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // Retornar o JSON do backend (agora o backend retorna o cliente atualizado)
      return await apiFetch(`/clientes/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      // Invalidar cache para forçar re-fetch
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Cliente excluído com sucesso')
    },
    onSettled: () => {
      // Após settled apenas invalidamos/permitimos re-fetch (sem logs)
    },
    onError: (err: any) => {
      console.error('Erro ao deletar cliente', err)
  toast.error('Erro ao deletar cliente: ' + formatApiError(err))
    }
  })

  // Sanitiza dados do formulário: remove chaves cujo valor é string vazia.
  // Isso evita que campos como `data_nascimento: ""` sejam enviados e
  // causem validação 422 no backend (pydantic espera `date` ou ausência/null).
  const sanitizeClienteData = (data: ClienteFormData) => {
    const copy: any = { ...data }
    Object.keys(copy).forEach((k) => {
      // Remover strings vazias
      if (copy[k] === '') {
        delete copy[k]
        return
      }

        // Converter data_nascimento para ISO (YYYY-MM-DD) se for uma string não vazia
        if (k === 'data_nascimento' && typeof copy[k] === 'string') {
          try {
            const d = new Date(copy[k])
            if (!isNaN(d.getTime())) {
              // Garantir formato YYYY-MM-DD
              copy[k] = d.toISOString().slice(0, 10)
            } else {
              // Se não for uma data válida, remover para evitar 422
              delete copy[k]
            }
          } catch (e) {
            delete copy[k]
          }
        }
      })
      return copy
    }

    // Formata erros de API (Pydantic, mensagens simples, ou objeto JSON)
    const formatApiError = (e: any) => {
      try {
        if (!e) return 'Erro desconhecido'
        // Se apiFetch anexou json, use-o
        const j = e.json || (e?.body ? (() => { try { return JSON.parse(e.body) } catch { return null } })() : null)
        if (j) {
          // Pydantic returns array of errors
          if (Array.isArray(j) && j.length > 0) {
            return j.map((it: any) => `${it.loc?.join('.') || ''}: ${it.msg || JSON.stringify(it)}`).join('\n')
          }
          // detail/message patterns
          if (j.detail) return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
          if (j.message) return j.message
          return JSON.stringify(j)
        }
        // Fallback para body text
        if (e?.body) return e.body
        return e.message || String(e)
      } catch (err) {
        return 'Erro ao processar mensagem de erro'
      }
    }

  const handleSubmit = (data: ClienteFormData) => {
    console.log('handleSubmit chamado com data:', data)
    const payload = sanitizeClienteData(data)
    console.log('payload sanitizado:', payload)
    if (editingCliente) {
      console.log('Atualizando cliente ID:', editingCliente.id)
      updateMutation.mutate({ id: editingCliente.id, data: payload as any })
    } else {
      // guardar payload para uso em fallback caso o backend retorne mensagem textual
      lastCreatePayload.current = payload as ClienteFormData
      createMutation.mutate(payload as any)
    }
    // NÃO limpar editingCliente imediatamente - aguardar sucesso da mutação
    // setEditingCliente(undefined)
  }

  const handleEdit = (cliente: Cliente) => {
    console.log('handleEdit chamado com cliente:', {
      id: cliente.id,
      nome: cliente.nome,
      endereco: cliente.endereco,
      numero: cliente.numero,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      updated_at: cliente.updated_at
    })
    setEditingCliente(cliente)
    setIsModalOpen(true)
  }

  const handleDelete = (id: number, nome?: string) => {
    setDeletePending({ id, nome })
  }

  // Função para abrir o modal de verificação de cliente
  const abrirNovoCliente = () => {
    setIsVerificacaoModalOpen(true)
  }

  // Função chamada quando um cliente ativo é encontrado
  const handleClienteEncontrado = (cliente: any) => {
    setIsVerificacaoModalOpen(false)
    setEditingCliente(cliente)
    setIsModalOpen(true)
  }

  // Função chamada quando nenhum cliente é encontrado
  const handleCriarNovo = (cpfCnpj: string, tipo: 'CPF' | 'CNPJ') => {
    setClientePreenchido({
      cpf_cnpj: cpfCnpj,
      tipo: tipo === 'CPF' ? 'PF' : 'PJ'
    })
    setIsVerificacaoModalOpen(false)
    setEditingCliente(undefined)
    setIsModalOpen(true)
  }

  // Função chamada quando um cliente inativo precisa ser reativado
  const handleReativar = async (cliente: any) => {
    try {
      await apiFetch(`/clientes/${cliente.id}/reativar`, {
        method: 'POST'
      })
      toast.success('Cliente reativado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      setIsVerificacaoModalOpen(false)
      // Resetar estados para próxima abertura do modal
      setClientePreenchido(null)
    } catch (error) {
      console.error('Erro ao reativar cliente:', error)
      toast.error('Erro ao reativar cliente')
    }
  }

  const calcularIdade = (dataNascimento: string) => {
    return differenceInYears(new Date(), new Date(dataNascimento))
  }

  const safeClientes = Array.isArray(clientes) ? clientes : []

  // Sincroniza o cache de estatísticas (slot T) com os valores retornados na lista
  // para garantir que o período "Total" do card sempre reflita a API atual.
  useEffect(() => {
    if (!safeClientes || safeClientes.length === 0) return
    setStatsPorCliente((prev) => {
      const next = { ...prev }
      for (const c of safeClientes as any[]) {
        const id = (c as any).id as number
        if (!next[id]) next[id] = {}
        next[id].T = {
          total_gasto: (c as any).total_gasto != null ? (c as any).total_gasto : 0,
          total_servicos: (c as any).total_servicos != null ? (c as any).total_servicos : 0,
          veiculos_count: (c as any).veiculos_count
        }
      }
      return next
    })
  }, [safeClientes])

  // Handler para mudar o período de um cliente específico
  const handlePeriodoChange = async (clienteId: number, periodo: 'T' | 'A' | 'M') => {
    // Atualiza o estado visual do período selecionado para o card
    setPeriodoPorCliente((prev) => ({ ...prev, [clienteId]: periodo }))
    // Se já temos cache para esse período, não buscar novamente
    const cached = statsPorCliente[clienteId]?.[periodo]
    if (cached !== undefined) return
    try {
      setLoadingStatsCliente((prev) => ({ ...prev, [clienteId]: true }))
      const stats = await apiFetch(`/clientes/${clienteId}/estatisticas?periodo=${periodo}`)
      const statObj: Stats = {
        total_gasto: (stats && typeof stats.total_gasto === 'number') ? stats.total_gasto : 0,
        total_servicos: (stats && typeof stats.total_servicos === 'number') ? stats.total_servicos : 0,
        veiculos_count: (stats && typeof stats.veiculos_count === 'number') ? stats.veiculos_count : undefined
      }
      setStatsPorCliente((prev) => ({
        ...prev,
        [clienteId]: { ...(prev[clienteId] || {}), [periodo]: statObj }
      }))
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Falha ao obter estatísticas do cliente', clienteId, 'período', periodo, e)
    } finally {
      setLoadingStatsCliente((prev) => ({ ...prev, [clienteId]: false }))
    }
  }
  const filteredClientes = safeClientes.filter(cliente => {
    const matchesSearch = 
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.cpf_cnpj.includes(searchTerm) ||
      cliente.telefone.includes(searchTerm) ||
      (cliente.nome_fantasia && cliente.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesTipo = filtroTipo === 'TODOS' || cliente.tipo === filtroTipo
    
    return matchesSearch && matchesTipo
  })

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
        <p className="text-red-800">Erro ao carregar clientes</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Clientes</h1>
          <p className="text-gray-600 mt-1">
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} cadastrado{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={abrirNovoCliente}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
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
            placeholder="Buscar por nome, email, documento, telefone..."
          />
        </div>
        
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as 'TODOS' | 'PF' | 'PJ')}
          className="border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="TODOS">Todos os tipos</option>
          <option value="PF">Pessoa Física</option>
          <option value="PJ">Pessoa Jurídica</option>
        </select>
      </div>

      {/* Cards de Clientes */}
      <div className="grid grid-cols-1 gap-6">
        {filteredClientes.map((cliente) => (
          <div key={cliente.id} className="bg-white shadow-md rounded-lg border border-gray-200 hover:shadow-lg transition-shadow duration-200 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {cliente.tipo === 'PF' ? (
                      <User className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 bg-blue-100 rounded-full p-2" />
                    ) : (
                      <Building className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 bg-green-100 rounded-full p-2" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {cliente.nome}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cliente.tipo === 'PF' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {cliente.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                        </span>
                        {cliente.data_nascimento && (
                          <span className="inline-flex items-center text-xs text-pink-600 bg-pink-100 px-2 py-1 rounded-full">
                            <Cake className="h-3 w-3 mr-1" />
                            {calcularIdade(cliente.data_nascimento)} anos
                          </span>
                        )}
                      </div>
                    </div>

                    {cliente.nome_fantasia && (
                      <p className="text-sm text-gray-600 mt-1">
                        {cliente.nome_fantasia}
                      </p>
                    )}

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{cliente.email}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{cliente.telefone}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <FileText className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{formatDocument(cliente.cpf_cnpj)}</span>
                      </div>

                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate">
                          {cliente.cidade}, {cliente.estado}
                        </span>
                      </div>
                    </div>

                    {/* Estatísticas do Cliente */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Total Gasto</span>
                          <div className="flex items-center space-x-1">
                            <PeriodoFilter
                              periodoAtivo={periodoPorCliente[cliente.id] || 'T'}
                              onPeriodoChange={(p) => handlePeriodoChange(cliente.id, p as 'T' | 'A' | 'M')}
                            />
                            {loadingStatsCliente[cliente.id] ? (
                              <span className="inline-block h-4 w-4">
                                <span className="animate-spin inline-block rounded-full h-4 w-4 border-b-2 border-green-600"></span>
                              </span>
                            ) : (
                              <DollarSign className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </div>
                        <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                          {(() => {
                            const periodoAtivo = periodoPorCliente[cliente.id] || 'T'
                            const cached = statsPorCliente[cliente.id]?.[periodoAtivo]?.total_gasto
                            const fallbackT = periodoAtivo === 'T' ? (cliente.total_gasto != null ? cliente.total_gasto : 0) : undefined
                            const valor = cached != null ? cached : (fallbackT != null ? fallbackT : 0)
                            return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          })()}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Serviços</span>
                          <div className="flex items-center space-x-1">
                            <PeriodoFilter
                              periodoAtivo={periodoPorCliente[cliente.id] || 'T'}
                              onPeriodoChange={(p) => handlePeriodoChange(cliente.id, p as 'T' | 'A' | 'M')}
                            />
                            {loadingStatsCliente[cliente.id] ? (
                              <span className="inline-block h-4 w-4">
                                <span className="animate-spin inline-block rounded-full h-4 w-4 border-b-2 border-blue-600"></span>
                              </span>
                            ) : (
                              <Wrench className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                        </div>
                        <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                          {(() => {
                            const periodoAtivo = periodoPorCliente[cliente.id] || 'T'
                            const cached = statsPorCliente[cliente.id]?.[periodoAtivo]?.total_servicos
                            const fallbackT = periodoAtivo === 'T' ? (cliente.total_servicos || 0) : undefined
                            const valor = cached != null ? cached : (fallbackT != null ? fallbackT : 0)
                            return valor
                          })()}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">Veículos</span>
                          <Car className="h-4 w-4 text-purple-600" />
                        </div>
                        <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                          {cliente.veiculos_count || 0}
                        </p>
                      </div>
                    </div>

                    {cliente.ultima_visita && (
                      <div className="mt-3 text-sm text-gray-500">
                        <Calendar className="inline h-4 w-4 mr-1" />
                        Última visita: {format(new Date(cliente.ultima_visita), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    )}

                    {cliente.observacoes && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                          <strong>Obs:</strong> {cliente.observacoes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações - Agora responsivo para mobile */}
                <div className="flex items-center justify-end lg:justify-start space-x-2 lg:ml-4 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-200">
                  <button
                    onClick={() => handleEdit(cliente)}
                    className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50"
                    title="Editar cliente"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-50"
                    title="Ver histórico"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50"
                    title="Exportar dados"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cliente.id, (cliente as any).nome)}
                    className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50"
                    title="Excluir cliente"
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
      {filteredClientes.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchTerm || filtroTipo !== 'TODOS' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || filtroTipo !== 'TODOS' 
              ? 'Tente ajustar os filtros de busca.' 
              : 'Comece criando um novo cliente para o seu AutoCenter.'
            }
          </p>
          {!searchTerm && filtroTipo === 'TODOS' && (
            <div className="mt-6">
              <button
                onClick={() => {
                  setEditingCliente(undefined)
                  setIsModalOpen(true)
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Verificação de Cliente */}
      <ModalVerificacaoCliente
        isOpen={isVerificacaoModalOpen}
        onClose={() => setIsVerificacaoModalOpen(false)}
        onClienteEncontrado={handleClienteEncontrado}
        onCriarNovo={handleCriarNovo}
        onReativar={handleReativar}
      />

      {/* Modal */}
      <ClienteModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingCliente(undefined)
          setClientePreenchido(null)
        }}
        cliente={editingCliente}
        clientePreenchido={clientePreenchido}
        onSubmit={handleSubmit}
      />
      {/* Reactivation modal - aparece quando o backend indica que existe um registro inativo */}
      {pendingReactivation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{pendingReactivation.message}</h2>
              <button onClick={() => setPendingReactivation(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">Um cliente com o mesmo CPF/CNPJ já existe no sistema. Deseja reativá-lo?</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
                onClick={() => setPendingReactivation(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={async () => {
                  const id = pendingReactivation.existingId
                  try {
                    await apiFetch(`/clientes/${id}/reativar`, { method: 'POST' })
                    queryClient.invalidateQueries({ queryKey: ['clientes'] })
                    setPendingReactivation(null)
                    // feedback simples
                    // eslint-disable-next-line no-alert
                    alert('Cliente reativado com sucesso')
                  } catch (e) {
                    // eslint-disable-next-line no-alert
                    alert('Falha ao reativar cliente: ' + String(e))
                  }
                }}
              >
                Reativar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Deletion confirmation modal */}
      {deletePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Confirmar exclusão</h2>
              <button onClick={() => setDeletePending(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">Tem certeza que deseja excluir o cliente <strong>{deletePending.nome}</strong>? Esta ação apenas marcará o cliente como inativo.</p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
                onClick={() => setDeletePending(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={async () => {
                  if (!deletePending) return
                  try {
                    await deleteMutation.mutateAsync(deletePending.id)
                    setDeletePending(null)
                  } catch (e) {
                    // erro já tratado em onError do mutation
                    setDeletePending(null)
                  }
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}