import React, { useState, useEffect } from 'react'
import { X, User, Building, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { validarCPFouCNPJ } from '../utils/validations'
import { handleSmartDocumentOrPhoneInput, formatDocument, formatPhone } from '../utils/documentMask'

interface ClienteVerificacao {
  id: number
  nome: string
  cpf_cnpj: string
  email: string
  telefone: string
  ativo: boolean
}

interface ModalVerificacaoClienteProps {
  isOpen: boolean
  onClose: () => void
  onClienteEncontrado: (cliente: ClienteVerificacao) => void
  onCriarNovo: (cpfCnpj: string, tipo: 'CPF' | 'CNPJ') => void
  onReativar: (cliente: ClienteVerificacao) => void
}

export default function ModalVerificacaoCliente({
  isOpen,
  onClose,
  onClienteEncontrado,
  onCriarNovo,
  onReativar
}: ModalVerificacaoClienteProps) {
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{
    tipo: 'nenhum' | 'encontrado' | 'nao_encontrado' | 'inativo'
    cliente?: ClienteVerificacao
    tipoDoc?: 'CPF' | 'CNPJ'
  }>({ tipo: 'nenhum' })
  const [erro, setErro] = useState('')

  // Limpar campos sempre que o modal abrir
  useEffect(() => {
    if (isOpen) {
      setCpfCnpj('')
      setResultado({ tipo: 'nenhum' })
      setErro('')
      setLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Limpar resultado anterior
    setResultado({ tipo: 'nenhum' })
    setErro('')
    
    // Usar a função inteligente que detecta CPF vs telefone
    handleSmartDocumentOrPhoneInput(value, setCpfCnpj)
  }

  const buscarCliente = async () => {
    if (!cpfCnpj.trim()) {
      setErro('Por favor, informe um CPF ou CNPJ')
      return
    }

    // Validar CPF/CNPJ
    const validacao = validarCPFouCNPJ(cpfCnpj)
    if (!validacao.valido) {
      setErro(validacao.mensagem)
      return
    }

    setLoading(true)
    setErro('')

    try {
      const response = await apiFetch(`/clientes/buscar-cpf-cnpj/${cpfCnpj.replace(/\D/g, '')}`)
      
      if (response.encontrado) {
        const cliente = response.cliente
        
        if (cliente.ativo) {
          setResultado({
            tipo: 'encontrado',
            cliente,
            tipoDoc: validacao.tipo!
          })
        } else {
          setResultado({
            tipo: 'inativo',
            cliente,
            tipoDoc: validacao.tipo!
          })
        }
      } else {
        setResultado({
          tipo: 'nao_encontrado',
          tipoDoc: validacao.tipo!
        })
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error)
      setErro('Erro ao consultar banco de dados')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      buscarCliente()
    }
  }

  const resetModal = () => {
    setCpfCnpj('')
    setResultado({ tipo: 'nenhum' })
    setErro('')
    setLoading(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const renderResultado = () => {
    switch (resultado.tipo) {
      case 'encontrado':
        return (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-green-800 mb-2">
                  Cliente Encontrado!
                </h4>
                <div className="bg-white p-4 rounded-md border border-green-200 mb-4">
                  <div className="flex items-center space-x-3 mb-3">
                    {resultado.tipoDoc === 'CPF' ? (
                      <User className="h-8 w-8 text-blue-600 bg-blue-100 rounded-full p-1.5" />
                    ) : (
                      <Building className="h-8 w-8 text-green-600 bg-green-100 rounded-full p-1.5" />
                    )}
                    <div>
                      <h5 className="font-semibold text-gray-900">{resultado.cliente?.nome}</h5>
                      <p className="text-sm text-gray-600">{formatDocument(resultado.cliente?.cpf_cnpj || '')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Email:</span>
                      <p className="text-gray-600">{resultado.cliente?.email}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Telefone:</span>
                      <p className="text-gray-600">{formatPhone(resultado.cliente?.telefone || '')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => resultado.cliente && onClienteEncontrado(resultado.cliente)}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium"
                  >
                    Ver Detalhes do Cliente
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case 'inativo':
        return (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">
                  Cliente Inativo Encontrado
                </h4>
                <div className="bg-white p-4 rounded-md border border-yellow-200 mb-4">
                  <div className="flex items-center space-x-3 mb-3">
                    {resultado.tipoDoc === 'CPF' ? (
                      <User className="h-8 w-8 text-blue-600 bg-blue-100 rounded-full p-1.5" />
                    ) : (
                      <Building className="h-8 w-8 text-green-600 bg-green-100 rounded-full p-1.5" />
                    )}
                    <div>
                      <h5 className="font-semibold text-gray-900">{resultado.cliente?.nome}</h5>
                      <p className="text-sm text-gray-600">{formatDocument(resultado.cliente?.cpf_cnpj || '')}</p>
                      <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full mt-1">
                        Inativo
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-yellow-700 mb-4">
                  Este cliente está inativo no sistema. Deseja reativá-lo?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => resultado.cliente && onReativar(resultado.cliente)}
                    className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors font-medium"
                  >
                    Reativar Cliente
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case 'nao_encontrado':
        return (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <XCircle className="h-6 w-6 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-blue-800 mb-2">
                  Cliente Não Encontrado
                </h4>
                <p className="text-blue-700 mb-4">
                  Não encontramos nenhum cliente com o {resultado.tipoDoc} informado.
                  Deseja cadastrar um novo cliente?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => onCriarNovo(cpfCnpj, resultado.tipoDoc!)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
                  >
                    Cadastrar Novo Cliente
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Verificação de Cliente
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Informe o CPF ou CNPJ do cliente
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Digite o documento para verificar se o cliente já está cadastrado no sistema.
            </p>
            <div className="flex space-x-3">
              <input
                type="text"
                value={cpfCnpj}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                className={`flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erro 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                maxLength={18}
                disabled={loading}
              />
              <button
                onClick={buscarCliente}
                disabled={loading || !cpfCnpj.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {erro && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {erro}
              </p>
            )}
          </div>

          {renderResultado()}
        </div>
      </div>
    </div>
  )
}