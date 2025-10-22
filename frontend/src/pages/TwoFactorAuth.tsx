import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_PREFIX } from '../lib/config';

const TwoFactorAuth: React.FC = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [, setLoadingSetup] = useState(false);
  
  const { verify2FA, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username;

  useEffect(() => {
    // Se não veio usuário na navegação, voltar para login
    if (!username) {
      navigate('/login');
      return;
    }

    // Se temos um token temporário salvo, checar se o 2FA já está configurado
    // Caso não esteja, iniciar automaticamente o setup para exibir o QR Code
    const maybeAutoSetup = async () => {
      try {
        if (!token) return;

        const API_BASE = API_PREFIX;
        const meResp = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!meResp.ok) return; // Em caso de token inválido, fluxo padrão de verificação

        const meData = await meResp.json();
        // Tratar ausência do campo como não configurado
        if (meData && meData.usar_2fa === true && !meData.has_2fa_configured) {
          await handleSetup2FA();
        }
      } catch (e) {
        // Silencia e segue com fluxo padrão (campo de código)
      }
    };

    maybeAutoSetup();
  }, [username, navigate, token]);

  const handleSetup2FA = async () => {
    setLoadingSetup(true);
    setError('');

    try {
      const API_BASE = API_PREFIX;
      const response = await fetch(`${API_BASE}/auth/setup-2fa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao configurar 2FA');
      }

      const data = await response.json();
      setQrCode(data.qr_code);
      setSecret(data.secret);
      setRequiresSetup(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao configurar 2FA');
    } finally {
      setLoadingSetup(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verify2FA(username, code);
      // Navegação será feita pelo contexto após sucesso
    } catch (err: any) {
      if (err.message === 'REQUIRES_SETUP') {
        setError('Você precisa configurar o 2FA primeiro');
        await handleSetup2FA();
      } else {
        setError(err.message || 'Código inválido');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  if (requiresSetup && qrCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-5xl w-full bg-white p-8 rounded-xl shadow-2xl">
          <div className="mb-6">
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Configurar Autenticação de Dois Fatores
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Esta é sua primeira vez usando 2FA
            </p>
          </div>

          {/* Layout em 2 colunas: QR à esquerda, código manual e input à direita */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna Esquerda: QR Code */}
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg flex flex-col items-center justify-center">
              <h3 className="font-semibold text-blue-900 mb-3 text-center">Passo 1: Escanear QR Code</h3>
              <p className="text-sm text-blue-700 mb-4 text-center">
                Abra o Microsoft Authenticator e escaneie:
              </p>
              <div className="bg-white p-4 rounded shadow-sm">
                <img src={qrCode} alt="QR Code" className="w-56 h-56" />
              </div>
            </div>

            {/* Coluna Direita: Código Manual + Input */}
            <div className="space-y-4">
              {/* Passo 2: Código Manual */}
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Passo 2: Código Manual (opcional)</h3>
                <p className="text-sm text-gray-700 mb-2">
                  Se não conseguir escanear, insira manualmente:
                </p>
                <code className="block bg-white px-3 py-2 rounded border border-gray-300 text-center font-mono text-base break-all">
                  {secret}
                </code>
              </div>

              {/* Passo 3: Digite o Código */}
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Passo 3: Digite o Código</h3>
                <p className="text-sm text-green-700 mb-3">
                  Após configurar, digite o código de 6 dígitos:
                </p>
                
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                      <span className="block">{error}</span>
                    </div>
                  )}

                  <input
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    maxLength={6}
                    placeholder="000000"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-center text-2xl tracking-widest font-mono mb-3"
                    disabled={loading}
                    autoFocus
                  />

                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verificando...' : 'Confirmar e Entrar'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Autenticação de Dois Fatores
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Digite o código de 6 dígitos do seu aplicativo autenticador
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1 text-center">
              Código de Verificação
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={handleCodeChange}
              maxLength={6}
              placeholder="000000"
              autoComplete="one-time-code"
              required
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-center text-2xl tracking-widest font-mono"
              disabled={loading}
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500 text-center">
              Abra o Microsoft Authenticator para ver o código
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verificando...
                </span>
              ) : (
                'Verificar'
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Voltar ao login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TwoFactorAuth;
