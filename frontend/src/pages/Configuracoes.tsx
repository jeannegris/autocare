import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { Settings, Save, DollarSign, Lock, ShieldCheck, AlertTriangle, Wrench, Plus, Edit2, Trash2, CheckCircle, X } from 'lucide-react';

interface Configuracao {
  id: number;
  chave: string;
  valor: string;
  descricao: string;
  tipo: string;
}

interface SugestaoManutencao {
  id: number;
  nome_peca: string;
  km_media_troca: string;
  observacoes: string;
  intervalo_km_min: number | null;
  intervalo_km_max: number | null;
  tipo_servico: string | null;
  ativo: boolean;
  ordem_exibicao: number | null;
}

interface AplicarMargemRequest {
  margem_lucro: number;
  senha_supervisor: string;
}

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [margemLucro, setMargemLucro] = useState('');
  const [descontoMaximo, setDescontoMaximo] = useState('');
  const [senhaMargemLucro, setSenhaMargemLucro] = useState('');
  const [mostrarModalAplicarMargem, setMostrarModalAplicarMargem] = useState(false);
  const [mostrarModalSugestao, setMostrarModalSugestao] = useState(false);
  const [sugestaoEdit, setSugestaoEdit] = useState<SugestaoManutencao | null>(null);
  const [sugestaoParaDeletar, setSugestaoParaDeletar] = useState<SugestaoManutencao | null>(null);
  const [formSugestao, setFormSugestao] = useState({
    nome_peca: '',
    km_media_troca: '',
    observacoes: '',
    intervalo_km_min: '',
    intervalo_km_max: '',
    tipo_servico: '',
    ativo: true,
    ordem_exibicao: ''
  });

  // Query: buscar configurações
  const { data: configuracoes, isLoading } = useQuery<Configuracao[]>({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const response = await apiFetch('/configuracoes');
      return response;
    }
  });

  // Query: buscar sugestões de manutenção
  const { data: sugestoes, isLoading: isLoadingSugestoes } = useQuery<SugestaoManutencao[]>({
    queryKey: ['sugestoes-manutencao'],
    queryFn: async () => {
      const response = await apiFetch('/sugestoes-manutencao/?ativo=true');
      return response;
    }
  });

  // Mutation: atualizar senha do supervisor
  const mutationSenha = useMutation({
    mutationFn: async () => {
      if (novaSenha !== confirmarSenha) {
        throw new Error('As senhas não coincidem');
      }
      if (novaSenha.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      // Validar senha atual primeiro
      const validacao = await apiFetch('/configuracoes/validar-senha', {
        method: 'POST',
        body: JSON.stringify({ senha: senhaAtual })
      });

      if (!validacao.valida) {
        throw new Error('Senha atual incorreta');
      }

      // Atualizar senha
      await apiFetch('/configuracoes/senha_supervisor', {
        method: 'PUT',
        body: JSON.stringify({ valor: novaSenha })
      });
    },
    onSuccess: () => {
      toast.success('Senha do supervisor atualizada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar senha');
    }
  });

  // Mutation: atualizar configurações simples
  const mutationConfig = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      await apiFetch(`/configuracoes/${chave}`, {
        method: 'PUT',
        body: JSON.stringify({ valor })
      });
    },
    onSuccess: () => {
      toast.success('Configuração atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar configuração');
    }
  });

  // Mutation: aplicar margem de lucro
  const mutationAplicarMargem = useMutation({
    mutationFn: async (dados: AplicarMargemRequest) => {
      const response = await apiFetch('/configuracoes/aplicar-margem-lucro', {
        method: 'POST',
        body: JSON.stringify(dados)
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast.success(data.mensagem);
      setMostrarModalAplicarMargem(false);
      setSenhaMargemLucro('');
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao aplicar margem de lucro');
    }
  });

  // Mutation: criar/atualizar sugestão
  const mutationSugestao = useMutation({
    mutationFn: async () => {
      const payload = {
        nome_peca: formSugestao.nome_peca,
        km_media_troca: formSugestao.km_media_troca,
        observacoes: formSugestao.observacoes || null,
        intervalo_km_min: formSugestao.intervalo_km_min ? parseInt(formSugestao.intervalo_km_min) : null,
        intervalo_km_max: formSugestao.intervalo_km_max ? parseInt(formSugestao.intervalo_km_max) : null,
        tipo_servico: formSugestao.tipo_servico || null,
        ativo: formSugestao.ativo,
        ordem_exibicao: formSugestao.ordem_exibicao ? parseInt(formSugestao.ordem_exibicao) : null
      };

      if (sugestaoEdit) {
        return await apiFetch(`/sugestoes-manutencao/${sugestaoEdit.id}/`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        return await apiFetch('/sugestoes-manutencao/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
    },
    onSuccess: () => {
      toast.success(sugestaoEdit ? 'Sugestão atualizada com sucesso!' : 'Sugestão criada com sucesso!');
      setMostrarModalSugestao(false);
      setSugestaoEdit(null);
      queryClient.invalidateQueries({ queryKey: ['sugestoes-manutencao'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar sugestão');
    }
  });

  // Mutation: deletar sugestão
  const mutationDeletarSugestao = useMutation({
    mutationFn: async (sugestaoId: number) => {
      return await apiFetch(`/sugestoes-manutencao/${sugestaoId}/`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast.success('Sugestão excluída com sucesso!');
      setSugestaoParaDeletar(null);
      queryClient.invalidateQueries({ queryKey: ['sugestoes-manutencao'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir sugestão');
      setSugestaoParaDeletar(null);
    }
  });

  const handleSalvarDescontoMaximo = () => {
    mutationConfig.mutate({ 
      chave: 'desconto_maximo_os', 
      valor: descontoMaximo 
    });
  };

  const handleAplicarMargemLucro = () => {
    if (!margemLucro || parseFloat(margemLucro) <= 0) {
      toast.error('Informe uma margem de lucro válida');
      return;
    }
    setMostrarModalAplicarMargem(true);
  };

  const confirmarAplicarMargem = () => {
    if (!senhaMargemLucro) {
      toast.error('Informe a senha do supervisor');
      return;
    }

    mutationAplicarMargem.mutate({
      margem_lucro: parseFloat(margemLucro),
      senha_supervisor: senhaMargemLucro
    });
  };

  const handleSalvarSugestao = () => {
    if (!formSugestao.nome_peca || !formSugestao.km_media_troca) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    mutationSugestao.mutate();
  };

  // Preencher campos com valores atuais
  React.useEffect(() => {
    if (configuracoes) {
      const margemConfig = configuracoes.find(c => c.chave === 'margem_lucro_padrao');
      const descontoConfig = configuracoes.find(c => c.chave === 'desconto_maximo_os');
      
      if (margemConfig) setMargemLucro(margemConfig.valor);
      if (descontoConfig) setDescontoMaximo(descontoConfig.valor);
    }
  }, [configuracoes]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Settings className="mr-3 h-8 w-8 text-blue-600" />
          Configurações
        </h1>
      </div>

      {/* Card: Gestão de Usuários */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-2 flex items-center text-gray-800">
          <ShieldCheck className="mr-2 h-5 w-5 text-indigo-600" />
          Gestão de Usuários
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Acesse a tela de gerenciamento de usuários para criar novos usuários, alterar informações existentes, 
          habilitar/desabilitar autenticação de dois fatores (2FA), ativar ou desativar contas de usuários e 
          gerenciar permissões de acesso ao sistema.
        </p>
        <a
          href="/autocare/usuarios"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <ShieldCheck size={20} />
          Gerenciar Usuários
        </a>
      </div>

      {/* Card: Senha do Supervisor */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-800">
          <Lock className="mr-2 h-5 w-5 text-red-600" />
          Senha do Supervisor
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          A senha do supervisor é necessária para operações críticas como aplicar descontos acima do limite 
          e atualizar KM inferior ao atual do veículo.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha Atual
            </label>
            <input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite a senha atual"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nova Senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Repita a nova senha"
            />
          </div>
        </div>
        
        <button
          onClick={() => mutationSenha.mutate()}
          disabled={mutationSenha.isPending || !senhaAtual || !novaSenha || !confirmarSenha}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
        >
          <Save className="mr-2 h-4 w-4" />
          {mutationSenha.isPending ? 'Salvando...' : 'Atualizar Senha'}
        </button>
        
        <p className="text-xs text-gray-500 mt-2">
          <strong>Senha padrão inicial:</strong> admin123
        </p>
      </div>

      {/* Card: Configurações de Venda */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-800">
          <DollarSign className="mr-2 h-5 w-5 text-green-600" />
          Configurações de Venda
        </h2>

        {/* Margem de Lucro */}
        <div className="mb-6 pb-6 border-b">
          <h3 className="font-medium text-gray-700 mb-2">Margem de Lucro Padrão</h3>
          <p className="text-sm text-gray-600 mb-4">
            Define a margem de lucro padrão para novos produtos e permite aplicar em lote a todos os produtos existentes.
          </p>
          
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Margem de Lucro (%)
              </label>
              <input
                type="number"
                value={margemLucro}
                onChange={(e) => setMargemLucro(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 50"
                min="0"
                max="1000"
                step="0.01"
              />
            </div>
            <button
              onClick={handleAplicarMargemLucro}
              disabled={mutationAplicarMargem.isPending}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {mutationAplicarMargem.isPending ? 'Aplicando...' : 'Aplicar a Todos Produtos'}
            </button>
          </div>
          
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              <strong>Atenção:</strong> Ao aplicar, a margem será calculada sobre o preço de custo de todos 
              os produtos ativos no estoque. Esta ação requer senha do supervisor.
            </p>
          </div>
        </div>

        {/* Desconto Máximo */}
        <div>
          <h3 className="font-medium text-gray-700 mb-2">Desconto Máximo em Ordens de Serviço</h3>
          <p className="text-sm text-gray-600 mb-4">
            Descontos acima deste valor exigirão senha do supervisor para serem aplicados.
          </p>
          
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Desconto Máximo (%)
              </label>
              <input
                type="number"
                value={descontoMaximo}
                onChange={(e) => setDescontoMaximo(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 15"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <button
              onClick={handleSalvarDescontoMaximo}
              disabled={mutationConfig.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              <Save className="mr-2 h-4 w-4" />
              {mutationConfig.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Confirmar Aplicação de Margem */}
      {mostrarModalAplicarMargem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-red-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Confirmação Necessária
            </h3>
            
            <p className="text-sm text-gray-700 mb-4">
              Você está prestes a aplicar uma margem de lucro de <strong>{margemLucro}%</strong> em 
              todos os produtos ativos do estoque. Esta ação irá recalcular o preço de venda de todos os produtos.
            </p>
            
            <p className="text-sm font-medium text-gray-900 mb-2">
              Digite a senha do supervisor para confirmar:
            </p>
            
            <input
              type="password"
              value={senhaMargemLucro}
              onChange={(e) => setSenhaMargemLucro(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Senha do supervisor"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarModalAplicarMargem(false);
                  setSenhaMargemLucro('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAplicarMargem}
                disabled={mutationAplicarMargem.isPending}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {mutationAplicarMargem.isPending ? 'Aplicando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card: Sugestões de Manutenção Preventiva */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center text-gray-800">
            <Wrench className="mr-2 h-5 w-5 text-orange-600" />
            Tabela de Manutenção Preventiva
          </h2>
          <button
            onClick={() => {
              setSugestaoEdit(null);
              setFormSugestao({
                nome_peca: '',
                km_media_troca: '',
                observacoes: '',
                intervalo_km_min: '',
                intervalo_km_max: '',
                tipo_servico: '',
                ativo: true,
                ordem_exibicao: ''
              });
              setMostrarModalSugestao(true);
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 flex items-center text-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Sugestão
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Gerencie as sugestões de manutenção preventiva que serão exibidas no histórico de manutenções dos veículos.
        </p>

        {isLoadingSugestoes ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Carregando sugestões...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peça / Fluido
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KM Média para Troca
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Observações
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sugestoes && sugestoes.length > 0 ? (
                  sugestoes.map((sugestao) => (
                    <tr key={sugestao.id} className={!sugestao.ativo ? 'bg-gray-50 opacity-60' : ''}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {sugestao.nome_peca}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {sugestao.km_media_troca}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                        {sugestao.observacoes}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sugestao.ativo ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSugestaoEdit(sugestao);
                              setFormSugestao({
                                nome_peca: sugestao.nome_peca,
                                km_media_troca: sugestao.km_media_troca,
                                observacoes: sugestao.observacoes || '',
                                intervalo_km_min: sugestao.intervalo_km_min?.toString() || '',
                                intervalo_km_max: sugestao.intervalo_km_max?.toString() || '',
                                tipo_servico: sugestao.tipo_servico || '',
                                ativo: sugestao.ativo,
                                ordem_exibicao: sugestao.ordem_exibicao?.toString() || ''
                              });
                              setMostrarModalSugestao(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSugestaoParaDeletar(sugestao)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Nenhuma sugestão de manutenção cadastrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nova/Editar Sugestão */}
      {mostrarModalSugestao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-orange-600">
              <Wrench className="mr-2 h-5 w-5" />
              {sugestaoEdit ? 'Editar Sugestão de Manutenção' : 'Nova Sugestão de Manutenção'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Peça / Fluido *
                </label>
                <input
                  type="text"
                  value={formSugestao.nome_peca}
                  onChange={(e) => setFormSugestao({ ...formSugestao, nome_peca: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Óleo de motor (sintético)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KM Média para Troca *
                </label>
                <input
                  type="text"
                  value={formSugestao.km_media_troca}
                  onChange={(e) => setFormSugestao({ ...formSugestao, km_media_troca: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: 10.000 km ou 12 meses"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intervalo KM Mínimo
                  </label>
                  <input
                    type="number"
                    value={formSugestao.intervalo_km_min}
                    onChange={(e) => setFormSugestao({ ...formSugestao, intervalo_km_min: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 10000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Intervalo KM Máximo
                  </label>
                  <input
                    type="number"
                    value={formSugestao.intervalo_km_max}
                    onChange={(e) => setFormSugestao({ ...formSugestao, intervalo_km_max: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 10000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Serviço
                  </label>
                  <input
                    type="text"
                    value={formSugestao.tipo_servico}
                    onChange={(e) => setFormSugestao({ ...formSugestao, tipo_servico: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: óleo, filtro, vela"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    value={formSugestao.ordem_exibicao}
                    onChange={(e) => setFormSugestao({ ...formSugestao, ordem_exibicao: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formSugestao.observacoes}
                  onChange={(e) => setFormSugestao({ ...formSugestao, observacoes: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Use sempre o grau e tipo especificado pelo fabricante..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formSugestao.ativo}
                  onChange={(e) => setFormSugestao({ ...formSugestao, ativo: e.target.checked })}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Ativo (exibir nas sugestões)
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setMostrarModalSugestao(false);
                  setSugestaoEdit(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarSugestao}
                disabled={!formSugestao.nome_peca || !formSugestao.km_media_troca}
                className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Save className="mr-2 h-4 w-4" />
                {sugestaoEdit ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {sugestaoParaDeletar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
            <button
              onClick={() => setSugestaoParaDeletar(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold mb-4">Confirmar exclusão</h2>
            <p className="text-gray-700 mb-6">
              Tem certeza que deseja excluir a sugestão de manutenção{' '}
              <strong>{sugestaoParaDeletar.nome_peca}</strong>?{' '}
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSugestaoParaDeletar(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutationDeletarSugestao.mutate(sugestaoParaDeletar.id)}
                disabled={mutationDeletarSugestao.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
              >
                {mutationDeletarSugestao.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
