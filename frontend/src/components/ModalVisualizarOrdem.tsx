import { useState, useEffect } from 'react';
import { X, User, Car, FileText, DollarSign, Package, Wrench, Printer } from 'lucide-react';
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

  const handleImprimir = () => {
    window.print();
  };

  return (
    <>
      <ModalCancelamento
        isOpen={modalCancelamentoAberto}
        onClose={handleFecharModalCancelamento}
        onConfirm={handleConfirmarCancelamento}
        ordemNumero={ordem?.numero}
      />

      {/* Layout de Impressão - Visível apenas ao imprimir */}
      <div className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .print-only, .print-only * {
              visibility: visible;
            }
            .print-only {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
            }
            .no-print {
              display: none !important;
            }
          }
          @media screen {
            .print-only {
              display: none;
            }
          }
        `}} />

        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          {/* Cabeçalho */}
          <div style={{ textAlign: 'center', marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #000' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
              ORDEM DE SERVIÇO
            </h1>
            <p style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
              Nº {ordem.numero}
            </p>
          </div>

          {/* Duas Colunas: Cliente/Veículo e Informações da Ordem */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Coluna Esquerda - Cliente e Veículo */}
            <div>
              {/* Cliente */}
              <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                  Cliente
                </h3>
                <p style={{ fontSize: '13px', margin: '5px 0', fontWeight: 'bold' }}>
                  {ordem.cliente_nome}
                </p>
              </div>

              {/* Veículo */}
              <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                  Veículo
                </h3>
                <div style={{ fontSize: '12px' }}>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Marca/Modelo:</strong> {ordem.veiculo_marca} {ordem.veiculo_modelo}
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong>Placa:</strong> {ordem.veiculo_placa}
                  </p>
                  {ordem.veiculo_ano && (
                    <p style={{ margin: '5px 0' }}>
                      <strong>Ano:</strong> {ordem.veiculo_ano}
                    </p>
                  )}
                  {ordem.km_veiculo && (
                    <p style={{ margin: '5px 0' }}>
                      <strong>KM:</strong> {ordem.km_veiculo.toLocaleString()} km
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna Direita - Informações da Ordem */}
            <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                Informações da Ordem
              </h3>
              <div style={{ fontSize: '12px' }}>
                <p style={{ margin: '8px 0' }}>
                  <strong>Status:</strong> {getStatusInfo(ordem.status || 'PENDENTE').label}
                </p>
                <p style={{ margin: '8px 0' }}>
                  <strong>Tipo:</strong> {TIPOS_ORDEM[ordem.tipo_ordem as keyof typeof TIPOS_ORDEM] || ordem.tipo_ordem}
                </p>
                <p style={{ margin: '8px 0' }}>
                  <strong>Data de Abertura:</strong> {ordem.data_abertura ? formatarData(ordem.data_abertura) : 'N/A'}
                </p>
                {ordem.data_ordem && (
                  <p style={{ margin: '8px 0' }}>
                    <strong>Data da Ordem:</strong> {formatarData(ordem.data_ordem)}
                  </p>
                )}
                {ordem.observacoes && (
                  <div style={{ marginTop: '12px' }}>
                    <strong>Observações:</strong>
                    <p style={{ margin: '5px 0', fontSize: '11px' }}>{ordem.observacoes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Descrição do Serviço */}
          {ordem.descricao_servico && (
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                Descrição do Serviço
              </h3>
              <p style={{ fontSize: '12px', margin: '5px 0', lineHeight: '1.6' }}>
                {ordem.descricao_servico}
              </p>
              <p style={{ fontSize: '13px', margin: '10px 0 0 0', fontWeight: 'bold' }}>
                Valor: R$ {parseFloat(String(ordem.valor_servico || 0)).toFixed(2).replace('.', ',')}
              </p>
            </div>
          )}

          {/* Itens da Ordem */}
          {ordem.itens && ordem.itens.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                Itens da Ordem
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Tipo</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>Descrição</th>
                    <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>Qtd</th>
                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd' }}>Valor Unit.</th>
                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd' }}>Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ordem.itens.map((item, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                        {item.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                        {item.descricao}
                        {item.observacoes && (
                          <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
                            {item.observacoes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                        {item.quantidade}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd' }}>
                        R$ {parseFloat(String(item.valor_unitario)).toFixed(2).replace('.', ',')}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>
                        R$ {parseFloat(String(item.valor_total)).toFixed(2).replace('.', ',')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Resumo Financeiro */}
          <div style={{ marginBottom: '30px', padding: '15px', border: '2px solid #000', borderRadius: '5px', backgroundColor: '#f9fafb' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textTransform: 'uppercase' }}>
              Resumo Financeiro
            </h3>
            <div style={{ fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Serviços:</span>
                <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(String(ordem.valor_servico || 0)).toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Peças/Produtos:</span>
                <span style={{ fontWeight: 'bold' }}>R$ {parseFloat(String(ordem.valor_pecas || 0)).toFixed(2).replace('.', ',')}</span>
              </div>
              {(ordem.valor_desconto || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#dc2626' }}>
                  <span>Desconto:</span>
                  <span style={{ fontWeight: 'bold' }}>-R$ {parseFloat(String(ordem.valor_desconto)).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '2px solid #000', marginTop: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>TOTAL:</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>R$ {parseFloat(String(ordem.valor_total)).toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          </div>

          {/* Assinatura */}
          <div style={{ marginTop: '40px', paddingTop: '60px', borderTop: '1px solid #000' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '12px', margin: '5px 0' }}>
                _____________________________________________
              </p>
              <p style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '5px' }}>
                Assinatura do Cliente
              </p>
              <p style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                {ordem.cliente_nome}
              </p>
            </div>
          </div>

          {/* Rodapé */}
          <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '10px', color: '#666', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
            <p>Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
          </div>
        </div>
      </div>
      
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 no-print">
      <div className="relative top-4 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white no-print">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 no-print">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              Ordem de Serviço #{ordem.numero}
            </h3>
            <p className="text-gray-600">
              {ordem.cliente_nome} • {ordem.veiculo_marca} {ordem.veiculo_modelo} - {ordem.veiculo_placa}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleImprimir} 
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Imprimir ordem de serviço"
            >
              <Printer className="h-5 w-5" />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
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
                
                {ordem.km_veiculo && (
                  <div>
                    <span className="text-sm text-gray-600">KM do Veículo:</span>
                    <p className="font-medium">{ordem.km_veiculo.toLocaleString()} km</p>
                  </div>
                )}
              </div>
              
              {ordem.observacoes && (
                <div className="mt-4">
                  <span className="text-sm text-gray-600">Observações:</span>
                  <p className="text-sm text-gray-900 mt-1">{ordem.observacoes}</p>
                </div>
              )}
            </div>

            {/* Descrição do Serviço e Valor */}
            {ordem.descricao_servico && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Wrench className="h-4 w-4 mr-2" />
                  Descrição do Serviço
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Descrição:</span>
                    <p className="text-sm text-gray-900 mt-1">{ordem.descricao_servico}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-600">Valor Cobrado:</span>
                    <p className="text-lg font-semibold text-green-600 mt-1">
                      R$ {parseFloat(String(ordem.valor_servico || 0)).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              </div>
            )}

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
        <div className="flex justify-end mt-6 pt-6 border-t no-print">
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