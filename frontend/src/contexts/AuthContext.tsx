import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_PREFIX } from '../lib/config';

interface User {
  id: number;
  username: string;
  email: string;
  nome: string;
  ativo: boolean;
  usar_2fa: boolean;
  perfil_id?: number;
  perfil_nome?: string;
  permissoes?: Record<string, boolean>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (username: string, password: string) => Promise<{ requires_2fa: boolean }>;
  verify2FA: (username: string, token: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Usa o prefixo dinâmico resolvido pelo app: /api em dev, /autocare-api em produção
  const API_BASE = API_PREFIX;

  // Carregar token e usuário do localStorage ao iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      
      // Validar token fazendo uma requisição ao /me
      validateToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async (tokenToValidate: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToValidate}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        // Garantir que o localStorage fique em sincronia com o usuário validado
        try {
          localStorage.setItem('user', JSON.stringify(userData));
        } catch {}
      } else {
        // Token inválido, limpar
        logout();
      }
    } catch (error) {
      console.error('Erro ao validar token:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<{ requires_2fa: boolean }> => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erro ao fazer login');
      }

      const data = await response.json();

      if (data.requires_2fa) {
        // Usuário precisa passar pelo 2FA: guardar token temporário para permitir setup/verify
        if (data.access_token) {
          setToken(data.access_token);
          localStorage.setItem('token', data.access_token);
        }
        return { requires_2fa: true };
      }

      // Login direto sem 2FA
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      return { requires_2fa: false };
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  };

  const verify2FA = async (username: string, totpToken: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/verify-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, token: totpToken })
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Se precisa fazer setup, lançar erro específico
        if (response.headers.get('X-Requires-Setup') === 'true') {
          throw new Error('REQUIRES_SETUP');
        }
        
        throw new Error(error.detail || 'Código 2FA inválido');
      }

      const data = await response.json();

      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      navigate('/dashboard');
    } catch (error) {
      console.error('Erro ao verificar 2FA:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const refreshToken = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        localStorage.setItem('token', data.access_token);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      logout();
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    // 1) Se backend enviou o mapa de permissões, usar diretamente
    if (user.permissoes && typeof user.permissoes === 'object') {
      if (permission in user.permissoes) {
        return user.permissoes[permission] === true;
      }
    }

    // 2) Fallback: se for Administrador (perfil_id=1 ou nome do perfil), conceder todas
    //    Útil quando o banco ainda não aplicou o JSON de permissoes mas o perfil está correto
    if (user.perfil_id === 1 || (user.perfil_nome && user.perfil_nome.toLowerCase() === 'administrador')) {
      return true;
    }

    // 2.1) Fallback extra: se o username for 'admin', conceder todas
    //     Necessário para ambientes onde o /auth/me ainda não retorna perfil_id/perfil_nome
    if (user.username && user.username.toLowerCase() === 'admin') {
      return true;
    }

    // 3) Sem mapa de permissões: negar por padrão
    return false;
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    hasPermission,
    login,
    verify2FA,
    logout,
    refreshToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
