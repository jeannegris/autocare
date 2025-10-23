import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { API_PREFIX } from '../lib/config';
import { Plus, Search, Edit2, Trash2, Shield, ShieldAlert, ShieldCheck, X, Save, AlertTriangle } from 'lucide-react';

interface Permissoes {
  dashboard_gerencial: boolean;
  dashboard_operacional: boolean;
  clientes: boolean;
  veiculos: boolean;
  estoque: boolean;
  ordens_servico: boolean;
  fornecedores: boolean;
  relatorios: boolean;
  configuracoes: boolean;
  usuarios: boolean;
  perfis: boolean;
}

interface Perfil {
  id: number;
  nome: string;
  descricao: string;
  permissoes: Permissoes;
  ativo: boolean;
  editavel: boolean;
  created_at: string;
}

interface PerfilFormData {
  nome: string;
  descricao: string;
  permissoes: Permissoes;
  ativo: boolean;
}

const permissoesLabels: Record<keyof Permissoes, string> = {
  dashboard_gerencial: 'Dashboard Gerencial',
  dashboard_operacional: 'Dashboard Operacional',
  clientes: 'Clientes',
  veiculos: 'Veículos',
  estoque: 'Estoque',
  ordens_servico: 'Ordens de Serviço',
  fornecedores: 'Fornecedores',
  relatorios: 'Relatórios',
  configuracoes: 'Configurações',
  usuarios: 'Usuários',
  perfis: 'Perfis'
};

