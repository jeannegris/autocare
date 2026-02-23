import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  Package, 
  Wrench, 
  Truck, 
  FileText,
  Menu,
  X,
  Settings,
  LogOut,
  User,
  Shield
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard_gerencial', permissionAlt: 'dashboard_operacional' },
  { name: 'Clientes', href: '/clientes', icon: Users, permission: 'clientes' },
  { name: 'Veículos', href: '/veiculos', icon: Car, permission: 'veiculos' },
  { name: 'Estoque', href: '/estoque', icon: Package, permission: 'estoque' },
  { name: 'Ordens de Serviço', href: '/ordens-servico', icon: Wrench, permission: 'ordens_servico' },
  { name: 'Fornecedores', href: '/fornecedores', icon: Truck, permission: 'fornecedores' },
  { name: 'Relatórios', href: '/relatorios', icon: FileText, permission: 'relatorios' },
  { name: 'Usuários', href: '/usuarios', icon: User, permission: 'usuarios' },
  { name: 'Perfis', href: '/perfis', icon: Shield, permission: 'perfis' },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, permission: 'configuracoes' },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { user, logout, hasPermission } = useAuth()

  // Filtrar navegação baseado nas permissões do usuário
  const filteredNavigation = navigation.filter(item => 
    hasPermission(item.permission) || (item.permissionAlt && hasPermission(item.permissionAlt))
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}>
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <div className="flex items-center">
            <Wrench className="w-8 h-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">AutoCare</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="flex-1 px-2 mt-5 space-y-1 overflow-y-auto">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive
                    ? 'bg-blue-100 text-blue-900 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon
                  className={`${
                    isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 flex-shrink-0 h-5 w-5`}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User info e Logout na parte inferior */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-2">
            <div className="flex-shrink-0 p-2 bg-gray-200 rounded-full">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0 ml-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.nome || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-2 py-2 text-sm font-medium text-red-600 transition-colors rounded-md hover:bg-red-50"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <div className="lg:hidden">
          <div className="flex items-center justify-between h-16 px-4 bg-white shadow">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center">
              <Wrench className="w-8 h-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">AutoCare</span>
            </div>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-600"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <main className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="px-4 mx-auto max-w-7xl sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}