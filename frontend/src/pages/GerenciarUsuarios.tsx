import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { API_PREFIX } from '../lib/config';
import { Plus, Search, Edit2, Trash2, User, Mail, Shield, ShieldOff, Eye, EyeOff, X, Check } from 'lucide-react';

interface Usuario {
  id: number;
  username: string;
  email: string;
  nome: string;
  ativo: boolean;
  usar_2fa: boolean;
  perfil_id: number;
  perfil_nome?: string;
  created_at: string;
}

interface Perfil {
  id: number;
  nome: string;
  descricao: string;
  ativo: boolean;
}

interface UsuarioFormData {
  username: string;
  email: string;
  nome: string;
  password?: string;
  ativo: boolean;
  usar_2fa: boolean;
  perfil_id: number;
}

const GerenciarUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState<UsuarioFormData>({
    username: '',
    email: '',
    nome: '',
    password: '',
    ativo: true,
    usar_2fa: false,
    perfil_id: 3  // Padrão: Operador
  });

  const { token } = useAuth();
  const API_BASE = API_PREFIX;

  useEffect(() => {
    carregarUsuarios();
    carregarPerfis();
  }, []);

  const carregarPerfis = async () => {
    try {
      const response = await fetch(`${API_BASE}/perfis/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar perfis');

      const data = await response.json();
      setPerfis(data.filter((p: Perfil) => p.ativo));
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
    }
  };

  const carregarUsuarios = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/usuarios/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar usuários');

      const data = await response.json();
      setUsuarios(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingUsuario
        ? `${API_BASE}/usuarios/${editingUsuario.id}`
        : `${API_BASE}/usuarios/`;

      const method = editingUsuario ? 'PUT' : 'POST';

      const body: any = {
        username: formData.username,
        email: formData.email,
        nome: formData.nome,
        ativo: formData.ativo,
        usar_2fa: formData.usar_2fa
      };

      // Incluir senha apenas se foi preenchida
      if (formData.password && formData.password.trim() !== '') {
        body.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro ao salvar usuário');
      }

      toast.success(editingUsuario ? 'Usuário atualizado!' : 'Usuário criado!');
      setShowModal(false);
      resetForm();
      carregarUsuarios();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao salvar usuário');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const response = await fetch(`${API_BASE}/usuarios/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro ao excluir usuário');
      }

      toast.success('Usuário excluído com sucesso!');
      carregarUsuarios();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao excluir usuário');
    }
  };

  const handleToggle2FA = async (usuario: Usuario) => {
    try {
      const response = await fetch(`${API_BASE}/usuarios/${usuario.id}/toggle-2fa`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usar_2fa: !usuario.usar_2fa })
      });

      if (!response.ok) throw new Error('Erro ao alterar 2FA');

      toast.success(`2FA ${!usuario.usar_2fa ? 'habilitado' : 'desabilitado'} com sucesso!`);
      carregarUsuarios();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao alterar 2FA');
    }
  };

  const handleToggleAtivo = async (usuario: Usuario) => {
    try {
      const endpoint = usuario.ativo ? 'desativar' : 'ativar';
      const response = await fetch(`${API_BASE}/usuarios/${usuario.id}/${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro ao alterar status');
      }

      toast.success(`Usuário ${!usuario.ativo ? 'ativado' : 'desativado'} com sucesso!`);
      carregarUsuarios();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao alterar status');
    }
  };

  const openEditModal = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setFormData({
      username: usuario.username,
      email: usuario.email,
      nome: usuario.nome,
      password: '', // Não preencher senha ao editar
      ativo: usuario.ativo,
      usar_2fa: usuario.usar_2fa,
      perfil_id: usuario.perfil_id
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      nome: '',
      password: '',
      ativo: true,
      usar_2fa: false,
      perfil_id: 3  // Padrão: Operador
    });
    setEditingUsuario(null);
    setShowPassword(false);
  };

  const usuariosFiltrados = usuarios.filter(u =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gerenciar Usuários</h1>
          <p className="text-gray-600 mt-1">Controle de acesso e autenticação</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, usuário ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de Usuários - Responsiva */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Carregando...
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Nenhum usuário encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {usuariosFiltrados.map((usuario) => (
            <div key={usuario.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Info do Usuário */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {usuario.nome}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">@{usuario.username}</p>
                    <div className="flex items-center text-sm text-gray-600 mt-1 truncate">
                      <Mail size={14} className="mr-1.5 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{usuario.email}</span>
                    </div>
                  </div>
                </div>

                {/* Badges e Ações */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleToggle2FA(usuario)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        usuario.usar_2fa
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {usuario.usar_2fa ? <Shield size={12} className="mr-1" /> : <ShieldOff size={12} className="mr-1" />}
                      2FA {usuario.usar_2fa ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => handleToggleAtivo(usuario)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        usuario.ativo
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {usuario.ativo ? <Check size={12} className="mr-1" /> : <X size={12} className="mr-1" />}
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {usuario.perfil_nome || 'Operador'}
                    </span>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(usuario)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(usuario.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
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
                {editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Nome Completo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="João da Silva"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome de Usuário *
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUsuario}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="joao.silva"
                />
                {editingUsuario && (
                  <p className="text-xs text-gray-500 mt-1">O username não pode ser alterado</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="joao@email.com"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha {!editingUsuario && '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUsuario}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder={editingUsuario ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'}
                    minLength={editingUsuario ? 0 : 6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {editingUsuario && (
                  <p className="text-xs text-gray-500 mt-1">Deixe em branco para manter a senha atual</p>
                )}
              </div>

              {/* Perfil */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Perfil de Acesso *
                </label>
                <select
                  required
                  value={formData.perfil_id}
                  onChange={(e) => setFormData({ ...formData, perfil_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {perfis.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>
                      {perfil.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Define quais funcionalidades o usuário pode acessar no sistema
                </p>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="ativo" className="ml-2 text-sm font-medium text-gray-700">
                    Usuário ativo
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="usar_2fa"
                    checked={formData.usar_2fa}
                    onChange={(e) => setFormData({ ...formData, usar_2fa: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="usar_2fa" className="ml-2 text-sm font-medium text-gray-700">
                    Habilitar autenticação de dois fatores (2FA)
                  </label>
                </div>
                
                {formData.usar_2fa && (
                  <div className="ml-6 mt-2 text-sm text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
                    <Shield size={16} className="inline mr-2" />
                    O usuário precisará configurar o 2FA no primeiro login usando o Microsoft Authenticator
                  </div>
                )}
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
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingUsuario ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciarUsuarios;
