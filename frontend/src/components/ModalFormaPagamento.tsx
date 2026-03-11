import { useState, useEffect } from 'react';
import { X, CreditCard } from 'lucide-react';

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
  onConfirm: (formaPagamento: string, numeroParcelas: number, maquinaId?: number) => void;
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
  const [formaPagamento, setFormaPagamento] = useState('DINHEIRO');
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [erro, setErro] = useState('');
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [maquinaSelecionada, setMaquinaSelecionada] = useState<Maquina | null>(null);
  const [carregandoMaquinas, setCarregandoMaquinas] = useState(false);

  useEffect(() => {
    // Resetar valores quando abrir
    if (isOpen) {
      setFormaPagamento('DINHEIRO');
      setNumeroParcelas(1);
      setErro('');
      buscarMaquinas();
    }
  }, [isOpen]);

  const buscarMaquinas = async () => {
    setCarregandoMaquinas(true);
    try {
      const response = await fetch('http://localhost:8008/configuracoes/maquinas');
      if (!response.ok) throw new Error('Erro ao buscar máquinas');
      const data = await response.json();
      setMaquinas(data.maquinas || []);
      
      // Selecionar máquina padrão automaticamente
      const maquinaDefault = (data.maquinas || []).find((m: Maquina) => m.eh_default);
      setMaquinaSelecionada(maquinaDefault || (data.maquinas || [])[0] || null);
    } catch (err) {
      console.error('Erro ao buscar máquinas:', err);
      setErro('Erro ao carregar máquinas');
    } finally {
      setCarregandoMaquinas(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!formaPagamento.trim()) {
      setErro('Selecione uma forma de pagamento');
      return;
    }

    if (!maquinaSelecionada) {
      setErro('Selecione uma máquina');
      return;
    }

    if (formaPagamento === 'CREDITO' && numeroParcelas < 1) {
      setErro('Número de parcelas deve ser maior que zero');
      return;
    }

    onConfirm(formaPagamento, numeroParcelas, maquinaSelecionada.id);
    handleClose();
  };

  const handleClose = () => {
    setFormaPagamento('DINHEIRO');
    setNumeroParcelas(1);
    setErro('');
    onClose();
  };

  const getTaxaPercentual = (tipo: string): number => {
    if (!maquinaSelecionada) return 0;
    
    switch (tipo) {
      case 'DINHEIRO':
        return maquinaSelecionada.taxa_dinheiro;
      case 'PIX':
        return maquinaSelecionada.taxa_pix;
      case 'DEBITO':
        return maquinaSelecionada.taxa_debito;
      case 'CREDITO':
        return maquinaSelecionada.taxa_credito;
      default:
        return 0;
    }
  };

  const calcularTaxa = () => {
    const taxa = getTaxaPercentual(formaPagamento);
    return (valorTotal * taxa) / 100;
  };

  const calcularValorFinal = () => {
    return valorTotal - calcularTaxa();
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
              Escolha a forma de pagamento:
            </label>
            <div className="space-y-2">
              {FORMAS_PAGAMENTO.map((forma) => (
                <label key={forma.value} className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50" style={{
                  borderColor: formaPagamento === forma.value ? '#3b82f6' : '#e5e7eb',
                  backgroundColor: formaPagamento === forma.value ? '#f0f9ff' : 'transparent'
                }}>
                  <input
                    type="radio"
                    name="forma_pagamento"
                    value={forma.value}
                    checked={formaPagamento === forma.value}
                    onChange={(e) => {
                      setFormaPagamento(e.target.value);
                      setErro('');
                    }}
                    className="mt-1"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">{forma.label}</div>
                    <div className="text-sm text-gray-500">
                      Taxa: {getTaxaPercentual(forma.value).toFixed(2)}%
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Campo de Parcelas (visível apenas para CREDITO) */}
          {formaPagamento === 'CREDITO' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Parcelas:
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={numeroParcelas}
                onChange={(e) => {
                  setNumeroParcelas(Math.max(1, parseInt(e.target.value) || 1));
                  setErro('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                De 1 a 12 parcelas
              </div>
            </div>
          )}

          {/* Resumo de Valores */}
          {valorTotal > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-700">
                <div className="flex justify-between mb-1">
                  <span>Valor Total:</span>
                  <span>R$ {valorTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Taxa ({getTaxaPercentual(formaPagamento).toFixed(2)}%):</span>
                  <span>- R$ {calcularTaxa().toFixed(2).replace('.', ',')}</span>
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
