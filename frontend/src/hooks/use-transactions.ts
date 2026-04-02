import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  getTransaction,
  getTransactions,
  getTransfer,
  type TransactionFilters,
  updateTransaction,
  updateTransfer,
} from '@/api/transactions'
import { isNetworkError, ApiError } from '@/api/client'
import { queryKeys, invalidateTransactionRelated } from '@/lib/query-keys'
import {
  putTransaction,
  putTransactions,
  getOfflineTransaction,
  getOfflineAccount,
  getAllOfflineTransactions,
  deleteOfflineTransaction,
} from '@/lib/db'
import {
  enqueue,
  removeCreateForTempId,
  updateCreatePayload,
} from '@/lib/sync-queue'
import { generateTempId } from '@/lib/sync-engine'
import { useSyncStatus } from './use-sync-status'
import type {
  Transaction,
  CreateTransactionRequest,
  CreateTransferRequest,
  UpdateTransactionRequest,
  UpdateTransferRequest,
} from '@/types/api'

function applyOfflineFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  let result = transactions
  if (filters.account_id?.length) {
    result = result.filter((t) => filters.account_id!.includes(t.account_id))
  }
  if (filters.category_id?.length) {
    result = result.filter(
      (t) => t.category_id && filters.category_id!.includes(t.category_id),
    )
  }
  if (filters.type) {
    result = result.filter((t) => t.type === filters.type)
  }
  if (filters.date_from) {
    result = result.filter((t) => t.date >= filters.date_from!)
  }
  if (filters.date_to) {
    result = result.filter((t) => t.date <= filters.date_to!)
  }
  if (filters.description) {
    const needle = filters.description.toLowerCase()
    result = result.filter((t) => t.description.toLowerCase().includes(needle))
  }
  result.sort((a, b) => b.date.localeCompare(a.date))
  return result
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { page: _, ...filterKey } = filters
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filterKey),
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const data = await getTransactions({ ...filters, page: pageParam })
        await putTransactions(data.data)
        return data
      } catch (error) {
        if (isNetworkError(error)) {
          const cached = await getAllOfflineTransactions()
          const filtered = applyOfflineFilters(cached, filters)
          return {
            data: filtered,
            pagination: {
              page: 1,
              per_page: filtered.length,
              total: filtered.length,
            },
          }
        }
        throw error
      }
    },
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
    queryFn: async () => {
      try {
        const tx = await getTransaction(id)
        await putTransaction(tx)
        return tx
      } catch (error) {
        if (isNetworkError(error)) {
          const cached = await getOfflineTransaction(id)
          if (cached) return cached
        }
        throw error
      }
    },
    enabled: !!id,
  })
}

