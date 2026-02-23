import React, { useState, useEffect } from 'react';
import { Search, X, User, Phone, UserPlus, Car, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { ClienteBuscaResponse, VeiculoBuscaResponse } from '../types/ordem-servico';
import { apiFetch } from '../lib/api';
import { formatPlaca, handlePlacaInput } from '../utils/placaMask';
import { handleSmartDocumentOrPhoneInput, cleanDocumentForSubmit, cleanPhoneForSubmit, formatDocument, formatPhone } from '../utils/documentMask';
import ModalBuscaNovoProprietario from './ModalBuscaNovoProprietario';

interface ModalBuscaClienteVeiculoProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteEncontrado: (cliente: ClienteBuscaResponse['cliente'], veiculoPreSelecionado?: VeiculoBuscaResponse['veiculo']) => void;
  onNovoCliente: (termoBusca?: string) => void;
  // Agora aceita termo opcional para pré-preenchimento quando vem do fluxo de novo proprietário
  onTrocarProprietario?: (veiculo: VeiculoBuscaResponse['veiculo'], termo?: string) => void;
  // Permite que o modal de novo proprietário solicite cadastrar veículo diretamente para um cliente existente
  onCadastrarVeiculoParaCliente?: (cliente: ClienteBuscaResponse['cliente'], veiculo?: any) => void;
}

type TipoBusca = 'cliente' | 'veiculo';

