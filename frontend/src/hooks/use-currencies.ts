import { useQuery } from '@tanstack/react-query'
import { getCurrencies } from '@/api/currencies'
import { queryKeys } from '@/lib/query-keys'

export function useCurrencies() {
  return useQuery({
    queryKey: queryKeys.currencies,
    queryFn: getCurrencies,
    select: (data) => data.data,
    staleTime: Infinity,
  })
}
