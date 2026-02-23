import React, { useState } from 'react';
import { Search, X, User, Phone, UserPlus, CheckCircle, AlertTriangle } from 'lucide-react';
import { ClienteBuscaResponse } from '../types/ordem-servico';
import { apiFetch } from '../lib/api';
import { formatPlaca } from '../utils/placaMask';
import { formatDocument, formatPhone } from '../utils/documentMask';

interface ModalBuscaNovoProprietarioProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteEncontrado: (cliente: ClienteBuscaResponse['cliente']) => void;
  // agora recebe opcionalmente o termo buscado para pré-preenchimento
  onCadastrarNovo: (termo?: string) => void;
  veiculo?: any;
  // callback para solicitar que o pai abra o fluxo de cadastro de veículo para o cliente
  onCadastrarVeiculoParaCliente?: (cliente: ClienteBuscaResponse['cliente'], veiculo?: any) => void;
  // proprietário atual do veículo (para validar transferência)
  proprietarioAtual?: ClienteBuscaResponse['cliente'];
}

export default function ModalBuscaNovoProprietario({
  isOpen,
  onClose,
  onClienteEncontrado,
  onCadastrarNovo,
  veiculo
  , onCadastrarVeiculoParaCliente,
  proprietarioAtual
}: ModalBuscaNovoProprietarioProps) {
  const [termoBusca, setTermoBusca] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<ClienteBuscaResponse | null>(null);
  const [erro, setErro] = useState('');
  const [mostrarAlertaMesmoDono, setMostrarAlertaMesmoDono] = useState(false);

  const handleBuscar = async () => {
    if (!termoBusca.trim()) {
      setErro('Digite um CPF, CNPJ ou telefone para buscar');
      return;
    }

    setIsLoading(true);
    setErro('');
    setResultado(null);

    try {
      const data: ClienteBuscaResponse = await apiFetch('/ordens/buscar-cliente', {
        method: 'POST',
        body: JSON.stringify({ termo_busca: termoBusca }),
      });
      setResultado(data);
    } catch (error) {
      setErro('Erro ao buscar cliente. Tente novamente.');
      console.error('Erro na busca:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelecionarCliente = () => {
    if (resultado?.cliente) {
      // Validar se o cliente selecionado é o mesmo proprietário atual
      if (proprietarioAtual && resultado.cliente.id === proprietarioAtual.id) {
        setMostrarAlertaMesmoDono(true);
        return;
      }
      
      onClienteEncontrado(resultado.cliente);
      onClose();
    }
  };

  const handleManterMesmoDono = () => {
    if (proprietarioAtual) {
      onClienteEncontrado(proprietarioAtual);
      onClose();
    }
  };

  const handleBuscarOutroDono = () => {
    setMostrarAlertaMesmoDono(false);
    limparBusca();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBuscar();
    }
  };

  const limparBusca = () => {
    setTermoBusca('');
    setResultado(null);
    setErro('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Buscar Novo Proprietário
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {veiculo && (
          <div className="px-6 py-3 bg-blue-50 border-b">
            <p className="text-sm text-blue-700">
              <strong>Veículo:</strong> {veiculo.marca} {veiculo.modelo} {veiculo.ano} - {formatPlaca(veiculo.placa)}
            </p>
          </div>
        )}

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Primeiro, vamos verificar se o novo proprietário já é cliente da loja:
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CPF, CNPJ ou Telefone do Novo Proprietário
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite o CPF, CNPJ ou telefone..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={handleBuscar}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Search className="h-4 w-4" />
              </button>
              {termoBusca && (
                <button
                  onClick={limparBusca}
                  className="text-gray-500 hover:text-gray-700 px-2 py-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Buscando cliente...</p>
            </div>
          )}

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-red-600 text-sm">{erro}</p>
            </div>
          )}

          {resultado && (
            <div className="space-y-4">
              {mostrarAlertaMesmoDono ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                    <h3 className="text-sm font-medium text-yellow-800">Mesmo Proprietário Detectado</h3>
                  </div>
                  
                  <p className="text-sm text-yellow-700 mb-4">
                    Você está tentando transferir o veículo para o mesmo proprietário atual: <strong>{proprietarioAtual?.nome}</strong>
                  </p>

                  <p className="text-sm text-gray-700 mb-4">
                    O que deseja fazer?
                  </p>

                  <div className="space-y-2">
                    <button
                      onClick={handleManterMesmoDono}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Manter o Mesmo Proprietário
                    </button>
                    
                    <button
                      onClick={handleBuscarOutroDono}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
                    >
                      <Search className="mr-2 h-4 w-4" />
                      Buscar Outro Proprietário
                    </button>
                  </div>
                </div>
              ) : resultado.encontrado ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <User className="h-4 w-4 text-green-600 mr-2" />
                    <h3 className="text-sm font-medium text-green-800">Cliente Encontrado!</h3>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <p><strong>Nome:</strong> {resultado.cliente?.nome}</p>
                    {resultado.cliente?.cpf_cnpj && (
                      <p><strong>CPF/CNPJ:</strong> {formatDocument(resultado.cliente.cpf_cnpj)}</p>
                    )}
                    {resultado.cliente?.telefone && (
                      <p className="flex items-center">
                        <Phone className="h-3 w-3 mr-1" />
                        {formatPhone(resultado.cliente.telefone)}
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    {/* Mostrar Transferir apenas se houver um veículo real vinculado (não temporário) */}
                    {veiculo && !(veiculo.novoVeiculo || veiculo.id === 0) && (
                      <button
                        onClick={handleSelecionarCliente}
                        className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Transferir Veículo para Este Cliente
                      </button>
                    )}

                    {/* Se o veículo é temporário (id===0 ou flag novoVeiculo), permitir cadastrar veículo para este cliente */}
                    {veiculo && (veiculo.novoVeiculo || veiculo.id === 0) && onCadastrarVeiculoParaCliente && (
                      <button
                        onClick={() => {
                          if (resultado?.cliente) {
                            console.log('MBNP: clicar Cadastrar Veículo para Este Cliente', { cliente: resultado.cliente, veiculo });
                            onCadastrarVeiculoParaCliente(resultado.cliente, veiculo);
                            onClose();
                          }
                        }}
                        className="w-full mt-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Cadastrar Veículo para Este Cliente
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <User className="h-4 w-4 text-yellow-600 mr-2" />
                    <h3 className="text-sm font-medium text-yellow-800">Cliente não encontrado</h3>
                  </div>
                  
                  <p className="text-sm text-yellow-700 mb-4">
                    Este cliente não está cadastrado no sistema.
                  </p>

                  <button
                    onClick={() => {
                      // encaminhar o termo atual para que o modal de cadastro possa pré-preencher
                      onCadastrarNovo(termoBusca);
                      onClose();
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Cadastrar Novo Cliente
                  </button>
                </div>
              )}
            </div>
          )}

          {!resultado && !isLoading && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm mb-4">
                Ou pule a busca e cadastre diretamente:
              </p>
              <button
                onClick={() => {
                  onCadastrarNovo();
                  onClose();
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center justify-center mx-auto"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Cadastrar Novo Cliente
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}