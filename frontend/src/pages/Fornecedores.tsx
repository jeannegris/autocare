import * as React from 'react'
import { useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
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
  AlertCircle
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
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<FornecedorForm>(INITIAL_FORM_DATA)
  const [showDetails, setShowDetails] = useState<number | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [loadingCEP, setLoadingCEP] = useState(false)

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
      setShowModal(false)
      setEditingId(null)
      setFormData(INITIAL_FORM_DATA)
    }
    ,
    onError: (error: any) => {
      console.error('updateMutation.onError', error)
      // manter modal aberto para o usuário corrigir caso de erro
    }
  })


  // Estado do modal de confirmação de exclusão
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
    setEditingId(fornecedor.id)
    setFormData({
      nome: fornecedor.nome,
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
    })
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-gray-600 mt-1">Gerencie os fornecedores da oficina</p>
        </div>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Localização
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm space-y-1">
                          {fornecedor.telefone && (
                            <div className="flex items-center gap-1 text-gray-900">
                              <Phone className="h-3 w-3" />
                              {fornecedor.telefone}
                            </div>
                          )}
                          {fornecedor.email && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Mail className="h-3 w-3" />
                              {fornecedor.email}
                            </div>
                          )}
                          {fornecedor.contato && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <User className="h-3 w-3" />
                              {fornecedor.contato}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fornecedor.cidade && fornecedor.estado ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {fornecedor.cidade}, {fornecedor.estado}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
      {/* Modal de confirmação de exclusão (fora do map para manter JSX limpo) */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Desativar fornecedor"
        message="Tem certeza que deseja desativar este fornecedor?"
        confirmText="Desativar"
        cancelText="Cancelar"
        onCancel={() => { setIsDeleteConfirmOpen(false); setIdToDelete(null) }}
        onConfirm={confirmDeleteFornecedor}
      />
    </div>
  )
}

export default Fornecedores