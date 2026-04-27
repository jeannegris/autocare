import { useState, useEffect } from 'react';
import { X, User, Car, FileText, DollarSign, Package, Wrench, Printer } from 'lucide-react';
import { FormaPagamentoRateio, OrdemServicoNova } from '../types/ordem-servico';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalCancelamento from './ModalCancelamento';
import ModalFormaPagamento from './ModalFormaPagamento';

interface ModalVisualizarOrdemProps {
  isOpen: boolean;
  onClose: () => void;
  ordem: OrdemServicoNova | null;
  onChangeStatus?: (novoStatus: string, motivoCancelamento?: string, statusData?: any) => void;
}

const STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente', color: 'text-yellow-700 bg-yellow-100' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento', color: 'text-blue-700 bg-blue-100' },
  { value: 'AGUARDANDO_PECA', label: 'Aguardando Peça', color: 'text-orange-700 bg-orange-100' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando Aprovação', color: 'text-purple-700 bg-purple-100' },
  { value: 'CONCLUIDA', label: 'Concluída', color: 'text-green-700 bg-green-100' },
  { value: 'CANCELADA', label: 'Cancelada', color: 'text-red-700 bg-red-100' },
];

const STATUS_ALIAS: Record<string, string> = {
  PENDENTE: 'PENDENTE',
  EMANDAMENTO: 'EM_ANDAMENTO',
  AGUARDANDOPECA: 'AGUARDANDO_PECA',
  AGUARDANDOPEA: 'AGUARDANDO_PECA',
  AGUARDANDOAPROVACAO: 'AGUARDANDO_APROVACAO',
  AGUARDANDOAPROVAAO: 'AGUARDANDO_APROVACAO',
  CONCLUIDA: 'CONCLUIDA',
  CONCLUDA: 'CONCLUIDA',
  CONCLUADA: 'CONCLUIDA',
  CANCELADA: 'CANCELADA',
};

