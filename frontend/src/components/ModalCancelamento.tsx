import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalCancelamentoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  ordemNumero?: string;
}

export default function ModalCancelamento({ 
  isOpen, 
  onClose, 
  onConfirm,
  ordemNumero 
}: ModalCancelamentoProps) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!motivo.trim()) {
      setErro('O motivo do cancelamento é obrigatório');
      return;
    }

    onConfirm(motivo);
    setMotivo('');
    setErro('');
  };

  const handleClose = () => {
    setMotivo('');
    setErro('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-[60]">
      <div className="relative top-20 mx-auto p-5 border max-w-md shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">
                Cancelar Ordem de Serviço
              </h3>
              {ordemNumero && (
                <p className="text-sm text-gray-500">OS #{ordemNumero}</p>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Ao cancelar esta ordem, todos os produtos serão devolvidos ao estoque.
                  Esta ação ficará registrada no histórico.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="motivo" className="block text-sm font-medium text-gray-700 mb-2">
              Motivo do Cancelamento *
            </label>
            <textarea
              id="motivo"
              rows={4}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErro('');
              }}
              className={`w-full border ${erro ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${erro ? 'focus:ring-red-500' : 'focus:ring-blue-500'} resize-none`}
              placeholder="Descreva o motivo do cancelamento desta ordem de serviço..."
            />
            {erro && (
              <p className="mt-1 text-sm text-red-600">{erro}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Seja claro e objetivo. Este motivo ficará registrado permanentemente.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Voltar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            Confirmar Cancelamento
          </button>
        </div>
      </div>
    </div>
  );
}
