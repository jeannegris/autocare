import React, { useState, useEffect } from 'react';
import { X, Save, User, Car, Calendar, Clock, FileText, Plus, Trash2, Package } from 'lucide-react';
import { OrdemServicoNova, ItemOrdemNova, ProdutoAutocomplete } from '../types/ordem-servico';
import AutocompleteProduto from './AutocompleteProduto';

interface ModalEditarOrdemProps {
  isOpen: boolean;
  onClose: () => void;
  ordem: OrdemServicoNova | null;
  onSave: (dadosAtualizados: Partial<OrdemServicoNova>) => void;
}

const STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
  { value: 'AGUARDANDO_PECA', label: 'Aguardando Peça' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando Aprovação' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

const TIPOS_ORDEM = [
  { value: 'VENDA', label: 'Vendas', description: 'Apenas Vendas' },
  { value: 'SERVICO', label: 'Serviço', description: 'Apenas Serviços' },
  { value: 'VENDA_SERVICO', label: 'Venda + Serviços', description: 'Vendas e Serviços' }
];

export default function ModalEditarOrdem({ 
  isOpen, 
  onClose, 
  ordem,
  onSave 
}: ModalEditarOrdemProps) {
  const [formData, setFormData] = useState({
    status: '',
    tipo_ordem: 'VENDA' as 'VENDA' | 'SERVICO' | 'VENDA_SERVICO',
    descricao_servico: '',
    observacoes: '',
    funcionario_responsavel: '',
    tempo_estimado_horas: '',
    km_veiculo: '',
    data_ordem: '',
    valor_servico: '',
    percentual_desconto: '',
    tipo_desconto: 'VENDA' as 'VENDA' | 'SERVICO' | 'TOTAL',
    itens: [] as ItemOrdemNova[],
  });

  useEffect(() => {
    if (ordem) {
      setFormData({
        status: ordem.status || 'PENDENTE',
        tipo_ordem: ordem.tipo_ordem,
        descricao_servico: ordem.descricao_servico || '',
        observacoes: ordem.observacoes || '',
        funcionario_responsavel: ordem.funcionario_responsavel || '',
        tempo_estimado_horas: ordem.tempo_estimado_horas ? String(ordem.tempo_estimado_horas) : '',
        km_veiculo: ordem.km_veiculo ? String(ordem.km_veiculo) : '',
        data_ordem: ordem.data_ordem ? 
          new Date(ordem.data_ordem).toISOString().split('T')[0] : '',
        valor_servico: ordem.valor_servico ? String(ordem.valor_servico) : '',
        percentual_desconto: ordem.percentual_desconto ? String(ordem.percentual_desconto) : '',
        tipo_desconto: ordem.tipo_desconto || 'VENDA',
        itens: ordem.itens || [],
      });
    }
  }, [ordem]);

  if (!isOpen || !ordem) return null;

  // Função para calcular totais
  const calcularTotais = () => {
    const valorServico = parseFloat(formData.valor_servico) || 0;
    const valorPecas = formData.itens
      .filter(item => item.tipo === 'PRODUTO')
      .reduce((sum, item) => sum + (parseFloat(String(item.valor_total)) || 0), 0);
    const subtotal = valorServico + valorPecas;
    
    const percentualDesconto = parseFloat(formData.percentual_desconto) || 0;
    let valorDesconto = 0;
    
    if (percentualDesconto > 0) {
      if (formData.tipo_desconto === 'VENDA') {
        valorDesconto = (valorPecas * percentualDesconto) / 100;
      } else if (formData.tipo_desconto === 'SERVICO') {
        valorDesconto = (valorServico * percentualDesconto) / 100;
      } else if (formData.tipo_desconto === 'TOTAL') {
        valorDesconto = (subtotal * percentualDesconto) / 100;
      }
    }
    
    const valorTotal = subtotal - valorDesconto;
    
    return { valorServico, valorPecas, subtotal, valorDesconto, valorTotal };
  };

  const { valorServico, valorPecas, subtotal, valorDesconto, valorTotal } = calcularTotais();

  // Função para adicionar item de produto
  const handleAddProduto = () => {
    const novoItem: ItemOrdemNova = {
      descricao: '',
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
      tipo: 'PRODUTO',
      observacoes: ''
    };
    
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, novoItem]
    }));
  };

  // Serviços são descritos no campo 'Descrição do Serviço' — não há botão para adicionar serviços

  // Função para remover item
  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  // Função para atualizar item
  const handleUpdateItem = (index: number, field: keyof ItemOrdemNova, value: any) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          // Recalcular valor total quando quantidade ou valor unitário mudam
          if (field === 'quantidade' || field === 'valor_unitario') {
            updatedItem.valor_total = (updatedItem.quantidade || 0) * (updatedItem.valor_unitario || 0);
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  // Função para selecionar produto no autocomplete
  const handleProdutoSelecionado = (index: number, produto: ProdutoAutocomplete) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            produto_id: produto.id,
            descricao: produto.nome,
            valor_unitario: produto.preco_venda,
            valor_total: item.quantidade * produto.preco_venda
          };
        }
        return item;
      })
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const dadosParaAtualizar: Partial<OrdemServicoNova> = {
      status: formData.status,
      tipo_ordem: formData.tipo_ordem,
      descricao_servico: formData.descricao_servico,
      observacoes: formData.observacoes,
      funcionario_responsavel: formData.funcionario_responsavel,
      // Converter vírgula para ponto antes de parseFloat
      valor_servico: parseFloat(String(formData.valor_servico).replace(',', '.')) || 0,
      percentual_desconto: parseFloat(formData.percentual_desconto) || 0,
      tipo_desconto: formData.tipo_desconto,
      itens: formData.itens.map(it => ({
        ...it,
        quantidade: Number(it.quantidade) || 0,
        valor_unitario: Number(it.valor_unitario) || 0,
        valor_total: Number(it.valor_total) || (Number(it.quantidade) * Number(it.valor_unitario) || 0)
      })),
    };

    // Só incluir campos numéricos se tiverem valor
    if (formData.tempo_estimado_horas) {
      dadosParaAtualizar.tempo_estimado_horas = parseFloat(formData.tempo_estimado_horas);
    }
    if (formData.km_veiculo) {
      dadosParaAtualizar.km_veiculo = parseInt(formData.km_veiculo);
    }
    if (formData.data_ordem) {
      dadosParaAtualizar.data_ordem = formData.data_ordem + 'T12:00:00';
    }

    onSave(dadosParaAtualizar);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Determinar quais tipos de itens mostrar
  const mostrarProdutos = formData.tipo_ordem === 'VENDA' || formData.tipo_ordem === 'VENDA_SERVICO';
  const mostrarServicos = formData.tipo_ordem === 'SERVICO' || formData.tipo_ordem === 'VENDA_SERVICO';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border max-w-3xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Editar Ordem de Serviço #{ordem.numero}
            </h3>
            <p className="text-gray-600">
              {ordem.cliente_nome} • {ordem.veiculo_marca} {ordem.veiculo_modelo} - {ordem.veiculo_placa}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Ordem e Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Ordem
              </label>
              <select
                value={formData.tipo_ordem}
                onChange={(e) => handleChange('tipo_ordem', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {TIPOS_ORDEM.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label} - {tipo.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Funcionário Responsável e Data da Ordem */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Funcionário Responsável
              </label>
              <input
                type="text"
                value={formData.funcionario_responsavel}
                onChange={(e) => handleChange('funcionario_responsavel', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nome do funcionário responsável"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Data da Ordem
              </label>
              <input
                type="date"
                value={formData.data_ordem}
                onChange={(e) => handleChange('data_ordem', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Tempo Estimado e KM do Veículo - Não obrigatórios para VENDA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Tempo Estimado (horas)
                {mostrarServicos && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="number"
                step="1"
                value={formData.tempo_estimado_horas}
                onChange={(e) => handleChange('tempo_estimado_horas', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={mostrarServicos ? "1" : "0"}
                required={mostrarServicos}
                placeholder="Ex: 2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Car className="inline h-4 w-4 mr-1" />
                KM do Veículo
                {mostrarServicos && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="number"
                value={formData.km_veiculo}
                onChange={(e) => handleChange('km_veiculo', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                required={mostrarServicos}
                placeholder="Ex: 50000"
              />
            </div>
          </div>

          {/* Valor do Serviço moved below Descrição do Serviço to match layout requirement */}

          {/* Itens de Produto */}
          {mostrarProdutos && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  <Package className="inline h-4 w-4 mr-1" />
                  Itens de Produto
                </label>
                <button
                  type="button"
                  onClick={handleAddProduto}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar Produto
                </button>
              </div>
              
              {formData.itens.filter(item => item.tipo === 'PRODUTO').length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {formData.itens.map((item, index) => (
                    item.tipo === 'PRODUTO' && (
                      <div key={index} className="border rounded-md p-3 bg-blue-50">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Produto
                            </label>
                            {item.produto_id ? (
                              <div className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50">
                                {item.descricao || item.produto_nome || 'Produto não identificado'}
                              </div>
                            ) : (
                              <AutocompleteProduto
                                onSelect={(produto: ProdutoAutocomplete) => handleProdutoSelecionado(index, produto)}
                                placeholder="Digite o nome do produto..."
                              />
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Quantidade
                            </label>
                            <input
                              type="number"
                              value={Math.round(item.quantidade)}
                              onChange={(e) => handleUpdateItem(index, 'quantidade', parseInt(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              min="1"
                              step="1"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Valor Unit.
                            </label>
                            <div className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50">
                              R$ {Number(item.valor_unitario ?? 0).toFixed(2).replace('.', ',')}
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Total
                            </label>
                            <div className="text-sm font-medium text-green-600 py-1">
                              R$ {Number(item.valor_total ?? 0).toFixed(2).replace('.', ',')}
                            </div>
                          </div>
                          
                          <div className="w-1/2">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="w-full bg-red-500 text-white p-1 rounded hover:bg-red-600"
                              title="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Observações do item */}
                        <div className="mt-2">
                          <input
                            type="text"
                            value={item.observacoes || ''}
                            onChange={(e) => handleUpdateItem(index, 'observacoes', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            placeholder="Observações do item (opcional)..."
                          />
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Itens de Serviço */}
          {mostrarServicos && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Itens de Serviço Adicionais
                </label>
              </div>
              
              {formData.itens.filter(item => item.tipo === 'SERVICO').length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {formData.itens.map((item, index) => (
                    item.tipo === 'SERVICO' && (
                      <div key={index} className="border rounded-md p-3 bg-green-50">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Descrição do Serviço
                            </label>
                            <input
                              type="text"
                              value={item.descricao}
                              onChange={(e) => handleUpdateItem(index, 'descricao', e.target.value)}
                              placeholder="Ex: Ajuste de freios, limpeza..."
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Valor
                            </label>
                            <input
                              type="number"
                              value={item.valor_unitario}
                              onChange={(e) => {
                                const valor = parseFloat(e.target.value) || 0;
                                handleUpdateItem(index, 'valor_unitario', valor);
                                handleUpdateItem(index, 'valor_total', valor);
                              }}
                              onBlur={(e) => {
                                const valor = parseFloat(e.target.value) || 0;
                                handleUpdateItem(index, 'valor_unitario', valor);
                                handleUpdateItem(index, 'valor_total', valor);
                              }}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              min="0"
                              step="0.01"
                              placeholder="0,00"
                            />
                          </div>
                          
                          <div className="w-1/2">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="w-full bg-red-500 text-white p-1 rounded hover:bg-red-600"
                              title="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Descrição do Serviço */}
          {mostrarServicos && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="inline h-4 w-4 mr-1" />
                Descrição do Serviço
              </label>
              <textarea
                value={formData.descricao_servico}
                onChange={(e) => handleChange('descricao_servico', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Descreva o serviço a ser realizado..."
              />
            </div>
          )}

          {/* Valor do Serviço (moved here) */}
          {mostrarServicos && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor do Serviço (R$)
              </label>
              <input
                type="text"
                value={formData.valor_servico}
                onChange={(e) => {
                  // aceitar vírgula como separador durante edição
                  handleChange('valor_servico', e.target.value);
                }}
                onBlur={(e) => {
                  // Normalizar para número com ponto e então formatar para 2 casas com vírgula
                  const raw = e.target.value.replace(',', '.');
                  const valor = parseFloat(raw) || 0;
                  handleChange('valor_servico', valor.toFixed(2).replace('.', ','));
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                placeholder="0,00"
              />
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              value={formData.observacoes}
              onChange={(e) => handleChange('observacoes', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Observações adicionais..."
            />
          </div>

          {/* Campos de Desconto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Desconto (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.percentual_desconto}
                onChange={(e) => handleChange('percentual_desconto', e.target.value)}
                onBlur={(e) => {
                  const valor = parseFloat(e.target.value) || 0;
                  handleChange('percentual_desconto', valor.toFixed(2));
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                max="100"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aplicar Desconto Em
              </label>
              <select
                value={formData.tipo_desconto}
                onChange={(e) => handleChange('tipo_desconto', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {formData.tipo_ordem === 'VENDA' && (
                  <option value="VENDA">Venda</option>
                )}
                {formData.tipo_ordem === 'SERVICO' && (
                  <option value="SERVICO">Serviço</option>
                )}
                {formData.tipo_ordem === 'VENDA_SERVICO' && (
                  <>
                    <option value="VENDA">Venda</option>
                    <option value="SERVICO">Serviço</option>
                    <option value="TOTAL">Total (Venda + Serviço)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Resumo dos Valores */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Resumo dos Valores</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor dos Serviços:</span>
                  <p className="font-medium text-blue-600">R$ {Number(valorServico).toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor das Peças:</span>
                  <p className="font-medium text-green-600">R$ {Number(valorPecas).toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <p className="font-medium text-gray-600">R$ {Number(subtotal).toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
              <div className="space-y-2">
                {valorDesconto > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Desconto ({parseFloat(formData.percentual_desconto) || 0}%):</span>
                    <p className="font-medium text-red-600">-R$ {Number(valorDesconto).toFixed(2).replace('.', ',')}</p>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-900 font-bold">Valor Total:</span>
                  <p className="font-bold text-lg text-gray-900">R$ {Number(valorTotal).toFixed(2).replace('.', ',')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}