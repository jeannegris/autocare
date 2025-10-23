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
    // Aguarda o token estar disponível para evitar 401 e lista vazia
    if (!token) return;
    carregarUsuarios();
    carregarPerfis();
  }, [token]);

  const carregarPerfis = async () => {
    try {
      if (!token) return;
      const response = await fetch(`${API_BASE}/perfis/`, { headers: { 'Authorization': `Bearer ${token}` } });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Erro ao carregar perfis (${response.status}): ${err || 'desconhecido'}`);
      }

      const data = await response.json();
      const ativos = data.filter((p: Perfil) => p.ativo);
      setPerfis(ativos);
      // Se não houver perfil selecionado ainda, usar o primeiro ativo (ou Operador id=3)
      if (ativos.length > 0 && !formData.perfil_id) {
        setFormData((prev) => ({ ...prev, perfil_id: ativos[0].id || 3 }));
      }
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
      // Não bloquear a UI; mantém o valor padrão do form (3 - Operador)
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
        usar_2fa: formData.usar_2fa,
        perfil_id: formData.perfil_id
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
    <div className="container px-4 py-8 mx-auto">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gerenciar Usuários</h1>
          <p className="mt-1 text-gray-600">Controle de acesso e autenticação</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            // Garantir que a lista de perfis esteja carregada ao abrir o modal
            carregarPerfis();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Novo Usuário
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute text-gray-400 transform -translate-y-1/2 left-3 top-1/2" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome, usuário ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista de Usuários - Responsiva */}
      {loading ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">
          Carregando...
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg shadow">
          Nenhum usuário encontrado
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {usuariosFiltrados.map((usuario) => (
            <div key={usuario.id} className="p-4 transition-shadow bg-white rounded-lg shadow hover:shadow-md sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Info do Usuário */}
                <div className="flex items-start flex-1 min-w-0 gap-4">
                  <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full">
                    <User size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate sm:text-lg">
                      {usuario.nome}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">@{usuario.username}</p>
                    <div className="flex items-center mt-1 text-sm text-gray-600 truncate">
                      <Mail size={14} className="mr-1.5 flex-shrink-0 text-gray-400" />
                      <span className="truncate">{usuario.email}</span>
                    </div>
                  </div>
                </div>

                {/* Badges e Ações */}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
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
                      className="p-2 text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(usuario.id)}
                      className="p-2 text-red-600 transition-colors rounded-lg hover:bg-red-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
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
                <label className="block mb-1 text-sm font-medium text-gray-700">
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
                <label className="block mb-1 text-sm font-medium text-gray-700">
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
                  <p className="mt-1 text-xs text-gray-500">O username não pode ser alterado</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
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
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Senha {!editingUsuario && '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUsuario}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={editingUsuario ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'}
                    minLength={editingUsuario ? 0 : 6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute text-gray-400 transform -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {editingUsuario && (
                  <p className="mt-1 text-xs text-gray-500">Deixe em branco para manter a senha atual</p>
                )}
              </div>

              {/* Perfil */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Perfil de Acesso *
                </label>
                <select
                  required
                  value={formData.perfil_id}
                  onChange={(e) => setFormData({ ...formData, perfil_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {perfis.length === 0 && (
                    <option value={3}>Operador (padrão)</option>
                  )}
                  {perfis.map((perfil) => (
                    <option key={perfil.id} value={perfil.id}>
                      {perfil.nome}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Define quais funcionalidades o usuário pode acessar no sistema
                </p>
              </div>

              {/* Checkboxes */}
              <div className="p-4 space-y-3 rounded-lg bg-gray-50">
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
                  <div className="p-3 mt-2 ml-6 text-sm text-blue-600 border border-blue-200 rounded bg-blue-50">
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
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
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