export default function ModalBuscaClienteVeiculo({
  isOpen,
  onClose,
  onClienteEncontrado,
  onNovoCliente,
  onTrocarProprietario,
  onCadastrarVeiculoParaCliente
}: ModalBuscaClienteVeiculoProps) {
  const [tipoBusca, setTipoBusca] = useState<TipoBusca>('cliente');
  const [termoBusca, setTermoBusca] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultadoCliente, setResultadoCliente] = useState<ClienteBuscaResponse | null>(null);
  const [resultadoVeiculo, setResultadoVeiculo] = useState<VeiculoBuscaResponse | null>(null);
  const [erro, setErro] = useState('');
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [modalNovoProprietario, setModalNovoProprietario] = useState(false);

  const handleBuscar = async () => {
    if (!termoBusca.trim()) {
      setErro(tipoBusca === 'cliente' 
        ? 'Digite um CPF, CNPJ ou telefone para buscar' 
        : 'Digite uma placa para buscar'
      );
      return;
    }

    setIsLoading(true);
    setErro('');
    setResultadoCliente(null);
    setResultadoVeiculo(null);
    setMostrarConfirmacao(false);

    try {
      if (tipoBusca === 'cliente') {
        // Limpar máscara antes de enviar
        let termoLimpo = termoBusca;
        const somenteDigitos = termoBusca.replace(/\D/g, '');
        
        // Se tem formatação de documento ou telefone, limpar
        if (termoBusca.includes('.') || termoBusca.includes('-') || termoBusca.includes('/') || termoBusca.includes('(')) {
          if (somenteDigitos.length <= 11) {
            termoLimpo = cleanPhoneForSubmit(termoBusca);
          } else {
            termoLimpo = cleanDocumentForSubmit(termoBusca);
          }
        }
        
        const data: ClienteBuscaResponse = await apiFetch('/ordens/buscar-cliente', {
          method: 'POST',
          body: JSON.stringify({ termo_busca: termoLimpo }),
        });
        setResultadoCliente(data);
      } else {
        const data: VeiculoBuscaResponse = await apiFetch('/ordens/buscar-veiculo', {
          method: 'POST',
          body: JSON.stringify({ placa: termoBusca }),
        });
        setResultadoVeiculo(data);
        
        // Se encontrou veículo, mostrar confirmação de proprietário
        if (data.encontrado) {
          setMostrarConfirmacao(true);
        }
      }
    } catch (error) {
      setErro('Erro ao buscar. Tente novamente.');
      console.error('Erro na busca:', error);
    } finally {
      setIsLoading(false);
    }
  };



  const handleConfirmarProprietario = () => {
    if (resultadoVeiculo?.cliente) {
      // Passar o veículo encontrado pela placa como pré-selecionado
      onClienteEncontrado(resultadoVeiculo.cliente, resultadoVeiculo.veiculo);
      onClose();
    }
  };

  const handleTrocarProprietario = () => {
    setModalNovoProprietario(true);
  };

  const handleNovoProprietarioEncontrado = (cliente: ClienteBuscaResponse['cliente']) => {
    onClienteEncontrado(cliente);
    onClose();
  };

  const handleCadastrarNovoProprietario = (termoParaPreencher?: string) => {
    if (onTrocarProprietario) {
      // Se o veículo foi encontrado, usar os dados do veículo
      // Se não foi encontrado, criar um objeto temporário com a placa digitada
      const veiculo = resultadoVeiculo?.veiculo || {
        id: 0, // ID temporário para novo veículo
        placa: termoBusca,
        marca: '',
        modelo: '',
        ano: 0,
        cor: '',
        km_atual: 0,
        novoVeiculo: true // Flag para indicar que é um novo veículo
      };

      // Passar termo para o callback pai, para que o modal de cadastro possa pré-preencher
      onTrocarProprietario(veiculo, termoParaPreencher || termoBusca);
      onClose();
    }
  };

  const handleCadastrarVeiculoParaCliente = (cliente: ClienteBuscaResponse['cliente'], veiculoFromChild?: any) => {
    const veiculo = veiculoFromChild || resultadoVeiculo?.veiculo || {
      id: 0,
      placa: termoBusca,
      marca: '',
      modelo: '',
      ano: 0,
      cor: '',
      km_atual: 0,
      novoVeiculo: true
    };
    console.log('MBCV: handleCadastrarVeiculoParaCliente chamado', { cliente, veiculo, termoBusca });

    // Preferir explicitamente o handler de cadastro de veículo no pai, quando disponível.
    if (onCadastrarVeiculoParaCliente) {
      console.log('MBCV: chamando onCadastrarVeiculoParaCliente', { cliente, veiculo });
      onCadastrarVeiculoParaCliente(cliente, veiculo);
    } else if (onTrocarProprietario) {
      console.log('MBCV: repassando para onTrocarProprietario (fallback)', { veiculo, termo: termoBusca });
      onTrocarProprietario(veiculo, termoBusca);
    } else {
      // fallback global: emitir evento para que a página principal colete o pedido
      console.log('MBCV: onCadastrarVeiculoParaCliente ausente, emitindo evento global autocare:cadastrar-veiculo', { cliente, veiculo });
      try {
        window.dispatchEvent(new CustomEvent('autocare:cadastrar-veiculo', { detail: { cliente, veiculo } }));
      } catch (e) {
        console.warn('MBCV: falha ao emitir evento global', e);
      }
    }
  };

  const handleNovoCliente = () => {
    console.log('🔄 ModalBuscaClienteVeiculo - handleNovoCliente chamado');
    console.log('📤 termoBusca sendo enviado:', termoBusca);
    onNovoCliente(termoBusca);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBuscar();
    }
  };

  const limparBusca = () => {
    setTermoBusca('');
    setResultadoCliente(null);
    setResultadoVeiculo(null);
    setErro('');
    setMostrarConfirmacao(false);
    setModalNovoProprietario(false);
  };

  // Reset do modal quando abrir
  useEffect(() => {
    if (isOpen) {
      limparBusca();
      setTipoBusca('cliente');
    }
  }, [isOpen]);



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold flex items-center">
            <Search className="mr-2 h-4 w-4" />
            Buscar Cliente ou Veículo
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Seletor de tipo de busca */}
                    {/* Seletor de tipo de busca */}
          <div className="mb-3">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => {
                  setTipoBusca('cliente');
                  setTermoBusca('');
                  setResultadoCliente(null);
                  setResultadoVeiculo(null);
                  setErro('');
                  setMostrarConfirmacao(false);
                }}
                className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                  tipoBusca === 'cliente'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="mr-1 h-4 w-4" />
                Cliente
              </button>
              <button
                onClick={() => {
                  setTipoBusca('veiculo');
                  setTermoBusca('');
                  setResultadoCliente(null);
                  setResultadoVeiculo(null);
                  setErro('');
                  setMostrarConfirmacao(false);
                }}
                className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center ${
                  tipoBusca === 'veiculo'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Car className="mr-1 h-4 w-4" />
                Placa
              </button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tipoBusca === 'cliente' ? 'CPF, CNPJ ou Telefone' : 'Placa do Veículo'}
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => {
                  if (tipoBusca === 'veiculo') {
                    handlePlacaInput(e.target.value, setTermoBusca);
                  } else {
                    // Usar formatação inteligente que detecta CPF vs telefone
                    handleSmartDocumentOrPhoneInput(e.target.value, setTermoBusca);
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder={
                  tipoBusca === 'cliente' 
                    ? "Digite o CPF, CNPJ ou telefone..."
                    : "Digite a placa do veículo (ABC-1234)..."
                }
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
                maxLength={tipoBusca === 'veiculo' ? 8 : undefined}
              />
              <button
                onClick={handleBuscar}
                disabled={isLoading}
                className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Search className="h-4 w-4" />
              </button>
              {termoBusca && (
                <button
                  onClick={limparBusca}
                  className="text-gray-500 hover:text-gray-700 px-2 py-1.5"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">
                {tipoBusca === 'cliente' ? 'Buscando cliente...' : 'Buscando veículo...'}
              </p>
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-3">
              <p className="text-red-600 text-sm">{erro}</p>
            </div>
          )}

          {/* Resultado da busca por cliente */}
          {resultadoCliente && (
            <div className="space-y-3">
              {resultadoCliente.encontrado ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center mb-2">
                    <User className="h-4 w-4 text-green-600 mr-2" />
                    <h3 className="font-medium text-green-800 text-sm">Cliente Encontrado!</h3>
                  </div>
                  
                  <div className="space-y-1 text-sm mb-4">
                    <p><strong>Nome:</strong> {resultadoCliente.cliente?.nome}</p>
                    {resultadoCliente.cliente?.cpf_cnpj && (
                      <p><strong>CPF/CNPJ:</strong> {formatDocument(resultadoCliente.cliente.cpf_cnpj || '')}</p>
                    )}
                    {resultadoCliente.cliente?.telefone && (
                      <p className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {formatPhone(resultadoCliente.cliente.telefone || '')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-800 text-sm">Como proceder com o veículo?</h4>
                    
                    {/* Veículos cadastrados */}
                    {resultadoCliente.cliente?.veiculos && resultadoCliente.cliente.veiculos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700">Veículos cadastrados:</p>
                        {resultadoCliente.cliente.veiculos.map((veiculo) => (
                          <button
                            key={veiculo.id}
                            onClick={() => {
                              // Passar o veículo selecionado como segundo parâmetro
                              onClienteEncontrado(resultadoCliente.cliente!, veiculo);
                              onClose();
                            }}
                            className="w-full p-2 text-left bg-white border border-gray-200 rounded hover:border-blue-500 hover:bg-blue-50 transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-blue-600" />
                              <div>
                                <p className="font-medium text-sm">{veiculo.marca} {veiculo.modelo} {veiculo.ano}</p>
                                <p className="text-xs text-gray-600">
                                  Placa: {veiculo.placa} • {veiculo.cor} • {veiculo.km_atual?.toLocaleString()} km
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Cadastrar novo veículo */}
                    <button
                      onClick={() => {
                        // Manter o cliente mas indicar que precisa cadastrar novo veículo
                        const clienteSemVeiculos = {
                          ...resultadoCliente.cliente!,
                          veiculos: [],
                          precisaCadastrarVeiculo: true
                        };
                        onClienteEncontrado(clienteSemVeiculos);
                        onClose();
                      }}
                      className="w-full p-2 text-left bg-white border border-gray-200 rounded hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="font-medium text-sm">Cadastrar novo veículo</p>
                          <p className="text-xs text-gray-600">O cliente trouxe um veículo diferente</p>
                        </div>
                      </div>
                    </button>

                    {/* Venda sem veículo */}
                    <button
                      onClick={() => {
                        // Cliente sem veículos para venda apenas
                        const clienteSemVeiculos = {
                          ...resultadoCliente.cliente!,
                          veiculos: []
                        };
                        onClienteEncontrado(clienteSemVeiculos);
                        onClose();
                      }}
                      className="w-full p-2 text-left bg-white border border-gray-200 rounded hover:border-green-500 hover:bg-green-50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="font-medium text-sm">Venda de peças/produtos</p>
                          <p className="text-xs text-gray-600">Cliente não tem veículo, apenas comprando produtos</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex items-center mb-2">
                    <User className="h-4 w-4 text-yellow-600 mr-2" />
                    <h3 className="font-medium text-yellow-800 text-sm">Cliente não encontrado</h3>
                  </div>
                  
                  <p className="text-sm text-yellow-700 mb-3">
                    {resultadoCliente.message || 'Nenhum cliente foi encontrado com os dados informados.'}
                  </p>

                  <button
                    onClick={handleNovoCliente}
                    className="w-full bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 flex items-center justify-center"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Cadastrar Novo Cliente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Resultado da busca por veículo */}
          {resultadoVeiculo && (
            <div className="space-y-4">
              {resultadoVeiculo.encontrado ? (
                <div>
                  {/* Informações do veículo */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                    <div className="flex items-center mb-2">
                      <Car className="h-4 w-4 text-blue-600 mr-1" />
                      <h3 className="text-sm font-medium text-blue-800">Veículo Encontrado!</h3>
                    </div>
                    
                    <div className="space-y-1 text-xs">
                      <p><strong>Veículo:</strong> {resultadoVeiculo.veiculo?.marca} {resultadoVeiculo.veiculo?.modelo} {resultadoVeiculo.veiculo?.ano}</p>
                      <p><strong>Placa:</strong> {formatPlaca(resultadoVeiculo.veiculo?.placa || '')}</p>
                      {resultadoVeiculo.veiculo?.cor && (
                        <p><strong>Cor:</strong> {resultadoVeiculo.veiculo.cor}</p>
                      )}
                      <p><strong>KM:</strong> {resultadoVeiculo.veiculo?.km_atual?.toLocaleString()} km</p>
                    </div>
                  </div>

                  {/* Confirmação de proprietário */}
                  {mostrarConfirmacao && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <div className="flex items-center mb-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mr-1" />
                        <h3 className="text-sm font-medium text-yellow-800">Confirmar Proprietário</h3>
                      </div>
                      
                      <p className="text-xs text-yellow-700 mb-2">
                        Este veículo está cadastrado para:
                      </p>
                      
                      <div className="bg-white rounded p-2 mb-3">
                        <p className="text-sm font-medium">{resultadoVeiculo.cliente?.nome}</p>
                        {resultadoVeiculo.cliente?.cpf_cnpj && (
                          <p className="text-xs text-gray-600">CPF/CNPJ: {formatDocument(resultadoVeiculo.cliente.cpf_cnpj || '')}</p>
                        )}
                        {resultadoVeiculo.cliente?.telefone && (
                          <p className="text-xs text-gray-600">Tel: {formatPhone(resultadoVeiculo.cliente.telefone || '')}</p>
                        )}
                      </div>

                      <p className="text-xs text-yellow-700 mb-3">
                        O proprietário é o mesmo? Se não, você pode buscar ou cadastrar um novo cliente.
                      </p>

                      <div className="flex space-x-2">
                        <button
                          onClick={handleConfirmarProprietario}
                          className="flex-1 bg-green-600 text-white px-2 py-1.5 rounded-md hover:bg-green-700 flex items-center justify-center text-sm"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Sim, é o mesmo
                        </button>
                        <button
                          onClick={handleTrocarProprietario}
                          className="flex-1 bg-orange-600 text-white px-2 py-1.5 rounded-md hover:bg-orange-700 flex items-center justify-center text-sm"
                        >
                          <UserPlus className="mr-1 h-3 w-3" />
                          Novo proprietário
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-center mb-2">
                    <Car className="h-4 w-4 text-red-600 mr-2" />
                    <h3 className="font-medium text-red-800 text-sm">Veículo não encontrado</h3>
                  </div>
                  
                  <p className="text-sm text-red-700 mb-3">
                    {resultadoVeiculo.message || 'Nenhum veículo foi encontrado com essa placa.'}
                  </p>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    Vamos buscar o proprietário do veículo:
                  </p>

                  <button
                    onClick={handleTrocarProprietario}
                    className="w-full bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 flex items-center justify-center"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Buscar Proprietário do Veículo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 p-3 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Modal para buscar novo proprietário */}
      <ModalBuscaNovoProprietario
        isOpen={modalNovoProprietario}
        onClose={() => setModalNovoProprietario(false)}
        onClienteEncontrado={handleNovoProprietarioEncontrado}
        onCadastrarNovo={handleCadastrarNovoProprietario}
        // Se não houve veículo encontrado, passar um objeto temporário com a placa
        veiculo={
          resultadoVeiculo?.veiculo || (termoBusca ? {
            id: 0,
            placa: termoBusca,
            marca: '',
            modelo: '',
            ano: 0,
            cor: '',
            km_atual: 0,
            novoVeiculo: true
          } : undefined)
        }
        onCadastrarVeiculoParaCliente={handleCadastrarVeiculoParaCliente}
        proprietarioAtual={resultadoVeiculo?.cliente}
      />
    </div>
  );
}