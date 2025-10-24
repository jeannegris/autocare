import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { Settings, Save, DollarSign, Lock, ShieldCheck, AlertTriangle, Wrench, Plus, Edit2, Trash2, CheckCircle, X, Database, Server, Activity, HardDrive, Cpu, RefreshCw } from 'lucide-react';

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

interface SystemInfo {
  disco: {
    total_gb: number;
    usado_gb: number;
    livre_gb: number;
    percentual_usado: number;
  };
  memoria: {
    memoria_total_gb: number;
    memoria_usada_gb: number;
    memoria_livre_gb: number;
    memoria_percentual: number;
    swap_total_gb: number;
    swap_usada_gb: number;
    swap_livre_gb: number;
    swap_percentual: number;
  };
}

interface ServicesStatus {
  nginx: boolean;
  postgresql: boolean;
  fastapi: boolean;
  venv_ativo: boolean;
}

interface PostgresInfo {
  status: string;
  nome_instancia: string | null;
  tamanho: string | null;
  conexoes_ativas: number | null;
  versao: string | null;
  erro: string | null;
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
  const [senhaBackup, setSenhaBackup] = useState('');
  const [mostrarModalBackup, setMostrarModalBackup] = useState(false);
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

  

  // Helper: fallback via /health para status básico (compatibilidade)
  async function fetchHealth() {
    try {
      const r = await apiFetch('/health');
      return r; // { status, database, timestamp }
    } catch (_) {
      return null;
    }
  }

  // Query: buscar informações do sistema
  const { data: systemInfo, isLoading: isLoadingSystem } = useQuery<SystemInfo>({
    queryKey: ['system-info'],
    queryFn: async () => {
      try {
        return await apiFetch('/configuracoes/sistema/info');
      } catch (err: any) {
        // Fallback: retornar estrutura vazia para evitar card "sem dados"
        // e indicar modo compatibilidade (sem métricas reais)
        return {
          disco: {
            total_gb: 0,
            usado_gb: 0,
            livre_gb: 0,
            percentual_usado: 0,
          },
          memoria: {
            memoria_total_gb: 0,
            memoria_usada_gb: 0,
            memoria_livre_gb: 0,
            memoria_percentual: 0,
            swap_total_gb: 0,
            swap_usada_gb: 0,
            swap_livre_gb: 0,
            swap_percentual: 0,
          }
        } as SystemInfo;
      }
    }
  });

  // Query: buscar status dos serviços
  const { data: servicesStatus, isLoading: isLoadingServices, refetch: refetchServices } = useQuery<ServicesStatus>({
    queryKey: ['services-status'],
    queryFn: async () => {
      try {
        // Novo endpoint
        return await apiFetch('/configuracoes/sistema/servicos');
      } catch (err: any) {
        // Fallback 1: alias legado
        if (err.status === 404) {
          try {
            return await apiFetch('/configuracoes/servicos');
          } catch (err2: any) {
            if (err2.status !== 404) throw err2;
          }
        } else {
          throw err;
        }

        // Fallback 2: usar /health para inferir status básico
        const health = await fetchHealth();
        if (health) {
          return {
            nginx: true, // se a página está servindo via proxy, NGINX está ativo
            postgresql: health.database === 'connected',
            fastapi: true,
            venv_ativo: false,
          } as ServicesStatus;
        }
        // último recurso: retornar algo neutro
        return { nginx: false, postgresql: false, fastapi: false, venv_ativo: false } as ServicesStatus;
      }
    }
  });

