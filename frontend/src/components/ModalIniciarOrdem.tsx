import { useState, useEffect } from 'react';
import { Search, X, User, Car, Package, CheckCircle } from 'lucide-react';
import { ClienteBuscaResponse } from '../types/ordem-servico';
import ModalBuscaClienteVeiculo from './ModalBuscaClienteVeiculo';
import ModalCadastroCliente from './ModalCadastroCliente';
import ModalNovaOrdem from './ModalNovaOrdem';
import ModalCadastroVeiculo from './ModalCadastroVeiculo';

interface ModalIniciarOrdemProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type OpcaoVeiculo = 'USAR_EXISTENTE' | 'CADASTRAR_NOVO' | 'SEM_VEICULO';

interface VeiculoOpcoes {
  opcao: OpcaoVeiculo;
  veiculo_selecionado?: any;
}

export default function ModalIniciarOrdem({
  isOpen,
  onClose,
  onSuccess
}: ModalIniciarOrdemProps) {
  const [etapaAtual, setEtapaAtual] = useState<'BUSCA' | 'SELECAO_VEICULO' | 'NOVA_ORDEM'>('BUSCA');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBuscaResponse['cliente'] | null>(null);
  const [veiculoOpcoes, setVeiculoOpcoes] = useState<VeiculoOpcoes>({ opcao: 'USAR_EXISTENTE' });
  const [modalBusca, setModalBusca] = useState(false);
  const [modalCadastro, setModalCadastro] = useState(false);
  const [modalCadastroVeiculo, setModalCadastroVeiculo] = useState(false);
  const [termoBuscaAtual, setTermoBuscaAtual] = useState('');

  const resetarEstado = () => {
    setEtapaAtual('BUSCA');
    setClienteSelecionado(null);
    setVeiculoOpcoes({ opcao: 'USAR_EXISTENTE' });
    setModalBusca(false);
    setModalCadastro(false);
    setModalCadastroVeiculo(false);
    setTermoBuscaAtual('');
  };

  const handleClose = () => {
    resetarEstado();
    onClose();
  };

  const handleClienteEncontrado = (cliente: ClienteBuscaResponse['cliente']) => {
    setClienteSelecionado(cliente);
    setEtapaAtual('SELECAO_VEICULO');
  };

  const handleNovoCliente = (termoBusca = '') => {
    console.log('🎯 ModalIniciarOrdem - handleNovoCliente chamado com:', termoBusca);
    
    // Armazenar no localStorage como backup
    if (termoBusca && termoBusca.trim()) {
      localStorage.setItem('temp_termo_busca', termoBusca);
      console.log('💾 Salvando no localStorage:', termoBusca);
    }
    // Atualizar o termo primeiro. Se houver um termo não vazio, abriremos o modal
    // somente após o estado ser atualizado (useEffect abaixo). Isso evita que
    // o modal monte antes do prop `termoBusca` ser definido e perca o valor.
    setTermoBuscaAtual(termoBusca);

    // Se o termo estiver vazio, abrir imediatamente (comportamento esperado
    // quando o usuário clicou em "Cadastrar Novo Cliente" sem nenhum termo).
    if (!termoBusca || !termoBusca.trim()) {
      setModalCadastro(true);
    }
  };

  // Abrir o modal de cadastro somente após termoBuscaAtual ser atualizado com
  // um valor não vazio — isso garante que o prop `termoBusca` enviado ao
  // `ModalCadastroCliente` contenha o valor correto no momento do mount.
  useEffect(() => {
    if (termoBuscaAtual && termoBuscaAtual.trim()) {
      setModalCadastro(true);
    }
  }, [termoBuscaAtual]);

  const handleClienteCadastrado = (cliente: any) => {
    setClienteSelecionado(cliente);
    setModalCadastro(false);
    setEtapaAtual('SELECAO_VEICULO');
  };

  const handleSelecionarVeiculo = (opcao: OpcaoVeiculo, veiculo?: any) => {
    setVeiculoOpcoes({ opcao, veiculo_selecionado: veiculo });
    
    if (opcao === 'CADASTRAR_NOVO') {
      setModalCadastroVeiculo(true);
    } else {
      setEtapaAtual('NOVA_ORDEM');
    }
  };

  const handleVeiculoCadastrado = (veiculo: any) => {
    // Atualizar o cliente com o novo veículo
    if (clienteSelecionado) {
      const clienteAtualizado = {
        ...clienteSelecionado,
        veiculos: [...(clienteSelecionado.veiculos || []), veiculo]
      };
      setClienteSelecionado(clienteAtualizado);
      setVeiculoOpcoes({ opcao: 'USAR_EXISTENTE', veiculo_selecionado: veiculo });
    }
    setModalCadastroVeiculo(false);
    setEtapaAtual('NOVA_ORDEM');
  };

  const handleOrdemCriada = () => {
    resetarEstado();
    onSuccess();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Nova Ordem de Serviço</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Etapa 1: Busca do Cliente */}
          {etapaAtual === 'BUSCA' && (
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Encontrar Cliente
                </h3>
                <p className="text-gray-600 mb-6">
                  Primeiro, vamos localizar o cliente para esta ordem de serviço
                </p>
                
                <button
                  onClick={() => setModalBusca(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <User className="h-5 w-5" />
                  Buscar Cliente ou Veículo
                </button>
              </div>
            </div>
          )}

          {/* Etapa 2: Seleção do Veículo */}
          {etapaAtual === 'SELECAO_VEICULO' && clienteSelecionado && (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Cliente Selecionado</h3>
                    <p className="text-gray-600">{clienteSelecionado.nome}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900">Como proceder com o veículo?</h4>
                
                {/* Opção 1: Usar veículo existente */}
                {clienteSelecionado.veiculos && clienteSelecionado.veiculos.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="font-medium text-gray-800">Veículos cadastrados:</h5>
                    {clienteSelecionado.veiculos.map((veiculo) => (
                      <div
                        key={veiculo.id}
                        onClick={() => handleSelecionarVeiculo('USAR_EXISTENTE', veiculo)}
                        className="p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Car className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium">{veiculo.marca} {veiculo.modelo} {veiculo.ano}</p>
                            <p className="text-sm text-gray-600">
                              Placa: {veiculo.placa} • {veiculo.cor} • {veiculo.km_atual?.toLocaleString()} km
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Opção 2: Cadastrar novo veículo */}
                <div
                  onClick={() => handleSelecionarVeiculo('CADASTRAR_NOVO')}
                  className="p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Car className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Cadastrar novo veículo</p>
                      <p className="text-sm text-gray-600">O cliente trouxe um veículo diferente</p>
                    </div>
                  </div>
                </div>

                {/* Opção 3: Sem veículo (apenas venda) */}
                <div
                  onClick={() => handleSelecionarVeiculo('SEM_VEICULO')}
                  className="p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Venda de peças/produtos</p>
                      <p className="text-sm text-gray-600">Cliente não tem veículo, apenas comprando produtos</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setEtapaAtual('BUSCA')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de busca cliente/veículo */}
      <ModalBuscaClienteVeiculo
        isOpen={modalBusca}
        onClose={() => setModalBusca(false)}
        onClienteEncontrado={handleClienteEncontrado}
        onNovoCliente={handleNovoCliente}
      />

      {/* Modal de cadastro de cliente */}
      <ModalCadastroCliente
        isOpen={modalCadastro}
        onClose={() => setModalCadastro(false)}
        onSuccess={handleClienteCadastrado}
        termoBusca={termoBuscaAtual}
      />

      {/* Modal de cadastro de veículo */}
      {clienteSelecionado && (
        <ModalCadastroVeiculo
          isOpen={modalCadastroVeiculo}
          onClose={() => setModalCadastroVeiculo(false)}
          clienteId={clienteSelecionado.id}
          onSuccess={handleVeiculoCadastrado}
        />
      )}

      {/* Modal de nova ordem - só aparece na etapa final */}
      {etapaAtual === 'NOVA_ORDEM' && clienteSelecionado && (
        <ModalNovaOrdem
          isOpen={true}
          onClose={handleClose}
          cliente={{
            ...clienteSelecionado,
            // Modificar a lista de veículos baseado na opção selecionada
            veiculos: veiculoOpcoes.opcao === 'SEM_VEICULO' 
              ? [] 
              : veiculoOpcoes.opcao === 'USAR_EXISTENTE' && veiculoOpcoes.veiculo_selecionado
              ? [veiculoOpcoes.veiculo_selecionado]
              : clienteSelecionado.veiculos
          }}
          onSuccess={handleOrdemCriada}
        />
      )}
    </>
  );
}