export function useTransfer(id: string) {
  return useQuery({
    queryKey: queryKeys.transactions.transfer(id),
    queryFn: async () => {
      try {
        const result = await getTransfer(id)
        for (const tx of result.data) {
          await putTransaction(tx)
        }
        return result
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NOT_A_TRANSFER') {
          return { data: [] }
        }
        if (isNetworkError(error)) {
          const mainTx = await getOfflineTransaction(id)
          if (mainTx?.transfer_id) {
            if (mainTx.transfer_id.startsWith('temp_')) {
              const linkedById = await getOfflineTransaction(mainTx.transfer_id)
              if (linkedById) {
                return { data: [mainTx, linkedById] }
              }
            }
            const all = await getAllOfflineTransactions()
            const linked = all.find(
              (t) => t.id !== id && t.transfer_id === mainTx.transfer_id,
            )
            if (linked) {
              return { data: [mainTx, linked] }
            }
          }
        }
        throw error
      }
    },
    enabled: !!id,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  const { refreshPendingCount } = useSyncStatus()

  return useMutation({
    mutationFn: async (data: CreateTransactionRequest) => {
      try {
        const result = await createTransaction(data)
        await putTransaction(result)
        return result
      } catch (error) {
        if (isNetworkError(error)) {
          const tempId = generateTempId()
          const account = await getOfflineAccount(data.account_id)
          const offlineTx: Transaction = {
            id: tempId,
            account_id: data.account_id,
            category_id: data.category_id ?? null,
            type: data.type,
            amount: data.amount,
            currency: account?.currency ?? '',
            description: data.description,
            date: data.date,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          await putTransaction(offlineTx)
          await enqueue({
            operation: 'create',
            endpoint: '/transactions',
            method: 'POST',
            payload: data,
            tempId,
          })
          await refreshPendingCount()
          return offlineTx
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useCreateTransfer() {
  const queryClient = useQueryClient()
  const { refreshPendingCount } = useSyncStatus()

  return useMutation({
    mutationFn: async (data: CreateTransferRequest) => {
      try {
        const result = await createTransfer(data)
        for (const tx of result.data) {
          await putTransaction(tx)
        }
        return result
      } catch (error) {
        if (isNetworkError(error)) {
          const tempId1 = generateTempId()
          const tempId2 = generateTempId()
          const now = new Date().toISOString()
          const [fromAccount, toAccount] = await Promise.all([
            getOfflineAccount(data.from_account_id),
            getOfflineAccount(data.to_account_id),
          ])
          const offlineTxs: Transaction[] = [
            {
              id: tempId1,
              account_id: data.from_account_id,
              category_id: null,
              type: 'expense',
              amount: data.amount,
              currency: fromAccount?.currency ?? '',
              description: data.description,
              date: data.date,
              transfer_id: tempId2,
              created_at: now,
              updated_at: now,
            },
            {
              id: tempId2,
              account_id: data.to_account_id,
              category_id: null,
              type: 'income',
              amount: data.to_amount ?? data.amount,
              currency: toAccount?.currency ?? '',
              description: data.description,
              date: data.date,
              transfer_id: tempId1,
              exchange_rate: data.exchange_rate,
              created_at: now,
              updated_at: now,
            },
          ]
          for (const tx of offlineTxs) {
            await putTransaction(tx)
          }
          await enqueue({
            operation: 'create-transfer',
            endpoint: '/transactions/transfer',
            method: 'POST',
            payload: data,
            tempId: tempId1,
          })
          await refreshPendingCount()
          return { data: offlineTxs }
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  const { refreshPendingCount } = useSyncStatus()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: UpdateTransactionRequest
    }) => {
      try {
        const result = await updateTransaction(id, data)
        await putTransaction(result)
        return result
      } catch (error) {
        if (isNetworkError(error)) {
          if (id.startsWith('temp_')) {
            await updateCreatePayload(id, data)
          } else {
            await enqueue({
              operation: 'update',
              endpoint: `/transactions/${id}`,
              method: 'PUT',
              payload: data,
            })
          }
          const existing = await getOfflineTransaction(id)
          if (existing) {
            const updated = {
              ...existing,
              ...data,
              updated_at: new Date().toISOString(),
            }
            await putTransaction(updated)
          }
          await refreshPendingCount()
          return existing ?? ({ id, ...data } as Transaction)
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useUpdateTransfer() {
  const queryClient = useQueryClient()
  const { refreshPendingCount } = useSyncStatus()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: UpdateTransferRequest
    }) => {
      try {
        const result = await updateTransfer(id, data)
        for (const tx of result.data) {
          await putTransaction(tx)
        }
        return result
      } catch (error) {
        if (isNetworkError(error)) {
          if (id.startsWith('temp_')) {
            const mergedCurrent = await updateCreatePayload(id, data)
            if (!mergedCurrent) {
              const offlineTx = await getOfflineTransaction(id)
              if (offlineTx?.transfer_id?.startsWith('temp_')) {
                await updateCreatePayload(offlineTx.transfer_id, data)
              }
            }
          } else {
            await enqueue({
              operation: 'update-transfer',
              endpoint: `/transactions/transfer/${id}`,
              method: 'PUT',
              payload: data,
            })
          }

          // Update both transfer legs in IndexedDB
          const existing = await getOfflineTransaction(id)
          const updatedTxs: Transaction[] = []
          if (existing) {
            const updated = {
              ...existing,
              from_account_id: data.from_account_id,
              to_account_id: data.to_account_id,
              amount: data.amount,
              description: data.description,
              date: data.date,
              updated_at: new Date().toISOString(),
            }
            await putTransaction(updated)
            updatedTxs.push(updated)

            if (existing.transfer_id) {
              const linked = await getOfflineTransaction(existing.transfer_id)
              if (linked) {
                const updatedLinked = {
                  ...linked,
                  amount: data.to_amount ?? data.amount,
                  description: data.description,
                  date: data.date,
                  updated_at: new Date().toISOString(),
                }
                await putTransaction(updatedLinked)
                updatedTxs.push(updatedLinked)
              }
            }
          }

          await refreshPendingCount()
          return { data: updatedTxs }
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  const { refreshPendingCount } = useSyncStatus()

  return useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('temp_')) {
        const removed = await removeCreateForTempId(id)
        await deleteOfflineTransaction(id)
        const allTx = await getAllOfflineTransactions()
        const linked = allTx.find((t) => t.transfer_id === id)
        if (linked) {
          if (!removed) {
            await removeCreateForTempId(linked.id)
          }
          await deleteOfflineTransaction(linked.id)
        }
        await refreshPendingCount()
        return
      }

      try {
        await deleteTransaction(id)
        await deleteOfflineTransaction(id)
      } catch (error) {
        if (isNetworkError(error)) {
          await deleteOfflineTransaction(id)
          await enqueue({
            operation: 'delete',
            endpoint: `/transactions/${id}`,
            method: 'DELETE',
          })
          await refreshPendingCount()
          return
        }
        throw error
      }
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}
