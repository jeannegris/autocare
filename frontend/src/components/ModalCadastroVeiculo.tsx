import { useState, useEffect, useRef } from 'react';
import { X, Car, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatPlaca, handlePlacaInput } from '../utils/placaMask';
import { useValidacao } from '../utils/validations';

interface ModalCadastroVeiculoProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: number;
  onSuccess: (veiculo: any) => void;
  placaPreenchida?: string;
}

interface VeiculoForm {
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string;
  combustivel: string;
  km_atual: number;
  chassis?: string;
  renavam?: string;
}

export default function ModalCadastroVeiculo({
  isOpen,
  onClose,
  clienteId,
  onSuccess,
  placaPreenchida = ''
}: ModalCadastroVeiculoProps) {
  const [formData, setFormData] = useState<VeiculoForm>({
    placa: '',
    marca: '',
    modelo: '',
    ano: new Date().getFullYear(),
    cor: '',
    combustivel: 'GASOLINA',
    km_atual: 0,
    chassis: '',
    renavam: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [placaExiste, setPlacaExiste] = useState(false);
  const [veiculoExistente, setVeiculoExistente] = useState<any>(null);

  // Hook de validação inline
  const { erros, validarCampo, limparErro, limparTodosErros } = useValidacao();

  // Refs para focar nos campos com erro
  const placaRef = useRef<HTMLInputElement>(null);
  const marcaRef = useRef<HTMLInputElement>(null);
  const modeloRef = useRef<HTMLInputElement>(null);

  // Preencher placa quando fornecida
  useEffect(() => {
    if (placaPreenchida) {
      setFormData(prev => ({ ...prev, placa: placaPreenchida }));
    }
  }, [placaPreenchida]);

  const handleInputChange = (field: keyof VeiculoForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpar erro geral e do campo específico
    if (erro) setErro('');
    limparErro(field);
    
    if (field === 'placa') {
      setPlacaExiste(false);
      setVeiculoExistente(null);
      // Validar placa em tempo real se tiver valor
      if (value && value.trim()) {
        validarCampo(field, value, 'placa');
      }
    }
    
    // Validar campos obrigatórios quando preenchidos
    if ((field === 'marca' || field === 'modelo') && value && value.trim()) {
      validarCampo(field, value, 'obrigatorio');
    }
  };

  const verificarPlaca = async () => {
    if (!formData.placa || formData.placa.length < 7) {
      return;
    }

    try {
      const response = await apiFetch('/ordens/buscar-veiculo', {
        method: 'POST',
        body: JSON.stringify({ placa: formData.placa })
      });

      if (response.encontrado) {
        setPlacaExiste(true);
        setVeiculoExistente(response);
        
        // Verificar se o veículo já pertence ao cliente atual
        if (response.cliente?.id === clienteId) {
          setErro('Esta placa de veículo já pertence a este cliente.');
        } else {
          setErro('Este veículo já está cadastrado! Verifique se pertence ao cliente correto.');
        }
      } else {
        // Limpar estados se não encontrou veículo
        setPlacaExiste(false);
        setVeiculoExistente(null);
        setErro('');
      }
    } catch (error) {
      console.error('Erro ao verificar placa:', error);
      // Limpar estados em caso de erro na busca
      setPlacaExiste(false);
      setVeiculoExistente(null);
      setErro('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErro('');
    limparTodosErros();

    try {
      let formValido = true;
      let primeiroCampoComErro = '';

      // Validar placa (obrigatória)
      if (!formData.placa.trim()) {
        validarCampo('placa', formData.placa, 'placa');
        if (!primeiroCampoComErro) primeiroCampoComErro = 'placa';
        formValido = false;
      } else {
        if (!validarCampo('placa', formData.placa, 'placa')) {
          if (!primeiroCampoComErro) primeiroCampoComErro = 'placa';
          formValido = false;
        }
      }
      
      // Validar marca (obrigatória)
      if (!formData.marca.trim()) {
        validarCampo('marca', formData.marca, 'obrigatorio');
        if (!primeiroCampoComErro) primeiroCampoComErro = 'marca';
        formValido = false;
      }

      // Validar modelo (obrigatório)
      if (!formData.modelo.trim()) {
        validarCampo('modelo', formData.modelo, 'obrigatorio');
        if (!primeiroCampoComErro) primeiroCampoComErro = 'modelo';
        formValido = false;
      }

      // Se a placa já existe, primeiro precisa transferir
      if (placaExiste && veiculoExistente) {
        setErro('Este veículo já existe. Use a opção de transferir propriedade.');
        setIsLoading(false);
        return;
      }

      // Se o formulário não é válido, focar no primeiro campo com erro
      if (!formValido) {
        // Focar no primeiro campo com erro
        setTimeout(() => {
          if (primeiroCampoComErro === 'placa' && placaRef.current) {
            placaRef.current.focus();
          } else if (primeiroCampoComErro === 'marca' && marcaRef.current) {
            marcaRef.current.focus();
          } else if (primeiroCampoComErro === 'modelo' && modeloRef.current) {
            modeloRef.current.focus();
          }
        }, 100);
        
        setErro('Erro de validação dos dados. Verifique os campos obrigatórios.');
        setIsLoading(false);
        return;
      }

      const payload = {
        cliente_id: clienteId,
        placa: formData.placa.toUpperCase(),
        marca: formData.marca.trim(),
        modelo: formData.modelo.trim(),
        ano: formData.ano,
        cor: formData.cor.trim(),
        combustivel: formData.combustivel,
        km_atual: formData.km_atual,
        chassis: formData.chassis?.trim() || null,
        renavam: formData.renavam?.trim() || null
      };

      const novoVeiculo = await apiFetch('/veiculos', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

  // Notificar sucesso e fechar o modal de cadastro (o pai mantém a OS aberta)
  onSuccess(novoVeiculo);
  onClose();
    } catch (error: any) {
      setErro(error.message || 'Erro ao cadastrar veículo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferirVeiculo = async () => {
    if (!veiculoExistente) return;
    
    setIsLoading(true);
    setErro('');

    try {
      // Obter o ID do veículo da estrutura de dados
      const veiculoId = veiculoExistente.veiculo?.id || veiculoExistente.id;
      
      const response = await apiFetch(`/veiculos/${veiculoId}/transferir-proprietario`, {
        method: 'PATCH',
        body: JSON.stringify({ novo_cliente_id: clienteId })
      });

  // Notificar sucesso e fechar este modal
  onSuccess(response.veiculo);
  onClose();
    } catch (error: any) {
      setErro(error.message || 'Erro ao transferir veículo');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Car className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Cadastrar Novo Veículo</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-red-800 font-medium">Erro</p>
              </div>
              <p className="text-red-700 mt-1">{erro}</p>
            </div>
          )}

          {placaExiste && veiculoExistente && (
            <div className={`rounded-md p-4 ${
              veiculoExistente.cliente?.id === clienteId 
                ? 'bg-blue-50 border border-blue-200' 
                : 'bg-orange-50 border border-orange-200'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className={`h-5 w-5 ${
                  veiculoExistente.cliente?.id === clienteId ? 'text-blue-600' : 'text-orange-600'
                }`} />
                <p className={`font-medium ${
                  veiculoExistente.cliente?.id === clienteId 
                    ? 'text-blue-800' 
                    : 'text-orange-800'
                }`}>
                  {veiculoExistente.cliente?.id === clienteId 
                    ? 'Este veículo já pertence a este cliente' 
                    : 'Veículo já cadastrado'
                  }
                </p>
              </div>
              
              <div className={`text-sm space-y-1 mb-4 ${
                veiculoExistente.cliente?.id === clienteId ? 'text-blue-700' : 'text-orange-700'
              }`}>
                <p><strong>Placa:</strong> {formatPlaca(veiculoExistente.veiculo?.placa || veiculoExistente.placa)}</p>
                <p><strong>Veículo:</strong> {veiculoExistente.veiculo?.marca || veiculoExistente.marca} {veiculoExistente.veiculo?.modelo || veiculoExistente.modelo} {veiculoExistente.veiculo?.ano || veiculoExistente.ano}</p>
                <p><strong>Cor:</strong> {veiculoExistente.veiculo?.cor || veiculoExistente.cor}</p>
                <p><strong>KM:</strong> {(veiculoExistente.veiculo?.km_atual || veiculoExistente.km_atual)?.toLocaleString()}</p>
                {veiculoExistente.cliente?.id !== clienteId && (
                  <p><strong>Proprietário atual:</strong> {veiculoExistente.cliente?.nome}</p>
                )}
              </div>

              <div className="space-y-2">
                {veiculoExistente.cliente?.id === clienteId ? (
                  // Veículo já pertence ao cliente - oferecer criar ordem diretamente
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        // Usar o veículo existente para criar a ordem
                        onSuccess(veiculoExistente.veiculo || veiculoExistente);
                        // NÃO chamar onClose() aqui - deixar o componente pai gerenciar
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Criar Ordem de Serviço com este Veículo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlacaExiste(false);
                        setVeiculoExistente(null);
                        setErro('');
                        setFormData(prev => ({ ...prev, placa: '' }));
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Cancelar - Buscar Outro Veículo
                    </button>
                  </>
                ) : (
                  // Veículo pertence a outro cliente - oferecer transferir
                  <>
                    <button
                      type="button"
                      onClick={handleTransferirVeiculo}
                      disabled={isLoading}
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      {isLoading ? 'Transferindo...' : 'Transferir para este Cliente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlacaExiste(false);
                        setVeiculoExistente(null);
                        setErro('');
                        setFormData(prev => ({ ...prev, placa: '' }));
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                    >
                      Cancelar - Buscar Outro Veículo
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Só mostrar campos se não encontrou veículo OU se veículo pertence a outro cliente */}
          {(!placaExiste || (veiculoExistente && veiculoExistente.cliente?.id !== clienteId)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Placa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Placa *
              </label>
              <input
                ref={placaRef}
                type="text"
                value={formData.placa}
                onChange={(e) => {
                  handlePlacaInput(e.target.value, (novaPlaca) => {
                    handleInputChange('placa', novaPlaca);
                  });
                }}
                onBlur={verificarPlaca}
                placeholder="ABC-1234 ou ABC1D23"
                maxLength={8}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.placa 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
              />
              {erros.placa && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.placa}
                </p>
              )}
            </div>

            {/* Marca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marca *
              </label>
              <input
                ref={marcaRef}
                type="text"
                value={formData.marca}
                onChange={(e) => handleInputChange('marca', e.target.value)}
                placeholder="Ex: Toyota, Honda, Fiat"
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.marca 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
              />
              {erros.marca && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.marca}
                </p>
              )}
            </div>

            {/* Modelo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modelo *
              </label>
              <input
                ref={modeloRef}
                type="text"
                value={formData.modelo}
                onChange={(e) => handleInputChange('modelo', e.target.value)}
                placeholder="Ex: Corolla, Civic, Uno"
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent ${
                  erros.modelo 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                required
              />
              {erros.modelo && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {erros.modelo}
                </p>
              )}
            </div>

            {/* Ano */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ano *
              </label>
              <input
                type="number"
                value={formData.ano}
                onChange={(e) => handleInputChange('ano', Number(e.target.value))}
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Cor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cor
              </label>
              <input
                type="text"
                value={formData.cor}
                onChange={(e) => handleInputChange('cor', e.target.value)}
                placeholder="Ex: Branco, Preto, Prata"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Combustível */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Combustível
              </label>
              <select
                value={formData.combustivel}
                onChange={(e) => handleInputChange('combustivel', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GASOLINA">Gasolina</option>
                <option value="ETANOL">Etanol</option>
                <option value="FLEX">Flex</option>
                <option value="DIESEL">Diesel</option>
                <option value="GNV">GNV</option>
                <option value="ELETRICO">Elétrico</option>
                <option value="HIBRIDO">Híbrido</option>
              </select>
            </div>

            {/* KM Atual */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                KM Atual
              </label>
              <input
                type="number"
                value={formData.km_atual}
                onChange={(e) => handleInputChange('km_atual', Number(e.target.value))}
                min="0"
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Chassis */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chassis (Opcional)
              </label>
              <input
                type="text"
                value={formData.chassis}
                onChange={(e) => handleInputChange('chassis', e.target.value.toUpperCase())}
                placeholder="17 dígitos"
                maxLength={17}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* RENAVAM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RENAVAM (Opcional)
              </label>
              <input
                type="text"
                value={formData.renavam}
                onChange={(e) => handleInputChange('renavam', e.target.value)}
                placeholder="11 dígitos"
                maxLength={11}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          )}

          {/* Footer - só mostrar se não encontrou veículo OU se veículo pertence a outro cliente */}
          {(!placaExiste || (veiculoExistente && veiculoExistente.cliente?.id !== clienteId)) && (
            <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || placaExiste}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Cadastrando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Cadastrar Veículo
                </>
              )}
            </button>
          </div>
          )}
        </form>
      </div>
    </div>
  );
}