import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { API_PREFIX } from '../lib/config';
import { Plus, Search, Edit2, Trash2, Shield, ShieldAlert, ShieldCheck, X, Save } from 'lucide-react';

interface Permissoes {
  dashboard: boolean;
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
  dashboard: 'Dashboard',
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
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null);
  const [formData, setFormData] = useState<PerfilFormData>({
    nome: '',
    descricao: '',
    permissoes: {
      dashboard: false,
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

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erro ao carregar perfis (${response.status}): ${text || 'desconhecido'}`);
      }

      const data = await response.json();
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
        dashboard: false,
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
    setFormData({
      ...formData,
      permissoes: {
        ...formData.permissoes,
        [key]: !formData.permissoes[key]
      }
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
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gerenciar Perfis de Acesso</h1>
          <p className="text-gray-600 mt-1">Controle as permissões por perfil de usuário</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Perfil
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de Perfis */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Carregando...
        </div>
      ) : perfisFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Nenhum perfil encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perfisFiltrados.map((perfil) => (
            <div key={perfil.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6">
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
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(perfil.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              {perfil.descricao && (
                <p className="text-sm text-gray-600 mb-4">{perfil.descricao}</p>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Permissões</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingPerfil ? `Editar Perfil: ${editingPerfil.nome}` : 'Novo Perfil'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {editingPerfil && !editingPerfil.editavel && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
                  <ShieldAlert size={20} />
                  <span className="text-sm font-medium">Este perfil é do sistema e não pode ser editado</span>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissões de Acesso *
                </label>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
                  {Object.entries(permissoesLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between p-2 hover:bg-white rounded transition-colors">
                      <label htmlFor={`perm-${key}`} className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
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
                <p className="text-xs text-gray-500 mt-2">
                  {contarPermissoes(formData.permissoes)} de {Object.keys(permissoesLabels).length} permissões selecionadas
                </p>
              </div>

              {/* Ativo */}
              <div className="flex items-center bg-gray-50 p-3 rounded-lg">
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
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                {(!editingPerfil || editingPerfil.editavel) && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
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
