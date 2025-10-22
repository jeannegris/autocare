import React, { useState } from 'react';
import { Search, X, User, Phone, FileText, UserPlus } from 'lucide-react';
import { ClienteBuscaResponse } from '../types/ordem-servico';
import { apiFetch } from '../lib/api';
import { formatDocument, formatPhone } from '../utils/documentMask';

interface ModalBuscaClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteEncontrado: (cliente: ClienteBuscaResponse['cliente']) => void;
  onNovoCliente: () => void;
}

export default function ModalBuscaCliente({
  isOpen,
  onClose,
  onClienteEncontrado,
  onNovoCliente
}: ModalBuscaClienteProps) {
  const [termoBusca, setTermoBusca] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<ClienteBuscaResponse | null>(null);
  const [erro, setErro] = useState('');

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
      onClienteEncontrado(resultado.cliente);
      onClose();
    }
  };

  const handleNovoCliente = () => {
    onNovoCliente();
    onClose();
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
          <h2 className="text-xl font-semibold flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Buscar Cliente
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CPF, CNPJ ou Telefone
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
              {resultado.encontrado ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <User className="h-5 w-5 text-green-600 mr-2" />
                    <h3 className="font-medium text-green-800">Cliente Encontrado!</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <p><strong>Nome:</strong> {resultado.cliente?.nome}</p>
                    {resultado.cliente?.cpf_cnpj && (
                      <p><strong>CPF/CNPJ:</strong> {formatDocument(resultado.cliente.cpf_cnpj)}</p>
                    )}
                    {resultado.cliente?.telefone && (
                      <p className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {formatPhone(resultado.cliente.telefone)}
                      </p>
                    )}
                    {resultado.cliente?.email && (
                      <p><strong>Email:</strong> {resultado.cliente.email}</p>
                    )}
                    
                    {resultado.cliente?.veiculos && resultado.cliente.veiculos.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="font-medium mb-2">Veículos:</p>
                        <div className="space-y-1">
                          {resultado.cliente.veiculos.map((veiculo) => (
                            <p key={veiculo.id} className="text-xs bg-white rounded px-2 py-1">
                              {veiculo.marca} {veiculo.modelo} {veiculo.ano} - {veiculo.placa}
                              <span className="text-gray-500 ml-2">{veiculo.km_atual?.toLocaleString()} km</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={handleSelecionarCliente}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Criar Ordem de Serviço
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-center mb-3">
                    <User className="h-5 w-5 text-yellow-600 mr-2" />
                    <h3 className="font-medium text-yellow-800">Cliente não encontrado</h3>
                  </div>
                  
                  <p className="text-sm text-yellow-700 mb-4">
                    {resultado.message || 'Nenhum cliente foi encontrado com os dados informados.'}
                  </p>

                  <button
                    onClick={handleNovoCliente}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Cadastrar Novo Cliente
                  </button>
                </div>
              )}
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