const GerenciarPerfis: React.FC = () => {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null);
  const [formData, setFormData] = useState<PerfilFormData>({
    nome: '',
    descricao: '',
    permissoes: {
      dashboard_gerencial: false,
      dashboard_operacional: false,
      clientes: false,
      veiculos: false,
      estoque: false,
      ordens_servico: false,
      fornecedores: false,
      relatorios: false,
      configuracoes: false,
      usuarios: false,
      perfis: false
    },
    ativo: true
  });

  const { token } = useAuth();
  const API_BASE = API_PREFIX;

  useEffect(() => {
    // Aguarda o token para evitar 401/redirects antes da autenticação
    if (!token) return;
    carregarPerfis();
  }, [token]);

  const carregarPerfis = async () => {
    setLoading(true);
    try {
      if (!token) return;
      // Usar sempre o prefixo configurado; em produção este é /autocare-api
      const response = await fetch(`${API_BASE}/perfis/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 404) {
        // Backend ainda não publicou a rota; mostrar perfis padrão apenas para consulta
        setUsingFallback(true);
        setPerfis([
          { id: 1, nome: 'Administrador', descricao: 'Acesso total ao sistema', ativo: true, editavel: false, created_at: new Date().toISOString(), permissoes: {
            dashboard_gerencial: true, dashboard_operacional: true, clientes: true, veiculos: true, estoque: true, ordens_servico: true, fornecedores: true, relatorios: true, configuracoes: true, usuarios: true, perfis: true
          } },
          { id: 2, nome: 'Supervisor', descricao: 'Acesso intermediário', ativo: true, editavel: true, created_at: new Date().toISOString(), permissoes: {
            dashboard_gerencial: true, dashboard_operacional: false, clientes: true, veiculos: true, estoque: true, ordens_servico: true, fornecedores: true, relatorios: true, configuracoes: false, usuarios: false, perfis: false
          } },
          { id: 3, nome: 'Operador', descricao: 'Acesso básico', ativo: true, editavel: true, created_at: new Date().toISOString(), permissoes: {
            dashboard_gerencial: false, dashboard_operacional: true, clientes: false, veiculos: false, estoque: true, ordens_servico: true, fornecedores: false, relatorios: false, configuracoes: false, usuarios: false, perfis: false
          } },
        ]);
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erro ao carregar perfis (${response.status}): ${text || 'desconhecido'}`);
      }

      const data = await response.json();
      setUsingFallback(false);
      setPerfis(data);
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao carregar perfis');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingPerfil
        ? `${API_BASE}/perfis/${editingPerfil.id}`
        : `${API_BASE}/perfis/`;

      const method = editingPerfil ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro ao salvar perfil');
      }

      toast.success(editingPerfil ? 'Perfil atualizado!' : 'Perfil criado!');
      setShowModal(false);
      resetForm();
      carregarPerfis();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao salvar perfil');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este perfil?')) return;

    try {
      const response = await fetch(`${API_BASE}/perfis/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro ao excluir perfil');
      }

      toast.success('Perfil excluído com sucesso!');
      carregarPerfis();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao excluir perfil');
    }
  };

  const openEditModal = (perfil: Perfil) => {
    setEditingPerfil(perfil);
    setFormData({
      nome: perfil.nome,
      descricao: perfil.descricao,
      permissoes: perfil.permissoes,
      ativo: perfil.ativo
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      permissoes: {
        dashboard_gerencial: false,
        dashboard_operacional: false,
        clientes: false,
        veiculos: false,
        estoque: false,
        ordens_servico: false,
        fornecedores: false,
        relatorios: false,
        configuracoes: false,
        usuarios: false,
        perfis: false
      },
      ativo: true
    });
    setEditingPerfil(null);
  };

  const togglePermissao = (key: keyof Permissoes) => {
    const novasPermissoes = { ...formData.permissoes };
    const valorAtual = novasPermissoes[key];
    
    // Validação especial para dashboards (exceto Administrador)
    if ((key === 'dashboard_gerencial' || key === 'dashboard_operacional') && 
        formData.nome !== 'Administrador' && 
        !valorAtual) { // Tentando marcar (não desmarcar)
      
      // Se tentar marcar um dashboard e o outro já está marcado, não permitir
      if (key === 'dashboard_gerencial' && novasPermissoes.dashboard_operacional) {
        toast.error('Não é possível marcar ambos os dashboards. Desmarque o Dashboard Operacional primeiro.');
        return;
      }
      if (key === 'dashboard_operacional' && novasPermissoes.dashboard_gerencial) {
        toast.error('Não é possível marcar ambos os dashboards. Desmarque o Dashboard Gerencial primeiro.');
        return;
      }
    }
    
    // Aplicar a mudança
    novasPermissoes[key] = !valorAtual;
    
    setFormData({
      ...formData,
      permissoes: novasPermissoes
    });
  };

  const perfisFiltrados = perfis.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.descricao && p.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const contarPermissoes = (permissoes: Permissoes): number => {
    return Object.values(permissoes).filter(v => v).length;
  };

  return (
    <div className="container px-4 py-8 mx-auto">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gerenciar Perfis de Acesso</h1>
          <p className="mt-1 text-gray-600">Controle as permissões por perfil de usuário</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Novo Perfil
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute text-gray-400 transform -translate-y-1/2 left-3 top-1/2" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Aviso de fallback */}
      {usingFallback && (
        <div className="p-3 mb-4 text-sm text-yellow-800 border border-yellow-300 rounded bg-yellow-50">
          Mostrando perfis padrão porque a rota /autocare-api/perfis ainda não está disponível no backend. Reinicie o serviço do backend para aplicar as rotas e o seed de permissões.
        </div>
      )}

      {/* Lista de Perfis */}
      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">
          Carregando...
        </div>
      ) : perfisFiltrados.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">
          Nenhum perfil encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {perfisFiltrados.map((perfil) => (
            <div key={perfil.id} className="p-6 transition-shadow bg-white rounded-lg shadow hover:shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${
                    perfil.nome === 'Administrador' ? 'bg-red-100' :
                    perfil.nome === 'Supervisor' ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    {perfil.nome === 'Administrador' ? (
                      <ShieldAlert size={24} className="text-red-600" />
                    ) : perfil.nome === 'Supervisor' ? (
                      <ShieldCheck size={24} className="text-yellow-600" />
                    ) : (
                      <Shield size={24} className="text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{perfil.nome}</h3>
                    {perfil.editavel ? (
                      <span className="text-xs text-gray-500">Editável</span>
                    ) : (
                      <span className="text-xs text-red-500">Sistema</span>
                    )}
                  </div>
                </div>

                {perfil.editavel && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(perfil)}
                      className="p-2 text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(perfil.id)}
                      className="p-2 text-red-600 transition-colors rounded-lg hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              {perfil.descricao && (
                <p className="mb-4 text-sm text-gray-600">{perfil.descricao}</p>
              )}

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Permissões</span>
                  <span className="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded-full">
                    {contarPermissoes(perfil.permissoes)}/{Object.keys(permissoesLabels).length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(perfil.permissoes).map(([key, value]) => (
                    value && (
                      <div key={key} className="flex items-center gap-1 text-gray-600">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        {permissoesLabels[key as keyof Permissoes]}
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingPerfil ? `Editar Perfil: ${editingPerfil.nome}` : 'Novo Perfil'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {editingPerfil && !editingPerfil.editavel && (
                <div className="flex items-center gap-2 px-4 py-3 text-red-800 border border-red-200 rounded-lg bg-red-50">
                  <ShieldAlert size={20} />
                  <span className="text-sm font-medium">Este perfil é do sistema e não pode ser editado</span>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Nome do Perfil *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!(editingPerfil && !editingPerfil.editavel)}
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="Ex: Gerente, Atendente, etc."
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Descrição
                </label>
                <textarea
                  disabled={!!(editingPerfil && !editingPerfil.editavel)}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="Descrição do perfil e suas responsabilidades"
                  rows={3}
                />
              </div>

              {/* Permissões */}
              <div>
                <label className="block mb-3 text-sm font-medium text-gray-700">
                  Permissões de Acesso *
                </label>
                <div className="p-4 space-y-2 border border-gray-200 rounded-lg bg-gray-50">
                  {Object.entries(permissoesLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between p-2 transition-colors rounded hover:bg-white">
                      <label htmlFor={`perm-${key}`} className="flex-1 text-sm font-medium text-gray-700 cursor-pointer">
                        {label}
                      </label>
                      <input
                        type="checkbox"
                        id={`perm-${key}`}
                        disabled={!!(editingPerfil && !editingPerfil.editavel)}
                        checked={formData.permissoes[key as keyof Permissoes]}
                        onChange={() => togglePermissao(key as keyof Permissoes)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>
                
                {/* Aviso sobre dashboards */}
                {formData.nome !== 'Administrador' && 
                 formData.permissoes.dashboard_gerencial && 
                 formData.permissoes.dashboard_operacional && (
                  <div className="flex items-start gap-2 p-2 mt-2 border border-yellow-200 rounded-md bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">
                      <strong>Atenção:</strong> Apenas o perfil Administrador pode ter ambos os dashboards habilitados. 
                      Para outros perfis, escolha apenas um tipo de dashboard.
                    </p>
                  </div>
                )}
                
                {formData.nome !== 'Administrador' && 
                 !formData.permissoes.dashboard_gerencial && 
                 !formData.permissoes.dashboard_operacional && (
                  <div className="flex items-start gap-2 p-2 mt-2 border border-blue-200 rounded-md bg-blue-50">
                    <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800">
                      <strong>Dica:</strong> Selecione um tipo de dashboard (Gerencial ou Operacional) para permitir acesso ao painel.
                    </p>
                  </div>
                )}
                
                <p className="mt-2 text-xs text-gray-500">
                  {contarPermissoes(formData.permissoes)} de {Object.keys(permissoesLabels).length} permissões selecionadas
                </p>
              </div>

              {/* Ativo */}
              <div className="flex items-center p-3 rounded-lg bg-gray-50">
                <input
                  type="checkbox"
                  id="ativo"
                  disabled={!!(editingPerfil && !editingPerfil.editavel)}
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="ml-2 text-sm font-medium text-gray-700">
                  Perfil ativo
                </label>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                {(!editingPerfil || editingPerfil.editavel) && (
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    <Save size={18} />
                    {editingPerfil ? 'Salvar Alterações' : 'Criar Perfil'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciarPerfis;
