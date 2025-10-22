import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_PREFIX, APP_BASE_PATH } from '../lib/config'

// Configuração do axios
const api = axios.create({
  baseURL: API_PREFIX,
  timeout: 10000,
})

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Redirect to login respecting possible subpath (e.g. /autocare)
      window.location.href = `${APP_BASE_PATH || ''}/login`
    }
    return Promise.reject(error)
  }
)

export { api }

// Retorna o cliente axios para chamadas diretas (compatível com componentes existentes)
export function useApi() {
  return api
}

// Hook para fazer chamadas à API (fetch direto com URL) - renomeado para evitar ambiguidade
export function useApiFetch<T>(url: string, options?: any) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [url])

  async function fetchData() {
    try {
      setLoading(true)
      const response = await api.get(url, options)
      setData(response.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, error, refetch: () => fetchData() }
}

// Hook para mutações (POST, PUT, DELETE)
export function useMutation<T = any, R = any>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async (
    method: 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: T
  ): Promise<R> => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await api({
        method,
        url,
        data,
      })
      
      return response.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { mutate, loading, error }
}