const normalizeStatusValue = (status?: string | null) => {
  if (!status) return 'PENDENTE';

  const statusKey = status
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]+/g, '')
    .toUpperCase();

  return STATUS_ALIAS[statusKey] || status.toUpperCase().replace(/\s+/g, '_');
};

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
  const [novoStatus, setNovoStatus] = useState(normalizeStatusValue(ordem?.status));
  const [modalCancelamentoAberto, setModalCancelamentoAberto] = useState(false);
  const [modalFormaPagamentoAberto, setModalFormaPagamentoAberto] = useState(false);

  // Sincronizar novoStatus quando a ordem for atualizada
  useEffect(() => {
    if (ordem?.status) {
      setNovoStatus(normalizeStatusValue(ordem.status));
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
    return STATUS_OPTIONS.find(s => s.value === normalizeStatusValue(status)) || STATUS_OPTIONS[0];
  };

  const handleStatusChange = () => {
    if (!onChangeStatus || novoStatus === normalizeStatusValue(ordem.status)) return;

    // Se o novo status for CANCELADA, abrir modal para capturar motivo
    if (novoStatus === 'CANCELADA') {
      setModalCancelamentoAberto(true);
      return;
    }

    // Se o novo status for CONCLUIDA, abrir modal de forma de pagamento
    if (novoStatus === 'CONCLUIDA') {
      setModalFormaPagamentoAberto(true);
      return;
    }

    // Para outros status, atualizar diretamente
    onChangeStatus(novoStatus);
  };

  const handleConfirmarFormaPagamento = (formasPagamento: FormaPagamentoRateio[], maquinaId?: number) => {
    if (onChangeStatus) {
      // Passar forma de pagamento, número de parcelas e máquina como dados adicionais
      const statusData: any = { 
        status: 'CONCLUIDA',
        formas_pagamento: formasPagamento
      };

      if (formasPagamento.length === 1) {
        statusData.forma_pagamento = formasPagamento[0].forma;
        statusData.numero_parcelas = formasPagamento[0].numero_parcelas || 1;
      } else {
        statusData.forma_pagamento = 'MULTIPLO';
        statusData.numero_parcelas = 1;
      }

      // Adicionar maquina_id se foi selecionada
      if (maquinaId) {
        statusData.maquina_id = maquinaId;
      }
      onChangeStatus('CONCLUIDA', undefined, statusData);
    }
    setModalFormaPagamentoAberto(false);
  };

  const handleFecharModalFormaPagamento = () => {
    // Reverter o select para o status anterior
    setNovoStatus(normalizeStatusValue(ordem?.status));
    setModalFormaPagamentoAberto(false);
  };

  const handleConfirmarCancelamento = (motivo: string) => {
    if (onChangeStatus) {
      onChangeStatus('CANCELADA', motivo);
    }
    setModalCancelamentoAberto(false);
  };

  const handleFecharModalCancelamento = () => {
    // Reverter o select para o status anterior
    setNovoStatus(normalizeStatusValue(ordem?.status));
    setModalCancelamentoAberto(false);
  };

  const handleImprimir = () => {
    window.print();
  };

  const totalCliente = (() => {
    const valorServico = parseFloat(String(ordem.valor_servico || 0));
    const valorPecas = parseFloat(String(ordem.valor_pecas || 0));
    const valorDesconto = parseFloat(String(ordem.valor_desconto || 0));
    return valorServico + valorPecas - valorDesconto;
  })();

  const toMoney = (value?: number) => `R$ ${parseFloat(String(value || 0)).toFixed(2).replace('.', ',')}`;

  const pagamentoLabel = (forma?: string) => {
    if (forma === 'DINHEIRO') return 'Dinheiro';
    if (forma === 'PIX') return 'PIX';
    if (forma === 'DEBITO') return 'Debito';
    if (forma === 'CREDITO') return 'Credito';
    if (forma === 'MULTIPLO') return 'Multiplo';
    return 'Nao informado';
  };

  const extrairFormasPagamento = (formasRaw: unknown): FormaPagamentoRateio[] => {
    let lista: any[] = [];

    if (Array.isArray(formasRaw)) {
      lista = formasRaw;
    } else if (typeof formasRaw === 'string' && formasRaw.trim()) {
      try {
        const parsed = JSON.parse(formasRaw);
        if (Array.isArray(parsed)) {
          lista = parsed;
        }
      } catch {
        lista = [];
      }
    }

    return lista
      .map((item) => {
        const forma = item?.forma || item?.forma_pagamento;
        const valor = Number(item?.valor ?? item?.valor_pagamento ?? 0);
        const numeroParcelas = Number(item?.numero_parcelas ?? item?.numeroParcelas ?? 1);

        return {
          forma,
          valor,
          numero_parcelas: Number.isFinite(numeroParcelas) && numeroParcelas > 0 ? numeroParcelas : 1,
        } as FormaPagamentoRateio;
      })
      .filter((item) => !!item.forma && Number.isFinite(item.valor) && item.valor > 0);
  };

  const formasPagamento = extrairFormasPagamento((ordem as any).formas_pagamento);

  const detalhesPagamento = formasPagamento.length > 0
    ? formasPagamento.map((item) => ({
      descricao: pagamentoLabel(item.forma),
      valor: toMoney(item.valor),
      numeroParcelas: item.forma === 'CREDITO' ? (item.numero_parcelas || 1) : 1,
      forma: item.forma,
    }))
    : (ordem.forma_pagamento && ordem.forma_pagamento !== 'MULTIPLO'
      ? [{
          descricao: pagamentoLabel(ordem.forma_pagamento),
          valor: toMoney(totalCliente),
          numeroParcelas: ordem.forma_pagamento === 'CREDITO' ? (ordem.numero_parcelas || 1) : 1,
          forma: ordem.forma_pagamento,
        }]
      : []);

  const linhasDescricaoServico = (ordem.descricao_servico || '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  return (
    <>
      <ModalCancelamento
        isOpen={modalCancelamentoAberto}
        onClose={handleFecharModalCancelamento}
        onConfirm={handleConfirmarCancelamento}
        ordemNumero={ordem?.numero}
      />
      
      <ModalFormaPagamento
        isOpen={modalFormaPagamentoAberto}
        onClose={handleFecharModalFormaPagamento}
        onConfirm={handleConfirmarFormaPagamento}
        ordemNumero={ordem?.numero}
        valorTotal={parseFloat(String(ordem?.valor_total || 0))}
      />

      {/* Layout de Impressão - Visível apenas ao imprimir */}
      <div className="print-only">
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
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
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              max-width: 100%;
              margin: 0 auto;
              font-family: Arial, sans-serif;
              color: #111827;
              font-size: 10px;
              line-height: 1.2;
            }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              margin-bottom: 6px;
            }
            .print-table th,
            .print-table td {
              border: 1px solid #9ca3af;
              padding: 3px 5px;
              vertical-align: top;
              word-wrap: break-word;
            }
            .print-table th {
              background: #f3f4f6;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.2px;
            }
            .print-title {
              text-align: center;
              margin: 2px 0 6px 0;
            }
            .print-title h1 {
              margin: 0;
              font-size: 16px;
              font-weight: 700;
              letter-spacing: 0.4px;
            }
            .print-title p {
              margin: 1px 0 0 0;
              font-size: 12px;
              font-weight: 700;
            }
            .print-header {
              text-align: center;
              font-size: 11px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .signature-area {
              margin-top: 10px;
              text-align: center;
            }
            .signature-line {
              width: 260px;
              border-top: 1px solid #111827;
              margin: 16px auto 4px auto;
            }
            .avoid-break {
              page-break-inside: avoid;
            }
          }
          @media screen {
            .print-only {
              display: none;
            }
          }
        `}} />

        <div className="print-container">
          <div className="print-header">AutoCare - Sistema de Gestão em AutoCenter</div>

          <div className="print-title">
            <h1>ORDEM DE SERVIÇO</h1>
            <p>Nº {ordem.numero}</p>
          </div>

          <table className="print-table avoid-break">
            <tbody>
              <tr>
                <th style={{ width: '18%' }}>Cliente</th>
                <td style={{ width: '32%' }}>{ordem.cliente_nome || 'Não informado'}</td>
                <th style={{ width: '18%' }}>Telefone</th>
                <td style={{ width: '32%' }}>{ordem.cliente_telefone || 'Não informado'}</td>
              </tr>
              <tr>
                <th>E-mail</th>
                <td>{ordem.cliente_email || 'Não informado'}</td>
                <th>Placa</th>
                <td>{ordem.veiculo_placa || 'Não informado'}</td>
              </tr>
              <tr>
                <th>Veículo</th>
                <td>{`${ordem.veiculo_marca || ''} ${ordem.veiculo_modelo || ''}`.trim() || 'Não informado'}</td>
                <th>Ano / KM</th>
                <td>
                  {ordem.veiculo_ano || 'N/A'}
                  {' / '}
                  {ordem.km_veiculo ? `${ordem.km_veiculo.toLocaleString()} km` : 'N/A'}
                </td>
              </tr>
              <tr>
                <th>Tipo / Status</th>
                <td>
                  {(TIPOS_ORDEM[ordem.tipo_ordem as keyof typeof TIPOS_ORDEM] || ordem.tipo_ordem) || 'N/A'}
                  {' / '}
                  {getStatusInfo(ordem.status || 'PENDENTE').label}
                </td>
                <th>Abertura / Ordem</th>
                <td>
                  {ordem.data_abertura ? formatarData(ordem.data_abertura) : 'N/A'}
                  {' / '}
                  {ordem.data_ordem ? formatarData(ordem.data_ordem) : 'N/A'}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="print-table avoid-break">
            <thead>
              <tr>
                <th>Descrição do Serviço</th>
                {ordem.observacoes && <th style={{ width: '40%' }}>Observações</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {linhasDescricaoServico.length > 0
                    ? linhasDescricaoServico.map((linha, index) => (
                        <div key={`${index}-${linha}`}>{linha}</div>
                      ))
                    : 'Não informado'}
                </td>
                {ordem.observacoes && <td>{ordem.observacoes}</td>}
              </tr>
            </tbody>
          </table>

          {ordem.itens && ordem.itens.length > 0 && (
            <table className="print-table avoid-break">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Tipo</th>
                  <th style={{ width: '46%' }}>Item</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Qtd</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>Vl. Unit.</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>Vl. Total</th>
                </tr>
              </thead>
              <tbody>
                {ordem.itens.map((item, index) => (
                  <tr key={index}>
                    <td>{item.tipo === 'PRODUTO' ? 'Produto' : 'Serviço'}</td>
                    <td>
                      {item.descricao}
                      {item.observacoes ? ` (${item.observacoes})` : ''}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantidade}</td>
                    <td style={{ textAlign: 'right' }}>R$ {parseFloat(String(item.valor_unitario)).toFixed(2).replace('.', ',')}</td>
                    <td style={{ textAlign: 'right' }}>R$ {parseFloat(String(item.valor_total)).toFixed(2).replace('.', ',')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <table className="print-table avoid-break" style={{ width: '62%', marginLeft: 'auto' }}>
            <thead>
              <tr>
                <th colSpan={2}>Resumo Financeiro</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Serviços</td>
                <td style={{ textAlign: 'right' }}>R$ {parseFloat(String(ordem.valor_servico || 0)).toFixed(2).replace('.', ',')}</td>
              </tr>
              <tr>
                <td>Peças/Produtos</td>
                <td style={{ textAlign: 'right' }}>R$ {parseFloat(String(ordem.valor_pecas || 0)).toFixed(2).replace('.', ',')}</td>
              </tr>
              {(ordem.valor_desconto || 0) > 0 && (
                <tr>
                  <td>Desconto</td>
                  <td style={{ textAlign: 'right' }}>-R$ {parseFloat(String(ordem.valor_desconto || 0)).toFixed(2).replace('.', ',')}</td>
                </tr>
              )}
              {detalhesPagamento.length > 0 ? (
                detalhesPagamento.map((item, idx) => (
                  <tr key={`pagamento-${idx}`}>
                    <td>
                      {idx === 0 ? 'Forma de Pagamento' : 'Forma de Pagamento (continuação)'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.descricao}: {item.valor}
                      {item.forma === 'CREDITO' && item.numeroParcelas > 1 ? ` (${item.numeroParcelas}x)` : ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>Forma de Pagamento</td>
                  <td style={{ textAlign: 'right' }}>Não informado</td>
                </tr>
              )}
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>R$ {totalCliente.toFixed(2).replace('.', ',')}</td>
              </tr>
            </tbody>
          </table>

          <div className="signature-area avoid-break" style={{ marginTop: '32px' }}>
            <div className="signature-line" style={{ marginTop: '40px' }} />
            <div style={{ fontWeight: 700 }}>Assinatura do Cliente</div>
            <div style={{ marginTop: '2px' }}>{ordem.cliente_nome || ''}</div>
            <div style={{ marginTop: '6px', color: '#4b5563' }}>
              Documento gerado em {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </div>
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
                    <div className="text-sm text-gray-900 mt-1 space-y-1">
                      {linhasDescricaoServico.map((linha, index) => (
                        <div key={`${index}-${linha}`}>{linha}</div>
                      ))}
                    </div>
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

                {detalhesPagamento.map((item, idx) => (
                  <div key={`resumo-pagamento-${idx}`} className="flex justify-between">
                    <span className="text-gray-600">
                      Pagamento ({item.descricao}{item.forma === 'CREDITO' && item.numeroParcelas > 1 ? ` ${item.numeroParcelas}x` : ''}):
                    </span>
                    <span className="font-medium">{item.valor}</span>
                  </div>
                ))}

                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>R$ {totalCliente.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Forma de Pagamento */}
            {(ordem.forma_pagamento || formasPagamento.length > 0) && (
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Forma de Pagamento
                </h4>

                <div className="space-y-2 text-sm">
                  {detalhesPagamento.length > 0 ? (
                    detalhesPagamento.map((item, idx) => (
                      <p key={idx} className="font-medium">
                        {item.descricao}: {item.valor}
                        {item.forma === 'CREDITO' && item.numeroParcelas > 1 ? ` (${item.numeroParcelas}x)` : ''}
                      </p>
                    ))
                  ) : (
                    <p className="text-amber-700">Detalhamento de pagamento multiplo nao foi salvo nesta OS.</p>
                  )}
                </div>
              </div>
            )}

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