import { useQuery } from '@tanstack/react-query'
import { getExchangeRates } from '@/api/exchange-rates'
import { queryKeys } from '@/lib/query-keys'

export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.exchangeRates,
    queryFn: getExchangeRates,
    select: (data) => data.data,
    staleTime: Infinity,
  })
}
