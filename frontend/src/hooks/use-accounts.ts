import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  createAccount,
  deleteAccount,
  getAccount,
  getAccounts,
  updateAccount,
} from '@/api/accounts'
import { isNetworkError } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'
import { putAccounts, getAllOfflineAccounts } from '@/lib/db'
import type { UpdateAccountRequest } from '@/types/api'

function invalidateAccountRelated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
}

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.all,
    queryFn: async () => {
      try {
        const data = await getAccounts()
        await putAccounts(data.data)
        return data
      } catch (error) {
        if (isNetworkError(error)) {
          const cached = await getAllOfflineAccounts()
          return { data: cached }
        }
        throw error
      }
    },
    select: (data) => data.data,
  })
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: queryKeys.accounts.detail(id),
    queryFn: () => getAccount(id),
    enabled: !!id,
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => invalidateAccountRelated(queryClient),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountRequest }) =>
      updateAccount(id, data),
    onSuccess: () => invalidateAccountRelated(queryClient),
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => invalidateAccountRelated(queryClient),
  })
}
