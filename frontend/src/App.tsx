// React import not required with the automatic JSX runtime
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'

console.log('🚀 AutoCare App - Build atualizado:', new Date().toISOString())

// Contexto de Autenticação
import { AuthProvider } from './contexts/AuthContext'

// Componentes
import ProtectedRoute from './components/ProtectedRoute'

// Páginas de Autenticação
import Login from './pages/Login'
import TwoFactorAuth from './pages/TwoFactorAuth'

// Páginas principais
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Veiculos from './pages/Veiculos'
import Estoque from './pages/Estoque'
import OrdensServico from './pages/OrdensServico'
import Fornecedores from './pages/Fornecedores'
import Relatorios from './pages/Relatorios'
import Configuracoes from './pages/Configuracoes'
import GerenciarUsuarios from './pages/GerenciarUsuarios'
import GerenciarPerfis from './pages/GerenciarPerfis'

// Layout
import Layout from './components/Layout'

// Configuração do React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router basename="/autocare">
        <AuthProvider>
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/2fa" element={<TwoFactorAuth />} />

            {/* Rotas Protegidas */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/clientes" element={
              <ProtectedRoute>
                <Layout>
                  <Clientes />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/veiculos" element={
              <ProtectedRoute>
                <Layout>
                  <Veiculos />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/estoque" element={
              <ProtectedRoute>
                <Layout>
                  <Estoque />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ordens-servico" element={
              <ProtectedRoute>
                <Layout>
                  <OrdensServico />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/fornecedores" element={
              <ProtectedRoute>
                <Layout>
                  <Fornecedores />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/relatorios" element={
              <ProtectedRoute>
                <Layout>
                  <Relatorios />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/configuracoes" element={
              <ProtectedRoute>
                <Layout>
                  <Configuracoes />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/usuarios" element={
              <ProtectedRoute>
                <Layout>
                  <GerenciarUsuarios />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/perfis" element={
              <ProtectedRoute>
                <Layout>
                  <GerenciarPerfis />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App