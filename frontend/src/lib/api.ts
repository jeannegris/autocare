import { API_PREFIX, apiPath as cfgApiPath } from './config'

export function apiPath(path: string) {
  return cfgApiPath(path)
}

export async function apiFetch(path: string, init?: RequestInit) {
  // Evitar cache agressivo do navegador/proxy: para GET, acrescentar um cache-buster
  let url = apiPath(path)
  // Garantir headers padrão quando um body JSON é enviado e o Content-Type não foi especificado
  const initCopy: RequestInit = init ? { ...init } : {}
  try {
    // Normalizar headers para um objeto Headers para facilitar verificações
    const headers = new Headers(initCopy.headers as HeadersInit || {})
    // Sinalizar ao navegador que não deve usar cache do fetch
    headers.set('Cache-Control', 'no-store')
    // Se existir body e não for FormData, definir Content-Type quando não fornecido
    if (initCopy.body && !(initCopy.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    initCopy.headers = headers
  } catch (e) {
    // Fallback silencioso: se algo der errado, apenas use o init original
    initCopy.headers = initCopy.headers || {}
  }

  // Forçar o modo de fetch sem cache quando possível
  if (!('cache' in (initCopy as any))) {
    ;(initCopy as any).cache = 'no-store'
  }

  // Acrescentar parâmetro _ts para GET e HEAD (evita caches intermediários)
  const method = (initCopy.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}_ts=${Date.now()}`
  }

  const res = await fetch(url, initCopy)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err: any = new Error(`API request failed: ${res.status} ${res.statusText}`)
    err.status = res.status
    err.body = text
    
    // tentar parsear JSON para facilitar o tratamento no frontend
    try {
      const jsonData = JSON.parse(text)
      err.json = jsonData
      // Para erros de validação (422), expor o detail diretamente no erro
      if (res.status === 422 && jsonData.detail) {
        err.detail = jsonData.detail
      }
      // Para outros erros estruturados, também expor detalhes
      if (jsonData.detail) {
        err.detail = jsonData.detail
      }
    } catch (_) {
      err.json = null
    }
    throw err
  }
  
  // Handle 204 No Content - no body to parse
  if (res.status === 204) {
    return null;
  }
  
  // try json, fallback to text
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
}

export { API_PREFIX }
