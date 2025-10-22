import * as React from 'react'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface AccordionProps {
  title: string | React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  variant?: 'default' | 'warning' | 'danger' | 'info' | 'success'
  badge?: string | number
  className?: string
}

/**
 * Componente Accordion (Acordeão)
 * Permite expandir/colapsar conteúdo com animação suave
 */
export function Accordion({
  title,
  children,
  defaultOpen = false,
  variant = 'default',
  badge,
  className = ''
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const variantStyles = {
    default: {
      bg: 'bg-gray-50 hover:bg-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-900',
      icon: 'text-gray-600'
    },
    warning: {
      bg: 'bg-yellow-50 hover:bg-yellow-100',
      border: 'border-yellow-400 border-l-4',
      text: 'text-yellow-900',
      icon: 'text-yellow-600'
    },
    danger: {
      bg: 'bg-red-50 hover:bg-red-100',
      border: 'border-red-400 border-l-4',
      text: 'text-red-900',
      icon: 'text-red-600'
    },
    info: {
      bg: 'bg-blue-50 hover:bg-blue-100',
      border: 'border-blue-400 border-l-4',
      text: 'text-blue-900',
      icon: 'text-blue-600'
    },
    success: {
      bg: 'bg-green-50 hover:bg-green-100',
      border: 'border-green-400 border-l-4',
      text: 'text-green-900',
      icon: 'text-green-600'
    }
  }

  const styles = variantStyles[variant]

  return (
    <div className={`rounded-lg border ${styles.border} ${className}`}>
      {/* Header - Sempre visível */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 flex items-center justify-between ${styles.bg} ${styles.text} transition-colors duration-200 rounded-t-lg ${!isOpen ? 'rounded-b-lg' : ''}`}
      >
        <div className="flex items-center gap-3 flex-1">
          <span className="font-medium text-sm flex items-center gap-2">
            {title}
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                variant === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                variant === 'danger' ? 'bg-red-200 text-red-800' :
                variant === 'info' ? 'bg-blue-200 text-blue-800' :
                variant === 'success' ? 'bg-green-200 text-green-800' :
                'bg-gray-200 text-gray-800'
              }`}>
                {badge}
              </span>
            )}
          </span>
        </div>
        <div className={`${styles.icon} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown className="h-5 w-5" />
        </div>
      </button>

      {/* Conteúdo - Animado */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 bg-white rounded-b-lg">
          {children}
        </div>
      </div>
    </div>
  )
}

interface AccordionGroupProps {
  children: React.ReactNode
  className?: string
  allowMultiple?: boolean
}

/**
 * Componente AccordionGroup
 * Agrupa múltiplos acordeões com espaçamento adequado
 * allowMultiple permite controlar se múltiplos acordeões podem estar abertos ao mesmo tempo
 */
export function AccordionGroup({
  children,
  className = '',
  allowMultiple = true
}: AccordionGroupProps) {
  // TODO: Implementar controle de múltiplos acordeões abertos quando allowMultiple = false
  // Por enquanto, apenas agrupa os acordeões com espaçamento
  return (
    <div className={`space-y-3 ${className}`} data-allow-multiple={allowMultiple}>
      {children}
    </div>
  )
}

export default Accordion
