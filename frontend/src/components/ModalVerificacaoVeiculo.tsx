import React, { useState, useEffect } from 'react'
import { X, Car, AlertCircle, CheckCircle, XCircle, Eye } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { formatPlaca, validatePlaca, handlePlacaInput } from '../utils/placaMask'

interface VeiculoVerificacao {
  id: number
  placa: string
  marca: string
  modelo: string
  ano: number
  cor?: string
  km_atual: number
  combustivel?: string
  chassis?: string
  renavam?: string
  cliente_id: number
  cliente_nome: string
  ativo: boolean
}

interface ModalVerificacaoVeiculoProps {
  isOpen: boolean
  onClose: () => void
  onVeiculoEncontrado: (veiculo: VeiculoVerificacao) => void
  onCriarNovo: (placa: string, renavam?: string) => void
  onReativar: (veiculo: VeiculoVerificacao) => void
}

export default function ModalVerificacaoVeiculo({
  isOpen,
  onClose,
  onVeiculoEncontrado,
  onCriarNovo,
  onReativar
}: ModalVerificacaoVeiculoProps) {
  const [tipoBusca, setTipoBusca] = useState<'placa' | 'renavam'>('placa')
  const [termoBusca, setTermoBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{
    tipo: 'nenhum' | 'encontrado' | 'nao_encontrado' | 'inativo'
    veiculo?: VeiculoVerificacao
  }>({ tipo: 'nenhum' })
  const [erro, setErro] = useState('')
  

  // Limpar campos sempre que o modal abrir
  useEffect(() => {
    if (isOpen) {
      setTipoBusca('placa')
      setTermoBusca('')
      setResultado({ tipo: 'nenhum' })
      setErro('')
      setLoading(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleInputChange = (value: string) => {
    // Limpar resultado anterior
    setResultado({ tipo: 'nenhum' })
    setErro('')
    
    if (tipoBusca === 'placa') {
      handlePlacaInput(value, setTermoBusca)
    } else {
      // Para RENAVAM, apenas números
      const valorLimpo = value.replace(/\D/g, '')
      setTermoBusca(valorLimpo)
    }
  }

  const buscarVeiculo = async () => {
    if (!termoBusca.trim()) {
      setErro(`Por favor, informe ${tipoBusca === 'placa' ? 'uma placa' : 'um RENAVAM'}`)
      return
    }

    // Validar placa se for busca por placa
    if (tipoBusca === 'placa') {
      if (!validatePlaca(termoBusca)) {
        setErro('Placa deve estar no formato ABC-1234 ou ABC-1A23 (Mercosul)')
        return
      }
    }

    setLoading(true)
    setErro('')

    try {
      const endpoint = tipoBusca === 'placa' 
        ? `/veiculos/buscar-placa/${termoBusca.replace(/[^a-zA-Z0-9]/g, '')}`
        : `/veiculos/buscar-renavam/${termoBusca}`
      
      const response = await apiFetch(endpoint)
      
      if (response.encontrado) {
        const veiculo = response.veiculo
        
        if (veiculo.ativo) {
          setResultado({
            tipo: 'encontrado',
            veiculo
          })
        } else {
          setResultado({
            tipo: 'inativo',
            veiculo
          })
        }
      } else {
        setResultado({
          tipo: 'nao_encontrado'
        })
      }
    } catch (error) {
      console.error('Erro ao buscar veículo:', error)
      setErro('Erro ao consultar banco de dados')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      buscarVeiculo()
    }
  }

  const resetModal = () => {
    setTipoBusca('placa')
    setTermoBusca('')
    setResultado({ tipo: 'nenhum' })
    setErro('')
    setLoading(false)
  }

  // Nota: agora abrimos a edição/visualização via callback onVeiculoEncontrado

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold text-gray-900 flex items-center">
            <Car className="mr-2 h-4 w-4 text-blue-600" />
            Verificar Veículo
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">
            Antes de cadastrar um novo veículo, vamos verificar se ele já existe no sistema:
          </p>

          {/* Seletor de tipo de busca */}
          <div className="mb-3">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => {
                  setTipoBusca('placa')
                  setTermoBusca('')
                  setResultado({ tipo: 'nenhum' })
                  setErro('')
                }}
                className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                  tipoBusca === 'placa'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Por Placa
              </button>
              <button
                onClick={() => {
                  setTipoBusca('renavam')
                  setTermoBusca('')
                  setResultado({ tipo: 'nenhum' })
                  setErro('')
                }}
                className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${
                  tipoBusca === 'renavam'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Por RENAVAM
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tipoBusca === 'placa' ? 'Placa do Veículo' : 'RENAVAM'}
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={
                  tipoBusca === 'placa' 
                    ? "ABC-1234 ou ABC-1A23" 
                    : "Digite o RENAVAM..."
                }
                disabled={loading}
                maxLength={tipoBusca === 'placa' ? 8 : 11}
              />
              <button
                onClick={buscarVeiculo}
                disabled={loading}
                className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Buscar'
                )}
              </button>
            </div>
          </div>

          {erro && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span className="text-sm text-red-600">{erro}</span>
            </div>
          )}

          {resultado.tipo === 'encontrado' && resultado.veiculo && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-800">
                  Veículo encontrado no sistema!
                </span>
              </div>
              
              <div className="space-y-1 text-sm">
                <p><strong>Veículo:</strong> {resultado.veiculo.marca} {resultado.veiculo.modelo} {resultado.veiculo.ano}</p>
                <p><strong>Placa:</strong> {formatPlaca(resultado.veiculo.placa)}</p>
                <p><strong>Proprietário:</strong> {resultado.veiculo.cliente_nome}</p>
                {resultado.veiculo.cor && (
                  <p><strong>Cor:</strong> {resultado.veiculo.cor}</p>
                )}
              </div>

              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => onVeiculoEncontrado(resultado.veiculo!)}
                  className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center justify-center text-sm"
                >
                  <Eye className="mr-1 h-4 w-4" />
                  Abrir / Editar
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-200 text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-300 text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {resultado.tipo === 'inativo' && resultado.veiculo && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center mb-2">
                <XCircle className="h-4 w-4 text-yellow-600 mr-2" />
                <span className="text-sm font-medium text-yellow-800">
                  Veículo inativo encontrado
                </span>
              </div>
              
              <div className="space-y-1 text-sm">
                <p><strong>Veículo:</strong> {resultado.veiculo.marca} {resultado.veiculo.modelo} {resultado.veiculo.ano}</p>
                <p><strong>Placa:</strong> {formatPlaca(resultado.veiculo.placa)}</p>
                <p><strong>Último Proprietário:</strong> {resultado.veiculo.cliente_nome}</p>
              </div>

              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => onReativar(resultado.veiculo!)}
                  className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-sm"
                >
                  Reativar Veículo
                </button>
                <button
                  onClick={() => onCriarNovo(termoBusca)}
                  className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 text-sm"
                >
                  Criar Novo
                </button>
              </div>
            </div>
          )}

          {resultado.tipo === 'nao_encontrado' && (
            <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-4 w-4 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-800">
                  Veículo não encontrado
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">
                {tipoBusca === 'placa' 
                  ? `Nenhum veículo com a placa "${termoBusca}" foi encontrado.`
                  : `Nenhum veículo com o RENAVAM "${termoBusca}" foi encontrado.`
                }
              </p>

              <button
                onClick={() => onCriarNovo(termoBusca)}
                className="w-full bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-sm"
              >
                Cadastrar Novo Veículo
              </button>
            </div>
          )}

          {/* Detalhes agora abertos via callback 'onVeiculoEncontrado' (abre edição no pai) */}
        </div>

        <div className="flex justify-between items-center p-3 border-t bg-gray-50">
          <button
            onClick={resetModal}
            className="text-sm text-blue-600 hover:text-blue-800"
            disabled={loading}
          >
            Limpar busca
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}