  // Query: buscar informações do PostgreSQL
  const { data: postgresInfo, isLoading: isLoadingPostgres } = useQuery<PostgresInfo>({
    queryKey: ['postgres-info'],
    queryFn: async () => {
      try {
        return await apiFetch('/configuracoes/postgres/info');
      } catch (err: any) {
        // Fallback via /health: dá para inferir apenas o status
        const health = await fetchHealth();
        if (health) {
          const online = health.database === 'connected';
          return {
            status: online ? 'online' : 'offline',
            nome_instancia: null,
            tamanho: null,
            conexoes_ativas: null,
            versao: null,
            erro: online ? null : 'Banco indisponível (via /health)'
          } as PostgresInfo;
        }
        throw err;
      }
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

  // Mutation: criar backup do banco de dados
  const mutationBackup = useMutation({
    mutationFn: async (senha: string) => {
      return await apiFetch('/configuracoes/postgres/backup', {
        method: 'POST',
        body: JSON.stringify({ senha })
      });
    },
    onSuccess: (data: any) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        setMostrarModalBackup(false);
        setSenhaBackup('');
      } else {
        toast.error(data.mensagem || 'Erro ao criar backup');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar backup');
    }
  });

  // Mutation: verificar e iniciar serviços
  const mutationVerificarServicos = useMutation({
    mutationFn: async () => {
      return await apiFetch('/configuracoes/sistema/verificar-servicos', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast.success('Serviços verificados com sucesso!');
      refetchServices();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao verificar serviços');
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

  const handleCriarBackup = () => {
    if (!senhaBackup) {
      toast.error('Digite a senha do supervisor');
      return;
    }
    mutationBackup.mutate(senhaBackup);
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
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-b-2 border-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center text-3xl font-bold text-gray-900">
          <Settings className="w-8 h-8 mr-3 text-blue-600" />
          Configurações
        </h1>
      </div>

      {/* Cards de Monitoramento do Sistema - Grid Responsivo */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Card 1: Banco de Dados PostgreSQL */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="flex items-center mb-4 text-xl font-semibold text-gray-800">
            <Database className="w-5 h-5 mr-2 text-blue-600" />
            Banco de Dados
          </h2>
          
          {isLoadingPostgres ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
              <p className="mt-2 text-sm text-gray-600">Carregando...</p>
            </div>
          ) : postgresInfo ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  postgresInfo.status === 'online' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {postgresInfo.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {postgresInfo.status === 'online' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Instância:</span>
                    <span className="text-sm font-medium">{postgresInfo.nome_instancia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tamanho:</span>
                    <span className="text-sm font-medium">{postgresInfo.tamanho}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Conexões Ativas:</span>
                    <span className="text-sm font-medium">{postgresInfo.conexoes_ativas}</span>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="mb-2 text-xs text-gray-500">
                      Backup será salvo em: <strong>~/autocare_backups/</strong>
                    </p>
                    <button
                      onClick={() => setMostrarModalBackup(true)}
                      disabled={mutationBackup.isPending}
                      className="flex items-center justify-center w-full px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {mutationBackup.isPending ? 'Criando...' : 'Criar Backup'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-600">
                  <p>Erro: {postgresInfo.erro}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma informação disponível</p>
          )}
        </div>

        {/* Card 2: Informações do Servidor */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="flex items-center mb-4 text-xl font-semibold text-gray-800">
            <Server className="w-5 h-5 mr-2 text-green-600" />
            Servidor
          </h2>
          
          {isLoadingSystem ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 mx-auto border-b-2 border-green-600 rounded-full animate-spin"></div>
              <p className="mt-2 text-sm text-gray-600">Carregando...</p>
            </div>
          ) : systemInfo ? (
            <div className="space-y-4">
              {/* Disco */}
              <div>
                <div className="flex items-center mb-2">
                  <HardDrive className="w-4 h-4 mr-2 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Disco</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-medium">{systemInfo.disco.total_gb} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usado:</span>
                    <span className="font-medium text-orange-600">{systemInfo.disco.usado_gb} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Livre:</span>
                    <span className="font-medium text-green-600">{systemInfo.disco.livre_gb} GB</span>
                  </div>
                  <div className="w-full h-2 mt-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-blue-600 rounded-full" 
                      style={{ width: `${systemInfo.disco.percentual_usado}%` }}
                    ></div>
                  </div>
                  <div className="text-center text-gray-600">
                    {systemInfo.disco.percentual_usado}% usado
                  </div>
                </div>
              </div>

              {/* Memória */}
              <div className="pt-3 border-t">
                <div className="flex items-center mb-2">
                  <Cpu className="w-4 h-4 mr-2 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Memória</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-medium">{systemInfo.memoria.memoria_total_gb} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Usada:</span>
                    <span className="font-medium text-orange-600">{systemInfo.memoria.memoria_usada_gb} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Livre:</span>
                    <span className="font-medium text-green-600">{systemInfo.memoria.memoria_livre_gb} GB</span>
                  </div>
                  <div className="w-full h-2 mt-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-green-600 rounded-full" 
                      style={{ width: `${systemInfo.memoria.memoria_percentual}%` }}
                    ></div>
                  </div>
                  <div className="text-center text-gray-600">
                    {systemInfo.memoria.memoria_percentual}% usado
                  </div>
                </div>
              </div>

              {/* Swap */}
              {systemInfo.memoria.swap_total_gb > 0 && (
                <div className="pt-3 border-t">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Swap Total:</span>
                      <span className="font-medium">{systemInfo.memoria.swap_total_gb} GB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Swap Usada:</span>
                      <span className="font-medium">{systemInfo.memoria.swap_usada_gb} GB ({systemInfo.memoria.swap_percentual}%)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma informação disponível</p>
          )}
        </div>

        {/* Card 3: Status dos Serviços */}
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h2 className="flex items-center mb-4 text-xl font-semibold text-gray-800">
            <Activity className="w-5 h-5 mr-2 text-purple-600" />
            Serviços
          </h2>
          
          {isLoadingServices ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 mx-auto border-b-2 border-purple-600 rounded-full animate-spin"></div>
              <p className="mt-2 text-sm text-gray-600">Carregando...</p>
            </div>
          ) : servicesStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-700">NGINX</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  servicesStatus.nginx 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {servicesStatus.nginx ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-700">PostgreSQL</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  servicesStatus.postgresql 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {servicesStatus.postgresql ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-700">FastAPI/Uvicorn</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  servicesStatus.fastapi 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {servicesStatus.fastapi ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-700">Venv Python</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  servicesStatus.venv_ativo 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {servicesStatus.venv_ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <div className="pt-3">
                <button
                  onClick={() => mutationVerificarServicos.mutate()}
                  disabled={mutationVerificarServicos.isPending}
                  className="flex items-center justify-center w-full px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${mutationVerificarServicos.isPending ? 'animate-spin' : ''}`} />
                  {mutationVerificarServicos.isPending ? 'Verificando...' : 'Verificar Status'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma informação disponível</p>
          )}
        </div>
      </div>

      {/* Card: Senha do Supervisor */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="flex items-center mb-4 text-xl font-semibold text-gray-800">
          <Lock className="w-5 h-5 mr-2 text-red-600" />
          Senha do Supervisor
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          A senha do supervisor é necessária para operações críticas como aplicar descontos acima do limite 
          e atualizar KM inferior ao atual do veículo.
        </p>
        
        <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-3">
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Senha Atual
            </label>
            <input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Digite a senha atual"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Nova Senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Repita a nova senha"
            />
          </div>
        </div>
        
        <button
          onClick={() => mutationSenha.mutate()}
          disabled={mutationSenha.isPending || !senhaAtual || !novaSenha || !confirmarSenha}
          className="flex items-center px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4 mr-2" />
          {mutationSenha.isPending ? 'Salvando...' : 'Atualizar Senha'}
        </button>
        
        <p className="mt-2 text-xs text-gray-500">
          <strong>Senha padrão inicial:</strong> admin123
        </p>
      </div>

      {/* Card: Configurações de Venda */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="flex items-center mb-4 text-xl font-semibold text-gray-800">
          <DollarSign className="w-5 h-5 mr-2 text-green-600" />
          Configurações de Venda
        </h2>

        {/* Margem de Lucro */}
        <div className="pb-6 mb-6 border-b">
          <h3 className="mb-2 font-medium text-gray-700">Margem de Lucro Padrão</h3>
          <p className="mb-4 text-sm text-gray-600">
            Define a margem de lucro padrão para novos produtos e permite aplicar em lote a todos os produtos existentes.
          </p>
          
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Margem de Lucro (%)
              </label>
              <input
                type="number"
                value={margemLucro}
                onChange={(e) => setMargemLucro(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 50"
                min="0"
                max="1000"
                step="0.01"
              />
            </div>
            <button
              onClick={handleAplicarMargemLucro}
              disabled={mutationAplicarMargem.isPending}
              className="flex items-center px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {mutationAplicarMargem.isPending ? 'Aplicando...' : 'Aplicar a Todos Produtos'}
            </button>
          </div>
          
          <div className="flex items-start p-3 mt-3 border border-yellow-200 rounded-md bg-yellow-50">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              <strong>Atenção:</strong> Ao aplicar, a margem será calculada sobre o preço de custo de todos 
              os produtos ativos no estoque. Esta ação requer senha do supervisor.
            </p>
          </div>
        </div>

        {/* Desconto Máximo */}
        <div>
          <h3 className="mb-2 font-medium text-gray-700">Desconto Máximo em Ordens de Serviço</h3>
          <p className="mb-4 text-sm text-gray-600">
            Descontos acima deste valor exigirão senha do supervisor para serem aplicados.
          </p>
          
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Desconto Máximo (%)
              </label>
              <input
                type="number"
                value={descontoMaximo}
                onChange={(e) => setDescontoMaximo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 15"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <button
              onClick={handleSalvarDescontoMaximo}
              disabled={mutationConfig.isPending}
              className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {mutationConfig.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Confirmar Aplicação de Margem */}
      {mostrarModalAplicarMargem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <h3 className="flex items-center mb-4 text-lg font-semibold text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Confirmação Necessária
            </h3>
            
            <p className="mb-4 text-sm text-gray-700">
              Você está prestes a aplicar uma margem de lucro de <strong>{margemLucro}%</strong> em 
              todos os produtos ativos do estoque. Esta ação irá recalcular o preço de venda de todos os produtos.
            </p>
            
            <p className="mb-2 text-sm font-medium text-gray-900">
              Digite a senha do supervisor para confirmar:
            </p>
            
            <input
              type="password"
              value={senhaMargemLucro}
              onChange={(e) => setSenhaMargemLucro(e.target.value)}
              className="w-full px-3 py-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Senha do supervisor"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMostrarModalAplicarMargem(false);
                  setSenhaMargemLucro('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAplicarMargem}
                disabled={mutationAplicarMargem.isPending}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {mutationAplicarMargem.isPending ? 'Aplicando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card: Sugestões de Manutenção Preventiva */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center text-xl font-semibold text-gray-800">
            <Wrench className="w-5 h-5 mr-2 text-orange-600" />
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
            className="flex items-center px-4 py-2 text-sm text-white bg-orange-600 rounded-md hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Sugestão
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Gerencie as sugestões de manutenção preventiva que serão exibidas no histórico de manutenções dos veículos.
        </p>

        {isLoadingSugestoes ? (
          <div className="py-8 text-center">
            <div className="w-8 h-8 mx-auto border-b-2 border-orange-600 rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Carregando sugestões...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Peça / Fluido
                  </th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    KM Média para Troca
                  </th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Observações
                  </th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
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
                      <td className="max-w-md px-4 py-3 text-sm text-gray-600">
                        {sugestao.observacoes}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sugestao.ativo ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-800 bg-gray-100 rounded-full">
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
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSugestaoParaDeletar(sugestao)}
                            className="text-red-600 hover:text-red-800"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black bg-opacity-50">
          <div className="w-full max-w-2xl p-6 my-8 bg-white rounded-lg shadow-xl">
            <h3 className="flex items-center mb-4 text-lg font-semibold text-orange-600">
              <Wrench className="w-5 h-5 mr-2" />
              {sugestaoEdit ? 'Editar Sugestão de Manutenção' : 'Nova Sugestão de Manutenção'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Nome da Peça / Fluido *
                </label>
                <input
                  type="text"
                  value={formSugestao.nome_peca}
                  onChange={(e) => setFormSugestao({ ...formSugestao, nome_peca: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Óleo de motor (sintético)"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  KM Média para Troca *
                </label>
                <input
                  type="text"
                  value={formSugestao.km_media_troca}
                  onChange={(e) => setFormSugestao({ ...formSugestao, km_media_troca: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: 10.000 km ou 12 meses"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Intervalo KM Mínimo
                  </label>
                  <input
                    type="number"
                    value={formSugestao.intervalo_km_min}
                    onChange={(e) => setFormSugestao({ ...formSugestao, intervalo_km_min: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 10000"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Intervalo KM Máximo
                  </label>
                  <input
                    type="number"
                    value={formSugestao.intervalo_km_max}
                    onChange={(e) => setFormSugestao({ ...formSugestao, intervalo_km_max: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 10000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Tipo de Serviço
                  </label>
                  <input
                    type="text"
                    value={formSugestao.tipo_servico}
                    onChange={(e) => setFormSugestao({ ...formSugestao, tipo_servico: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: óleo, filtro, vela"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    value={formSugestao.ordem_exibicao}
                    onChange={(e) => setFormSugestao({ ...formSugestao, ordem_exibicao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Ex: 1"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Observações
                </label>
                <textarea
                  value={formSugestao.observacoes}
                  onChange={(e) => setFormSugestao({ ...formSugestao, observacoes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Use sempre o grau e tipo especificado pelo fabricante..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formSugestao.ativo}
                  onChange={(e) => setFormSugestao({ ...formSugestao, ativo: e.target.checked })}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label className="block ml-2 text-sm text-gray-700">
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
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarSugestao}
                disabled={!formSugestao.nome_peca || !formSugestao.km_media_troca}
                className="flex items-center justify-center flex-1 px-4 py-2 text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {sugestaoEdit ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {sugestaoParaDeletar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
            <button
              onClick={() => setSugestaoParaDeletar(null)}
              className="absolute text-gray-500 top-4 right-4 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="mb-4 text-xl font-semibold">Confirmar exclusão</h2>
            <p className="mb-6 text-gray-700">
              Tem certeza que deseja excluir a sugestão de manutenção{' '}
              <strong>{sugestaoParaDeletar.nome_peca}</strong>?{' '}
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSugestaoParaDeletar(null)}
                className="px-4 py-2 text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => mutationDeletarSugestao.mutate(sugestaoParaDeletar.id)}
                disabled={mutationDeletarSugestao.isPending}
                className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
              >
                {mutationDeletarSugestao.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de backup */}
      {mostrarModalBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
            <button
              onClick={() => {
                setMostrarModalBackup(false);
                setSenhaBackup('');
              }}
              className="absolute text-gray-500 top-4 right-4 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="flex items-center mb-4 text-xl font-semibold text-blue-600">
              <Database className="w-5 h-5 mr-2" />
              Criar Backup do Banco de Dados
            </h2>
            <p className="mb-4 text-gray-700">
              Esta ação irá criar um backup completo do banco de dados PostgreSQL.
              O arquivo será salvo em: <strong>~/autocare_backups/</strong>
            </p>
            <p className="mb-4 text-sm text-gray-600">
              Digite a senha do supervisor para confirmar:
            </p>
            <input
              type="password"
              value={senhaBackup}
              onChange={(e) => setSenhaBackup(e.target.value)}
              className="w-full px-3 py-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Senha do supervisor"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCriarBackup();
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMostrarModalBackup(false);
                  setSenhaBackup('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarBackup}
                disabled={mutationBackup.isPending || !senhaBackup}
                className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {mutationBackup.isPending ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-b-2 border-white rounded-full animate-spin"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Criar Backup
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
