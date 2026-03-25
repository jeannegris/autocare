import * as React from 'react'
import { useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import ModalCompraFornecedor from '../components/ModalCompraFornecedor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin,
  Building,
  X,
  Eye,
  RotateCcw,
  User,
  AlertCircle,
  ShoppingCart
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import {
  buscarCEP,
  aplicarMascara,
  limparFormatacao,
  useValidacao
} from '../utils/validations'

interface Fornecedor {
  id: number
  nome: string
  razao_social?: string
  cnpj?: string
  email?: string
  telefone?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  contato?: string
  observacoes?: string
  ativo: boolean
  created_at: string
  updated_at?: string
}

interface FornecedorForm {
  nome: string
  razao_social: string
  cnpj: string
  email: string
  telefone: string
  endereco: string
  cidade: string
  estado: string
  cep: string
  contato: string
  observacoes: string
}

const INITIAL_FORM_DATA: FornecedorForm = {
  nome: '',
  razao_social: '',
  cnpj: '',
  email: '',
  telefone: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  contato: '',
  observacoes: ''
}

const Fornecedores: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cadastro' | 'compras'>('cadastro')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showModalCompra, setShowModalCompra] = useState(false)
  const [showModalSelecionarFornecedor, setShowModalSelecionarFornecedor] = useState(false)
  const [fornecedorParaCompra, setFornecedorParaCompra] = useState<{ id: number; nome: string } | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<FornecedorForm>(INITIAL_FORM_DATA)
  const [showDetails, setShowDetails] = useState<number | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [loadingCEP, setLoadingCEP] = useState(false)
  const [detalhesCompra, setDetalhesCompra] = useState<any | null>(null)
  const [isDeleteCompraConfirmOpen, setIsDeleteCompraConfirmOpen] = useState(false)
  const [idCompraToDelete, setIdCompraToDelete] = useState<number | null>(null)

  // Hook de validação
  const { erros, validarCampo, limparErro, limparTodosErros } = useValidacao()

  // useApi retorna o cliente axios
  const api = useApi()
  const queryClient = useQueryClient()

  // Query para buscar fornecedores
  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores', searchTerm, showInactive],
    queryFn: async () => {
      const res = await api.get('/fornecedores', {
        params: {
          search: searchTerm || undefined,
          // Quando showInactive for true queremos buscar os inativos (ativo=false).
          // Quando false, buscar somente ativos (ativo=true).
          ativo: showInactive ? false : true
        }
      })
      // Garantir que a lista retorne ordenada alfabeticamente por nome
      const list = res.data as Fornecedor[]
      return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    }
  })

  // Query para buscar compras de fornecedor
  const { data: compras = [] } = useQuery({
    queryKey: ['compras-fornecedor'],
    queryFn: async () => {
      const res = await api.get('/compras-fornecedor/?limit=1000')
      return res.data || []
    }
  })

  // Mutation para criar fornecedor
  const createMutation = useMutation({
    mutationFn: async (data: Partial<FornecedorForm>) => {
      const res = await api.post('/fornecedores', data)
      return res.data
    },
    onSuccess: (created: Fornecedor) => {
      queryClient.setQueryData<Fornecedor[] | undefined>(['fornecedores'], (old) => {
        const list = old ? [...old, created] : [created]
        return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      })
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
      setShowModal(false)
      setFormData(INITIAL_FORM_DATA)
    }
  })

  // Mutation para atualizar fornecedor
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<FornecedorForm> }) => {
      const res = await api.put(`/fornecedores/${id}`, data)
      return res.data
    },
    onSuccess: (updated: Fornecedor) => {
      console.debug('updateMutation.onSuccess', updated)
      queryClient.setQueryData<Fornecedor[] | undefined>(['fornecedores'], (old) => {
        if (!old) return [updated]
        const next = old.map(f => f.id === updated.id ? updated : f)
        return next.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      })
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
      // Atualizar o formulário com os dados salvos do servidor em vez de resetar
      setFormData({
        nome: updated.nome,
        razao_social: updated.razao_social || '',
        cnpj: updated.cnpj || '',
        email: updated.email || '',
        telefone: updated.telefone || '',
        endereco: updated.endereco || '',
        cidade: updated.cidade || '',
        estado: updated.estado || '',
        cep: updated.cep || '',
        contato: updated.contato || '',
        observacoes: updated.observacoes || ''
      })
      setShowModal(false)
      setEditingId(null)
    }
    ,
    onError: (error: any) => {
      console.error('updateMutation.onError', error)
      // manter modal aberto para o usuário corrigir caso de erro
    }
  })


  // Estado do modal de confirmação de exclus??o
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [idToDelete, setIdToDelete] = useState<number | null>(null)

  // Mutation para desativar fornecedor
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/fornecedores/${id}`)
      return res.data
    },
    // Usar optimistic update para garantir remoção imediata da UI
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'fornecedores' })
      // Snapshot dos valores anteriores para rollback
      const previous: Array<{ queryKey: any; data: Fornecedor[] | undefined }> = []
      const matches = queryClient.getQueryCache().findAll({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'fornecedores' })
      matches.forEach(q => {
        previous.push({ queryKey: q.queryKey, data: queryClient.getQueryData(q.queryKey as any) })
        queryClient.setQueryData(q.queryKey as any, (old: Fornecedor[] | undefined) => {
          if (!old) return old
          return old.filter(f => f.id !== id)
        })
      })
      return { previous }
    },
    onError: (_err, _id, context: any) => {
      // Rollback se falhar
      if (context?.previous) {
        context.previous.forEach((p: any) => {
          queryClient.setQueryData(p.queryKey, p.data)
        })
      }
    },
    onSettled: () => {
      // Garantir eventual consistência
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
    }
    
    
  })
  

  const handleDeleteFornecedor = (id: number) => {
    setIdToDelete(id)
    setIsDeleteConfirmOpen(true)
  }

  const confirmDeleteFornecedor = () => {
    if (idToDelete) deleteMutation.mutate(idToDelete)
    setIsDeleteConfirmOpen(false)
    setIdToDelete(null)
  }

  // Mutation para reativar fornecedor
  const reactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/fornecedores/${id}/reativar`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
    }
  })

  // Mutation para excluir compra de fornecedor
  const deleteCompraMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/compras-fornecedor/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras-fornecedor'] })
      setIsDeleteCompraConfirmOpen(false)
      setIdCompraToDelete(null)
      setDetalhesCompra(null)
    }
  })

  const handleDeleteCompra = (id: number) => {
    setIdCompraToDelete(id)
    setIsDeleteCompraConfirmOpen(true)
  }

  const confirmDeleteCompra = () => {
    if (idCompraToDelete) {
      deleteCompraMutation.mutate(idCompraToDelete)
    }
  }

  const handleVerDetalhesCompra = async (compraId: number) => {
    try {
      const res = await api.get(`/compras-fornecedor/${compraId}`)
      setDetalhesCompra(res.data)
    } catch (error) {
      console.error('Erro ao buscar detalhes da compra:', error)
      alert('Erro ao buscar detalhes da compra')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar campos obrigatórios antes de submeter
    let formValido = true
    
    // Validar CNPJ se preenchido
    if (formData.cnpj && !validarCampo('cnpj', formData.cnpj, 'CNPJ')) {
      formValido = false
    }
    
    // Validar email se preenchido
    if (formData.email && !validarCampo('email', formData.email, 'email')) {
      formValido = false
    }
    
    // Validar telefone se preenchido
    if (formData.telefone && !validarCampo('telefone', formData.telefone, 'telefone')) {
      formValido = false
    }
    
    if (!formValido) {
      return
    }
    
    // Remove campos vazios
    const cleanData = Object.fromEntries(
      Object.entries(formData).filter(([_, value]) => value.trim() !== '')
    )
    
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: cleanData })
    } else {
      createMutation.mutate(cleanData)
    }
  }

  // Função para lidar com mudanças no CNPJ
  const handleCnpjChange = (value: string) => {
    const valorFormatado = aplicarMascara('CNPJ', value)
    setFormData({...formData, cnpj: valorFormatado})
    
    if (value.trim()) {
      validarCampo('cnpj', value, 'CNPJ')
    } else {
      limparErro('cnpj')
    }
  }

  // Função para lidar com mudanças no telefone
  const handleTelefoneChange = (value: string) => {
    const valorFormatado = aplicarMascara('telefone', value)
    setFormData({...formData, telefone: valorFormatado})
    
    if (value.trim()) {
      validarCampo('telefone', value, 'telefone')
    } else {
      limparErro('telefone')
    }
  }

  // Função para lidar com mudanças no email
  const handleEmailChange = (value: string) => {
    setFormData({...formData, email: value})
    
    if (value.trim()) {
      validarCampo('email', value, 'email')
    } else {
      limparErro('email')
    }
  }

  // Função para lidar com mudanças no CEP
  const handleCepChange = async (value: string) => {
    const valorFormatado = aplicarMascara('cep', value)
    setFormData({...formData, cep: valorFormatado})
    
    const cepLimpo = limparFormatacao(value)
    if (cepLimpo.length === 8) {
      setLoadingCEP(true)
      try {
        const resultado = await buscarCEP(value)
        if (resultado.sucesso && resultado.endereco) {
          setFormData(prev => ({
            ...prev,
            cep: resultado.endereco!.cep,
            endereco: resultado.endereco!.logradouro,
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

  const handleEdit = (fornecedor: Fornecedor) => {
    const formDataToSet = {
      nome: fornecedor.nome || '',
      razao_social: fornecedor.razao_social || '',
      cnpj: fornecedor.cnpj || '',
      email: fornecedor.email || '',
      telefone: fornecedor.telefone || '',
      endereco: fornecedor.endereco || '',
      cidade: fornecedor.cidade || '',
      estado: fornecedor.estado || '',
      cep: fornecedor.cep || '',
      contato: fornecedor.contato || '',
      observacoes: fornecedor.observacoes || ''
    }
    
    setEditingId(fornecedor.id)
    setFormData(formDataToSet)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingId(null)
    setFormData(INITIAL_FORM_DATA)
    limparTodosErros()
  }

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return ''
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }

  const filteredFornecedores = fornecedores.filter((fornecedor: Fornecedor) =>
    fornecedor.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fornecedor.cnpj?.includes(searchTerm) ||
    fornecedor.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
        <p className="text-gray-600 mt-1">Gerencie fornecedores e compras</p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('cadastro')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'cadastro'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          Cadastro de Fornecedores
        </button>
        <button
          onClick={() => setActiveTab('compras')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'compras'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          Compras de Fornecedor
        </button>
      </div>

      {/* Conteúdo das abas */}
      {activeTab === 'cadastro' ? (
        // ABA 1: CADASTRO DE FORNECEDORES
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors text-center ${
                  showInactive 
                    ? 'bg-gray-600 text-white hover:bg-gray-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showInactive ? 'Ver Ativos' : 'Ver Inativos'}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                Novo Fornecedor
              </button>
            </div>
          </div>

          {/* Barra de busca */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar por nome, CNPJ ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Lista de fornecedores */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredFornecedores.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Nenhum fornecedor encontrado</p>
                <p className="text-sm">Clique em "Novo Fornecedor" para adicionar o primeiro</p>
              </div>
            ) : (
              <>
                {/* Layout desktop (tabela) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fornecedor
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs">
                      Contato
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Localização
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredFornecedores.map((fornecedor: Fornecedor) => (
                    <tr key={fornecedor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{fornecedor.nome}</div>
                          {fornecedor.razao_social && (
                            <div className="text-sm text-gray-500">{fornecedor.razao_social}</div>
                          )}
                          {fornecedor.cnpj && (
                            <div className="text-xs text-gray-400">{formatCNPJ(fornecedor.cnpj)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 max-w-xs">
                        <div className="text-sm space-y-0.5 truncate">
                          {fornecedor.telefone && (
                            <div className="flex items-center gap-1 text-gray-900 truncate">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate text-xs">{fornecedor.telefone}</span>
                            </div>
                          )}
                          {fornecedor.email && (
                            <div className="flex items-center gap-1 text-gray-600 truncate">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate text-xs">{fornecedor.email}</span>
                            </div>
                          )}
                          {fornecedor.contato && (
                            <div className="flex items-center gap-1 text-gray-600 truncate">
                              <User className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate text-xs">{fornecedor.contato}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fornecedor.cidade && fornecedor.estado ? (
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{fornecedor.cidade}, {fornecedor.estado}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          fornecedor.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setFornecedorParaCompra({ id: fornecedor.id, nome: fornecedor.nome })
                              setShowModalCompra(true)
                            }}
                            className="text-green-600 hover:text-green-900 p-1"
                            title="Adicionar compra"
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setShowDetails(showDetails === fornecedor.id ? null : fornecedor.id)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(fornecedor)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {fornecedor.ativo ? (
                            <button
                              onClick={() => handleDeleteFornecedor(fornecedor.id)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Desativar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => reactivateMutation.mutate(fornecedor.id)}
                              className="text-green-600 hover:text-green-900 p-1"
                              title="Reativar"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Layout mobile (cards) */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredFornecedores.map((fornecedor: Fornecedor) => (
                <div key={fornecedor.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {fornecedor.nome}
                        </h3>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 ${
                          fornecedor.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {fornecedor.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      
                      {fornecedor.razao_social && (
                        <p className="text-sm text-gray-500 mb-2">{fornecedor.razao_social}</p>
                      )}
                      
                      <div className="space-y-1 text-sm">
                        {fornecedor.cnpj && (
                          <div className="text-gray-400">{formatCNPJ(fornecedor.cnpj)}</div>
                        )}
                        
                        {fornecedor.telefone && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone className="h-3 w-3" />
                            {fornecedor.telefone}
                          </div>
                        )}
                        
                        {fornecedor.email && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{fornecedor.email}</span>
                          </div>
                        )}
                        
                        {fornecedor.contato && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <User className="h-3 w-3" />
                            {fornecedor.contato}
                          </div>
                        )}
                        
                        {fornecedor.cidade && fornecedor.estado && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <MapPin className="h-3 w-3" />
                            {fornecedor.cidade}, {fornecedor.estado}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => {
                          setFornecedorParaCompra({ id: fornecedor.id, nome: fornecedor.nome })
                          setShowModalCompra(true)
                        }}
                        className="text-green-600 hover:text-green-900 p-1"
                        title="Adicionar compra"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowDetails(showDetails === fornecedor.id ? null : fornecedor.id)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(fornecedor)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {fornecedor.ativo ? (
                        <button
                          onClick={() => handleDeleteFornecedor(fornecedor.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Desativar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivateMutation.mutate(fornecedor.id)}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Reativar"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Detalhes expandidos */}
      {showDetails && (
        <div className="mt-4 bg-white rounded-lg shadow p-6">
          {(() => {
            const fornecedor = filteredFornecedores.find((f: Fornecedor) => f.id === showDetails)
            if (!fornecedor) return null
            
            return (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Detalhes do Fornecedor
                  </h3>
                  <button
                    onClick={() => setShowDetails(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Nome</label>
                    <p className="text-sm text-gray-900">{fornecedor.nome}</p>
                  </div>
                  
                  {fornecedor.razao_social && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Razão Social</label>
                      <p className="text-sm text-gray-900">{fornecedor.razao_social}</p>
                    </div>
                  )}
                  
                  {fornecedor.cnpj && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">CNPJ</label>
                      <p className="text-sm text-gray-900">{formatCNPJ(fornecedor.cnpj)}</p>
                    </div>
                  )}
                  
                  {fornecedor.email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">E-mail</label>
                      <p className="text-sm text-gray-900">{fornecedor.email}</p>
                    </div>
                  )}
                  
                  {fornecedor.telefone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Telefone</label>
                      <p className="text-sm text-gray-900">{fornecedor.telefone}</p>
                    </div>
                  )}
                  
                  {fornecedor.contato && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Contato</label>
                      <p className="text-sm text-gray-900">{fornecedor.contato}</p>
                    </div>
                  )}
                  
                  {fornecedor.endereco && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500">Endereço</label>
                      <p className="text-sm text-gray-900">{fornecedor.endereco}</p>
                    </div>
                  )}
                  
                  {fornecedor.cidade && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Cidade</label>
                      <p className="text-sm text-gray-900">{fornecedor.cidade}</p>
                    </div>
                  )}
                  
                  {fornecedor.estado && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Estado</label>
                      <p className="text-sm text-gray-900">{fornecedor.estado}</p>
                    </div>
                  )}
                  
                  {fornecedor.cep && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">CEP</label>
                      <p className="text-sm text-gray-900">{fornecedor.cep}</p>
                    </div>
                  )}
                  
                  {fornecedor.observacoes && (
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-500">Observações</label>
                      <p className="text-sm text-gray-900">{fornecedor.observacoes}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome *
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        erros.nome 
                          ? 'border-red-300 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      required
                    />
                    {erros.nome && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {erros.nome}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      value={formData.razao_social}
                      onChange={(e) => setFormData({...formData, razao_social: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={formData.cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        erros.cnpj 
                          ? 'border-red-300 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    {erros.cnpj && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {erros.cnpj}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        erros.email 
                          ? 'border-red-300 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="exemplo@email.com"
                    />
                    {erros.email && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {erros.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={formData.telefone}
                      onChange={(e) => handleTelefoneChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:border-transparent ${
                        erros.telefone 
                          ? 'border-red-300 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contato Responsável
                    </label>
                    <input
                      type="text"
                      value={formData.contato}
                      onChange={(e) => setFormData({...formData, contato: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CEP
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={formData.endereco}
                      onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={formData.cidade}
                      onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado
                    </label>
                    <input
                      type="text"
                      value={formData.estado}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed"
                      placeholder="Estado"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
        </div>
      ) : (
        // ABA 2: COMPRAS DE FORNECEDOR
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
            <h2 className="text-xl font-bold text-gray-900">Notas de Compra Registradas</h2>
            <button
              onClick={() => setShowModalSelecionarFornecedor(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
            >
              <Plus className="h-5 w-5" />
              Adicionar Compra
            </button>
          </div>

          {compras.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Nenhuma compra registrada</p>
              <p className="text-sm">Clique em "Adicionar Compra" para registrar uma nova compra</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-1">
              {(compras as any[]).map((compra: any) => (
                <div key={compra.id} className="bg-white rounded-lg shadow-md border-l-4 border-green-600 hover:shadow-lg transition p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">Fornecedor</p>
                      <p className="text-sm font-medium text-gray-900">{compra.fornecedor_nome || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">Número Nota</p>
                      <p className="text-sm font-medium text-gray-900">{compra.numero_nota || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">Data Compra</p>
                      <p className="text-sm font-medium text-gray-900">
                        {compra.data_compra ? new Date(compra.data_compra).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 font-semibold">Usuário</p>
                      <p className="text-sm font-medium text-gray-900">{compra.usuario_nome || '-'}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-blue-50 p-4 rounded">
                        <p className="text-xs text-gray-600 font-semibold">Total Itens</p>
                        <p className="text-lg font-bold text-blue-600">
                          R$ {Number(compra.valor_total_itens || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded">
                        <p className="text-xs text-gray-600 font-semibold">Frete</p>
                        <p className="text-lg font-bold text-orange-600">
                          R$ {Number(compra.valor_frete || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-green-50 p-4 rounded">
                        <p className="text-xs text-gray-600 font-semibold">Total Geral</p>
                        <p className="text-lg font-bold text-green-600">
                          R$ {Number(compra.valor_total || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {compra.observacoes && (
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        <p className="text-xs text-gray-600 font-semibold mb-1">Observações</p>
                        <p className="text-gray-700">{compra.observacoes}</p>
                      </div>
                    )}

                    {compra.itens && compra.itens.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-600 font-semibold mb-3">Itens da Compra ({compra.itens.length})</p>
                        <div className="space-y-2">
                          {compra.itens.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                              <div>
                                <p className="font-medium text-gray-900">{item.produto_nome || 'Produto desconhecido'}</p>
                                <p className="text-xs text-gray-600">Qtd: {item.quantidade}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">R$ {Number(item.valor_total || 0).toFixed(2)}</p>
                                <p className="text-xs text-gray-600">Custo: R$ {Number(item.preco_custo_unitario || 0).toFixed(2)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botões de ação */}
                  <div className="mt-6 pt-4 border-t flex gap-3">
                    <button
                      onClick={() => handleVerDetalhesCompra(compra.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium text-sm"
                    >
                      <Eye className="h-4 w-4" />
                      Ver Detalhes
                    </button>
                    <button
                      onClick={() => handleDeleteCompra(compra.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de detalhes da compra */}
      {detalhesCompra && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Detalhes da Compra</h2>
                <p className="text-blue-100 text-sm mt-1">Nota: {detalhesCompra.numero_nota || 'Sem número'}</p>
              </div>
              <button
                onClick={() => setDetalhesCompra(null)}
                className="text-white hover:text-blue-100 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Fornecedor</label>
                  <p className="text-gray-900 font-semibold">{detalhesCompra.fornecedor_nome || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Número Nota</label>
                  <p className="text-gray-900 font-semibold">{detalhesCompra.numero_nota || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Data Compra</label>
                  <p className="text-gray-900 font-semibold">
                    {detalhesCompra.data_compra ? new Date(detalhesCompra.data_compra).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Usu??rio</label>
                  <p className="text-gray-900 font-semibold">{detalhesCompra.usuario_nome || '-'}</p>
                </div>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Total Itens</label>
                  <p className="text-2xl font-bold text-blue-600">
                    R$ {Number(detalhesCompra.valor_total_itens || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Frete</label>
                  <p className="text-2xl font-bold text-orange-600">
                    R$ {Number(detalhesCompra.valor_frete || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Total Geral</label>
                  <p className="text-2xl font-bold text-green-600">
                    R$ {Number(detalhesCompra.valor_total || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Observações */}
              {detalhesCompra.observacoes && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Observações</label>
                  <p className="text-gray-700">{detalhesCompra.observacoes}</p>
                </div>
              )}

              {/* Itens da compra */}
              {detalhesCompra.itens && detalhesCompra.itens.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Itens da Compra ({detalhesCompra.itens.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Produto</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Quantidade</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Preço Custo</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Preço Venda</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Margem</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {detalhesCompra.itens.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-sm font-medium text-gray-900">
                              {item.produto_nome || 'Produto desconhecido'}
                            </td>
                            <td className="px-6 py-3 text-sm text-right text-gray-600">{item.quantidade}</td>
                            <td className="px-6 py-3 text-sm text-right text-gray-600">
                              R$ {Number(item.preco_custo_unitario || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-3 text-sm text-right text-gray-600">
                              R$ {Number(item.preco_venda_unitario || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-3 text-sm text-right text-gray-600">
                              {item.margem_lucro ? `${Number(item.margem_lucro).toFixed(2)}%` : '-'}
                            </td>
                            <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                              R$ {Number(item.valor_total || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setDetalhesCompra(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    handleDeleteCompra(detalhesCompra.id)
                    setDetalhesCompra(null)
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Compra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Desativar fornecedor"
        message="Tem certeza que deseja desativar este fornecedor?"
        confirmText="Desativar"
        cancelText="Cancelar"
        onCancel={() => { setIsDeleteConfirmOpen(false); setIdToDelete(null) }}
        onConfirm={confirmDeleteFornecedor}
      />

      {/* Modal de seleção de fornecedor para compra */}
      {showModalSelecionarFornecedor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-50 border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Selecionar Fornecedor</h2>
                <p className="text-gray-600 text-sm mt-1">Escolha um fornecedor para adicionar uma compra</p>
              </div>
              <button
                onClick={() => setShowModalSelecionarFornecedor(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {fornecedores.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">Nenhum fornecedor disponível</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fornecedores.map((fornecedor: Fornecedor) => (
                    <button
                      key={fornecedor.id}
                      onClick={() => {
                        setFornecedorParaCompra({ id: fornecedor.id, nome: fornecedor.nome })
                        setShowModalCompra(true)
                        setShowModalSelecionarFornecedor(false)
                      }}
                      className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition"
                    >
                      <div className="font-semibold text-gray-900">{fornecedor.nome}</div>
                      {fornecedor.cnpj && (
                        <div className="text-xs text-gray-600 mt-1">CNPJ: {formatCNPJ(fornecedor.cnpj)}</div>
                      )}
                      {fornecedor.email && (
                        <div className="text-xs text-gray-600 mt-1">Email: {fornecedor.email}</div>
                      )}
                      {fornecedor.telefone && (
                        <div className="text-xs text-gray-600 mt-1">Telefone: {aplicarMascara('telefone', fornecedor.telefone)}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de compra de fornecedor */}
      {fornecedorParaCompra && (
        <ModalCompraFornecedor
          isOpen={showModalCompra}
          fornecedor_id={fornecedorParaCompra.id}
          fornecedor_nome={fornecedorParaCompra.nome}
          onClose={() => {
            setShowModalCompra(false)
            setFornecedorParaCompra(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] })
            queryClient.invalidateQueries({ queryKey: ['compras-fornecedor'] })
          }}
        />
      )}

      {/* Modal de confirmação de exclus??o de compra */}
      <ConfirmModal
        isOpen={isDeleteCompraConfirmOpen}
        title="Excluir compra"
        message="Tem certeza que deseja excluir esta compra de fornecedor? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        onCancel={() => {
          setIsDeleteCompraConfirmOpen(false)
          setIdCompraToDelete(null)
        }}
        onConfirm={confirmDeleteCompra}
      />
    </div>
  )
}

export default Fornecedores
