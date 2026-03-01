import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resetUserData } from '@/api/user'
import { queryKeys } from '@/lib/query-keys'

export function useResetData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: resetUserData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}
