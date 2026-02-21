import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  getTransaction,
  getTransactions,
  type TransactionFilters,
  updateTransaction,
  updateTransfer,
} from '@/api/transactions'
import { queryKeys } from '@/lib/query-keys'
import type {
  UpdateTransactionRequest,
  UpdateTransferRequest,
} from '@/types/api'

function invalidateTransactionRelated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { page: _, ...filterKey } = filters
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filterKey),
    queryFn: ({ pageParam = 1 }) =>
      getTransactions({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, per_page, total } = lastPage.pagination
      return page * per_page < total ? page + 1 : undefined
    },
  })
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: queryKeys.transactions.detail(id),
    queryFn: () => getTransaction(id),
    enabled: !!id,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransfer,
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateTransactionRequest
    }) => updateTransaction(id, data),
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useUpdateTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransferRequest }) =>
      updateTransfer(id, data),
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}
