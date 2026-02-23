import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { OrdemServicoNova } from '@/types/ordem-servico'
import * as ordemService from '@/services/ordem-service'

// ============= QUERY KEYS =============
export const ordemQueryKeys = {
  all: ['ordens'] as const,
  lists: () => [...ordemQueryKeys.all, 'list'] as const,
  list: (filters: any) => [...ordemQueryKeys.lists(), { filters }] as const,
  details: () => [...ordemQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...ordemQueryKeys.details(), id] as const,
  estatisticas: () => [...ordemQueryKeys.all, 'estatisticas'] as const,
  produtos: ['produtos'] as const,
  produtoSearch: (termo: string) => [...ordemQueryKeys.produtos, 'search', termo] as const,
  clientes: ['clientes'] as const,
  clienteBusca: (documento: string) => [...ordemQueryKeys.clientes, 'busca', documento] as const,
}

// ============= HOOKS PARA CLIENTES =============
export function useBuscarCliente(documento: string, enabled = false) {
  return useQuery({
    queryKey: ordemQueryKeys.clienteBusca(documento),
    queryFn: () => ordemService.buscarCliente(documento),
    enabled: enabled && documento.length > 0,
    retry: false,
    staleTime: 1000 * 60, // 1 minuto
  })
}

export function useCriarCliente() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ordemService.criarCliente,
    onSuccess: () => {
      // Invalidar cache de busca de clientes
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.clientes })
    },
  })
}

// ============= HOOKS PARA PRODUTOS =============
export function useBuscarProdutos(termo: string, enabled = false) {
  return useQuery({
    queryKey: ordemQueryKeys.produtoSearch(termo),
    queryFn: () => ordemService.buscarProdutos(termo),
    enabled: enabled && termo.trim().length >= 2,
    retry: false,
    staleTime: 1000 * 30, // 30 segundos
  })
}

// ============= HOOKS PARA ORDENS =============
export function useListarOrdens(params?: Parameters<typeof ordemService.listarOrdens>[0]) {
  return useQuery({
    queryKey: ordemQueryKeys.list(params),
    queryFn: () => ordemService.listarOrdens(params),
    staleTime: 1000 * 30, // 30 segundos
  })
}

export function useObterOrdem(id: number, enabled = true) {
  return useQuery({
    queryKey: ordemQueryKeys.detail(id),
    queryFn: () => ordemService.obterOrdem(id),
    enabled: enabled && id > 0,
    staleTime: 1000 * 60, // 1 minuto
  })
}

export function useCriarOrdem() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ordemService.criarOrdem,
    onSuccess: () => {
      // Invalidar listas e estatísticas
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.estatisticas() })
    },
  })
}

export function useAtualizarOrdem() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: Partial<OrdemServicoNova> }) =>
      ordemService.atualizarOrdem(id, dados),
    onSuccess: (_, variables) => {
      // Invalidar dados específicos da ordem e listas
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.estatisticas() })
    },
  })
}

export function useAtualizarStatusOrdem() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, status, motivo_cancelamento }: { id: number; status: string; motivo_cancelamento?: string }) =>
      ordemService.atualizarOrdem(id, { status, motivo_cancelamento }),
    onSuccess: (_, variables) => {
      // Invalidar dados específicos da ordem e listas
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.estatisticas() })
    },
  })
}

export function useExcluirOrdem() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ordemService.excluirOrdem,
    onSuccess: () => {
      // Invalidar listas e estatísticas
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ordemQueryKeys.estatisticas() })
    },
  })
}

// ============= HOOKS PARA ESTATÍSTICAS =============
export function useEstatisticasOrdens() {
  return useQuery({
    queryKey: ordemQueryKeys.estatisticas(),
    queryFn: ordemService.obterEstatisticasOrdens,
    staleTime: 1000 * 60, // 1 minuto
    refetchInterval: 1000 * 60 * 5, // Refetch a cada 5 minutos
  })
}