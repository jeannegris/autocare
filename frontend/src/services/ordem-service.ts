import { apiFetch } from '@/lib/api'
import type { 
  OrdemServicoNova, 
  OrdemServicoList,
  ClienteBuscaResponse,
  ClienteCadastroForm,
  ProdutoAutocomplete
} from '@/types/ordem-servico'

// ============= CLIENTES ============= (v2 - usando GET)
export async function buscarCliente(documento: string): Promise<ClienteBuscaResponse | null> {
  console.log('🔍 [v2-GET] Buscando cliente com documento:', documento);
  try {
    // Teste com GET para verificar se é problema de cache
    const response = await apiFetch(`/ordens/buscar-cliente?documento=${encodeURIComponent(documento)}`)
    console.log('✅ [v2-GET] Resposta da busca:', response);
    return response
  } catch (error: any) {
    console.error('❌ [v2-GET] Erro na busca de cliente:', error);
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

export async function criarCliente(dados: ClienteCadastroForm): Promise<any> {
  return apiFetch('/clientes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dados)
  })
}

// ============= PRODUTOS =============
export async function buscarProdutos(termo: string): Promise<ProdutoAutocomplete[]> {
  if (!termo.trim()) return []
  
  const response = await apiFetch(`/ordens/produtos/autocomplete?q=${encodeURIComponent(termo)}`)
  return response
}

// ============= ORDENS =============
export async function criarOrdem(ordem: OrdemServicoNova): Promise<OrdemServicoNova> {
  return apiFetch('/ordens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ordem)
  })
}

export async function listarOrdens(params?: {
  status?: string
  cliente_id?: number
  veiculo_id?: number
  data_inicio?: string
  data_fim?: string
}): Promise<OrdemServicoList[]> {
  const searchParams = new URLSearchParams()
  
  if (params?.status) searchParams.set('status', params.status)
  if (params?.cliente_id) searchParams.set('cliente_id', params.cliente_id.toString())
  if (params?.veiculo_id) searchParams.set('veiculo_id', params.veiculo_id.toString())
  if (params?.data_inicio) searchParams.set('data_inicio', params.data_inicio)
  if (params?.data_fim) searchParams.set('data_fim', params.data_fim)
  
  const queryString = searchParams.toString()
  const url = queryString ? `/ordens?${queryString}` : '/ordens'
  
  return apiFetch(url)
}

export async function obterOrdem(id: number): Promise<OrdemServicoNova> {
  return apiFetch(`/ordens/${id}`)
}

export async function atualizarOrdem(id: number, dados: Partial<OrdemServicoNova>): Promise<OrdemServicoNova> {
  return apiFetch(`/ordens/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dados)
  })
}

export async function excluirOrdem(id: number): Promise<void> {
  await apiFetch(`/ordens/${id}`, {
    method: 'DELETE'
  })
}

// ============= ESTATÍSTICAS =============
export async function obterEstatisticasOrdens(): Promise<{
  total: number
  pendentes: number
  em_andamento: number
  aguardando_peca: number
  aguardando_aprovacao: number
  concluidas: number
  canceladas: number
  valor_total: number
  valor_mes_atual: number
}> {
  return apiFetch('/ordens/estatisticas')
}