import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCurrencies, createCurrency, updateCurrency } from '@/api/currencies'
import { queryKeys } from '@/lib/query-keys'
import type { UpdateCurrencyRequest } from '@/types/api'

export function useCurrencies() {
  return useQuery({
    queryKey: queryKeys.currencies,
    queryFn: getCurrencies,
    select: (data) => data.data,
    staleTime: Infinity,
  })
}

export function useCreateCurrency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCurrency,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currencies })
    },
  })
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      code,
      data,
    }: {
      code: string
      data: UpdateCurrencyRequest
    }) => updateCurrency(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.currencies })
    },
  })
}
