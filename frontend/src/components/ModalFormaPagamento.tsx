import { useState, useEffect } from 'react';
import { X, CreditCard } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { FormaPagamentoRateio } from '@/types/ordem-servico';

interface Maquina {
  id: number;
  nome: string;
  taxa_dinheiro: number;
  taxa_pix: number;
  taxa_debito: number;
  taxa_credito: number;
  eh_default: boolean;
}

interface ModalFormaPagamentoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (formasPagamento: FormaPagamentoRateio[], maquinaId?: number) => void;
  ordemNumero?: string;
  valorTotal?: number;
}

const FORMAS_PAGAMENTO = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
];

export default function ModalFormaPagamento({
  isOpen,
  onClose,
  onConfirm,
  ordemNumero,
  valorTotal = 0
}: ModalFormaPagamentoProps) {
  const [pagamentos, setPagamentos] = useState<Record<string, { selecionado: boolean; valor: string; numeroParcelas: number }>>({
    DINHEIRO: { selecionado: true, valor: '0.00', numeroParcelas: 1 },
    PIX: { selecionado: false, valor: '0.00', numeroParcelas: 1 },
    DEBITO: { selecionado: false, valor: '0.00', numeroParcelas: 1 },
    CREDITO: { selecionado: false, valor: '0.00', numeroParcelas: 1 },
  });
  const [erro, setErro] = useState('');
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [maquinaSelecionada, setMaquinaSelecionada] = useState<Maquina | null>(null);
  const [carregandoMaquinas, setCarregandoMaquinas] = useState(false);

  useEffect(() => {
    // Resetar valores quando abrir
    if (isOpen) {
      const total = Number.isFinite(valorTotal) ? Number(valorTotal || 0) : 0;
      setPagamentos({
        DINHEIRO: { selecionado: true, valor: total.toFixed(2), numeroParcelas: 1 },
        PIX: { selecionado: false, valor: '0.00', numeroParcelas: 1 },
        DEBITO: { selecionado: false, valor: '0.00', numeroParcelas: 1 },
        CREDITO: { selecionado: false, valor: '0.00', numeroParcelas: 1 },
      });
      setErro('');
      buscarMaquinas();
    }
  }, [isOpen, valorTotal]);

  const buscarMaquinas = async () => {
    setCarregandoMaquinas(true);
    try {
      const data = await apiFetch('/configuracoes/maquinas');
      // O endpoint retorna diretamente a lista
      const maquinasList = Array.isArray(data) ? data : (data.maquinas || []);
      setMaquinas(maquinasList);
      
      // Selecionar máquina padrão automaticamente
      const maquinaDefault = maquinasList.find((m: Maquina) => m.eh_default);
      setMaquinaSelecionada(maquinaDefault || maquinasList[0] || null);
    } catch (err) {
      console.error('Erro ao buscar máquinas:', err);
      setErro('Erro ao carregar máquinas');
    } finally {
      setCarregandoMaquinas(false);
    }
  };

  if (!isOpen) return null;

  const toNumber = (value: string): number => {
    const parsed = parseFloat((value || '0').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formasSelecionadas = FORMAS_PAGAMENTO
    .filter((forma) => pagamentos[forma.value]?.selecionado)
    .map((forma) => {
      const dados = pagamentos[forma.value];
      return {
        forma: forma.value as FormaPagamentoRateio['forma'],
        valor: toNumber(dados?.valor || '0'),
        numero_parcelas: forma.value === 'CREDITO' ? Math.max(1, dados?.numeroParcelas || 1) : 1,
      };
    })
    .filter((item) => item.valor > 0);

  const somaSelecionada = formasSelecionadas.reduce((acc, item) => acc + item.valor, 0);

  const calcularTaxaTotal = () => {
    if (!maquinaSelecionada) return 0;

    return formasSelecionadas.reduce((acc, item) => {
      const taxaPercentual = getTaxaPercentual(item.forma);
      return acc + ((item.valor * taxaPercentual) / 100);
    }, 0);
  };

  const handleSubmit = () => {
    if (formasSelecionadas.length === 0) {
      setErro('Selecione ao menos uma forma de pagamento com valor maior que zero');
      return;
    }

    if (!maquinaSelecionada) {
      setErro('Selecione uma máquina');
      return;
    }

    const diferenca = Math.abs(somaSelecionada - (valorTotal || 0));
    if (diferenca > 0.01) {
      setErro('A soma dos valores informados deve ser igual ao valor total da OS');
      return;
    }

    onConfirm(formasSelecionadas, maquinaSelecionada.id);
    handleClose();
  };

  const handleClose = () => {
    setErro('');
    onClose();
  };

  const getTaxaPercentual = (tipo: string): number => {
    if (!maquinaSelecionada) return 0;
    
    let taxa = 0;
    switch (tipo) {
      case 'DINHEIRO':
        taxa = maquinaSelecionada.taxa_dinheiro;
        break;
      case 'PIX':
        taxa = maquinaSelecionada.taxa_pix;
        break;
      case 'DEBITO':
        taxa = maquinaSelecionada.taxa_debito;
        break;
      case 'CREDITO':
        taxa = maquinaSelecionada.taxa_credito;
        break;
      default:
        taxa = 0;
    }
    
    // Garantir que é um número (em caso de vir como string do backend)
    return typeof taxa === 'number' ? taxa : parseFloat(String(taxa));
  };

  const calcularValorFinal = () => {
    return (valorTotal || 0) - calcularTaxaTotal();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
      <div className="relative top-20 mx-auto p-5 border max-w-md shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">
                Forma de Pagamento
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                OS #{ordemNumero}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="mt-4">
          {/* Valor Total */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Valor Total da OS:</div>
            <div className="text-xl font-bold text-gray-900">
              R$ {valorTotal?.toFixed(2).replace('.', ',')}
            </div>
          </div>

          {/* Seleção de Máquina */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione a máquina:
            </label>
            {carregandoMaquinas ? (
              <div className="p-3 text-center text-gray-500">Carregando máquinas...</div>
            ) : maquinas.length > 0 ? (
              <select
                value={maquinaSelecionada?.id || ''}
                onChange={(e) => {
                  const maq = maquinas.find(m => m.id === parseInt(e.target.value));
                  setMaquinaSelecionada(maq || null);
                  setErro('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {maquinas.map((maq) => (
                  <option key={maq.id} value={maq.id}>
                    {maq.nome} {maq.eh_default ? '(Padrão)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 text-center text-red-500">Nenhuma máquina disponível</div>
            )}
          </div>

          {/* Seleção de Forma de Pagamento */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Escolha as formas de pagamento e os valores:
            </label>
            <div className="space-y-2">
              {FORMAS_PAGAMENTO.map((forma) => (
                <div
                  key={forma.value}
                  className="p-3 border rounded-lg"
                  style={{
                    borderColor: pagamentos[forma.value]?.selecionado ? '#3b82f6' : '#e5e7eb',
                    backgroundColor: pagamentos[forma.value]?.selecionado ? '#f0f9ff' : 'transparent',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!pagamentos[forma.value]?.selecionado}
                      onChange={(e) => {
                        setPagamentos((prev) => ({
                          ...prev,
                          [forma.value]: {
                            ...prev[forma.value],
                            selecionado: e.target.checked,
                            valor: e.target.checked ? (prev[forma.value]?.valor || '0.00') : '0.00',
                          },
                        }));
                        setErro('');
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{forma.label}</div>
                      <div className="text-sm text-gray-500 mb-2">
                        Taxa: {getTaxaPercentual(forma.value).toFixed(2)}%
                      </div>

                      {pagamentos[forma.value]?.selecionado && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pagamentos[forma.value]?.valor || '0.00'}
                            onChange={(e) => {
                              setPagamentos((prev) => ({
                                ...prev,
                                [forma.value]: {
                                  ...prev[forma.value],
                                  valor: e.target.value,
                                },
                              }));
                              setErro('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Valor"
                          />

                          {forma.value === 'CREDITO' && (
                            <input
                              type="number"
                              min="1"
                              max="12"
                              value={pagamentos[forma.value]?.numeroParcelas || 1}
                              onChange={(e) => {
                                setPagamentos((prev) => ({
                                  ...prev,
                                  [forma.value]: {
                                    ...prev[forma.value],
                                    numeroParcelas: Math.max(1, parseInt(e.target.value, 10) || 1),
                                  },
                                }));
                                setErro('');
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Parcelas"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo de Valores */}
          {valorTotal > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-700">
                <div className="flex justify-between mb-1">
                  <span>Valor Total:</span>
                  <span>R$ {valorTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Total informado:</span>
                  <span>R$ {somaSelecionada.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Taxa estimada:</span>
                  <span>- R$ {calcularTaxaTotal().toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="border-t border-blue-200 pt-1 mt-1 flex justify-between font-semibold text-gray-900">
                  <span>Valor Faturado:</span>
                  <span>R$ {calcularValorFinal().toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem de Erro */}
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {erro}
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
