import { useState, useEffect } from 'react';
import { X, User, Car, FileText, DollarSign, Package, Wrench } from 'lucide-react';
import { OrdemServicoNova } from '../types/ordem-servico';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalCancelamento from './ModalCancelamento';

interface ModalVisualizarOrdemProps {
  isOpen: boolean;
  onClose: () => void;
  ordem: OrdemServicoNova | null;
  onChangeStatus?: (novoStatus: string, motivoCancelamento?: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente', color: 'text-yellow-700 bg-yellow-100' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'text-blue-700 bg-blue-100' },
  { value: 'AGUARDANDO_PECA', label: 'Aguardando Peça', color: 'text-orange-700 bg-orange-100' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando Aprovação', color: 'text-purple-700 bg-purple-100' },
  { value: 'CONCLUIDA', label: 'Concluída', color: 'text-green-700 bg-green-100' },
  { value: 'CANCELADA', label: 'Cancelada', color: 'text-red-700 bg-red-100' },
];

const TIPOS_ORDEM = {
  'VENDA': 'Venda',
  'SERVICO': 'Serviço',
  'VENDA_SERVICO': 'Venda + Serviço'
};

export default function ModalVisualizarOrdem({ 
  isOpen, 
  onClose, 
  ordem,
  onChangeStatus 
}: ModalVisualizarOrdemProps) {
  const [novoStatus, setNovoStatus] = useState(ordem?.status || '');
  const [modalCancelamentoAberto, setModalCancelamentoAberto] = useState(false);

  // Sincronizar novoStatus quando a ordem for atualizada
  useEffect(() => {
    if (ordem?.status) {
      setNovoStatus(ordem.status);
    }
  }, [ordem?.status]);

  if (!isOpen || !ordem) return null;

  const formatarData = (data: string) => {
    try {
      return format(new Date(data), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

  const handleStatusChange = () => {
    if (!onChangeStatus || novoStatus === ordem.status) return;

    // Se o novo status for CANCELADA, abrir modal para capturar motivo
    if (novoStatus === 'CANCELADA') {
      setModalCancelamentoAberto(true);
      return;
    }

    // Para outros status, atualizar diretamente
    onChangeStatus(novoStatus);
  };

  const handleConfirmarCancelamento = (motivo: string) => {
    if (onChangeStatus) {
      onChangeStatus('CANCELADA', motivo);
    }
    setModalCancelamentoAberto(false);
  };

  const handleFecharModalCancelamento = () => {
    // Reverter o select para o status anterior
    setNovoStatus(ordem?.status || '');
    setModalCancelamentoAberto(false);
  };

  return (
    <>
      <ModalCancelamento
        isOpen={modalCancelamentoAberto}
        onClose={handleFecharModalCancelamento}
        onConfirm={handleConfirmarCancelamento}
        ordemNumero={ordem?.numero}
      />
      
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              Ordem de Serviço #{ordem.numero}
            </h3>
            <p className="text-gray-600">
              {ordem.cliente_nome} • {ordem.veiculo_marca} {ordem.veiculo_modelo} - {ordem.veiculo_placa}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações Principais */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dados Gerais */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Informações da Ordem
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Tipo:</span>
                  <p className="font-medium">{TIPOS_ORDEM[ordem.tipo_ordem as keyof typeof TIPOS_ORDEM] || ordem.tipo_ordem}</p>
                </div>
                
                <div>
                  <span className="text-sm text-gray-600">Data de Abertura:</span>
                  <p className="font-medium">{ordem.data_abertura ? formatarData(ordem.data_abertura) : 'N/A'}</p>
                </div>
                
                {ordem.data_ordem && (
                  <div>
                    <span className="text-sm text-gray-600">Data da Ordem:</span>
                    <p className="font-medium">{formatarData(ordem.data_ordem)}</p>
                  </div>
                )}
                
                {ordem.funcionario_responsavel && (
                  <div>
                    <span className="text-sm text-gray-600">Responsável:</span>
                    <p className="font-medium">{ordem.funcionario_responsavel}</p>
                  </div>
                )}
                
                {ordem.km_veiculo && (
                  <div>
                    <span className="text-sm text-gray-600">KM do Veículo:</span>
                    <p className="font-medium">{ordem.km_veiculo.toLocaleString()} km</p>
                  </div>
                )}
              </div>
              
              {ordem.descricao_servico && (
                <div className="mt-4">
                  <span className="text-sm text-gray-600">Descrição do Serviço:</span>
                  <p className="text-sm text-gray-900 mt-1">{ordem.descricao_servico}</p>
                </div>
              )}
              
              {ordem.observacoes && (
                <div className="mt-4">
                  <span className="text-sm text-gray-600">Observações:</span>
                  <p className="text-sm text-gray-900 mt-1">{ordem.observacoes}</p>
                </div>
              )}
            </div>

            {/* Itens da Ordem */}
            {ordem.itens && ordem.itens.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Itens da Ordem ({ordem.itens.length})
                </h4>
                
                <div className="space-y-3">
                  {ordem.itens.map((item, index) => (
                    <div key={index} className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {item.tipo === 'PRODUTO' ? (
                              <Package className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Wrench className="h-4 w-4 text-green-600" />
                            )}
                            <span className="font-medium">{item.descricao}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              item.tipo === 'PRODUTO' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {item.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'}
                            </span>
                          </div>
                          {item.observacoes && (
                            <p className="text-sm text-gray-600 mt-1">{item.observacoes}</p>
                          )}
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span>Qtd: {item.quantidade}</span>
                            <span>×</span>
                            <span>R$ {parseFloat(String(item.valor_unitario)).toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="font-medium text-green-600">
                            R$ {parseFloat(String(item.valor_total)).toFixed(2).replace('.', ',')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Atual */}
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Status da Ordem</h4>
              
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${getStatusInfo(ordem.status || 'PENDENTE').color}`}>
                {getStatusInfo(ordem.status || 'PENDENTE').label}
              </div>
              
              {onChangeStatus && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alterar para:
                    </label>
                    <select
                      value={novoStatus}
                      onChange={(e) => setNovoStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {novoStatus !== ordem.status && (
                    <button
                      onClick={handleStatusChange}
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Atualizar Status
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Resumo Financeiro */}
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                Resumo Financeiro
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Serviços:</span>
                  <span className="font-medium">R$ {parseFloat(String(ordem.valor_servico || 0)).toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Peças/Produtos:</span>
                  <span className="font-medium">R$ {parseFloat(String(ordem.valor_pecas || 0)).toFixed(2).replace('.', ',')}</span>
                </div>
                {(ordem.valor_desconto || 0) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Desconto:</span>
                    <span className="font-medium">-R$ {parseFloat(String(ordem.valor_desconto)).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">R$ {parseFloat(String(ordem.valor_total)).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações do Cliente */}
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Cliente
              </h4>
              
              <div className="text-sm">
                <p className="font-medium">{ordem.cliente_nome}</p>
                {/* Aqui você pode adicionar mais informações do cliente se necessário */}
              </div>
            </div>

            {/* Informações do Veículo */}
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <Car className="h-4 w-4 mr-2" />
                Veículo
              </h4>
              
              <div className="text-sm space-y-1">
                <p><span className="text-gray-600">Marca/Modelo:</span> {ordem.veiculo_marca} {ordem.veiculo_modelo}</p>
                <p><span className="text-gray-600">Placa:</span> {ordem.veiculo_placa}</p>
                {ordem.veiculo_ano && <p><span className="text-gray-600">Ano:</span> {ordem.veiculo_ano}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
    </>
  );
}