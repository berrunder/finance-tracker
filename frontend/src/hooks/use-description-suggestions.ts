import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTransactionDescriptions } from '@/api/transactions'
import { isNetworkError } from '@/api/client'
import { getAllOfflineTransactions } from '@/lib/db'
import { queryKeys } from '@/lib/query-keys'
import { useIsMobile } from '@/hooks/use-mobile'

const DESKTOP_LIMIT = 15
const MOBILE_LIMIT = 5
const MIN_SEARCH_LENGTH = 2
const DEBOUNCE_MS = 200

function getOfflineDescriptions(
  transactions: { description: string; date: string }[],
  search: string,
): string[] {
  const lower = search.toLowerCase()
  const grouped = new Map<string, string>()
  for (const t of transactions) {
    if (
      t.description.length === 0 ||
      !t.description.toLowerCase().includes(lower)
    ) {
      continue
    }

    const existing = grouped.get(t.description)
    if (!existing || t.date > existing) {
      grouped.set(t.description, t.date)
    }
  }

  return [...grouped.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([desc]) => desc)
}

export function useDescriptionSuggestions(search: string): string[] {
  const isMobile = useIsMobile()
  const limit = isMobile ? MOBILE_LIMIT : DESKTOP_LIMIT

  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    const effective = search.length < MIN_SEARCH_LENGTH ? '' : search
    const timer = setTimeout(() => setDebouncedSearch(effective), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const { data = [] } = useQuery({
    queryKey: queryKeys.transactions.descriptions(debouncedSearch),
    queryFn: async () => {
      try {
        const result = await getTransactionDescriptions(debouncedSearch)
        return result.data
      } catch (error) {
        if (isNetworkError(error)) {
          const cached = await getAllOfflineTransactions()
          return getOfflineDescriptions(cached, debouncedSearch)
        }
        throw error
      }
    },
    enabled: debouncedSearch.length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
  })

  return data.slice(0, limit)
}
