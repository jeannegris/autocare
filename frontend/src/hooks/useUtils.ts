import { useState, useEffect } from 'react'

// Hook para localStorage
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Erro ao ler localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(`Erro ao salvar localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue] as const
}

// Hook para autenticação
export function useAuth() {
  const [user, setUser] = useLocalStorage<any | null>('user', null)
  const [token, setToken] = useLocalStorage<string | null>('token', null)

  const login = (userData: any, authToken: string | null) => {
    setUser(userData)
    setToken(authToken)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
  }

  const isAuthenticated = !!token

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout
  }
}

// Hook para debounce
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook para paginação
export function usePagination(totalItems: number, itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const goToNextPage = () => {
    goToPage(currentPage + 1)
  }

  const goToPreviousPage = () => {
    goToPage(currentPage - 1)
  }

  const reset = () => {
    setCurrentPage(1)
  }

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    reset,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  }
}

// Hook para filtros de busca
export function useFilters<T>(data: T[], searchField: keyof T) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})

  const filteredData = data.filter(item => {
    // Filtro por termo de busca
    const matchesSearch = searchTerm === '' || 
      String(item[searchField]).toLowerCase().includes(searchTerm.toLowerCase())

    // Filtros adicionais
    const matchesFilters = Object.entries(filters).every(([key, value]) => {
      if (value === '' || value === null || value === undefined) return true
      return item[key as keyof T] === value
    })

    return matchesSearch && matchesFilters
  })

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilters({})
  }

  return {
    searchTerm,
    setSearchTerm,
    filters,
    updateFilter,
    clearFilters,
    filteredData
  }
}