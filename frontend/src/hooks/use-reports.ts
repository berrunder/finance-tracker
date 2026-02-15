import { useQuery } from '@tanstack/react-query'
import {
  getSpendingByCategory,
  getIncomeExpense,
  getBalanceHistory,
  getSummary,
  type ReportFilters,
} from '@/api/reports'
import { queryKeys } from '@/lib/query-keys'

export function useSpendingByCategory(filters: ReportFilters = {}) {
  return useQuery({
    queryKey: queryKeys.reports.spending(filters),
    queryFn: () => getSpendingByCategory(filters),
    select: (data) => data.data,
  })
}

export function useIncomeExpense(filters: ReportFilters = {}) {
  return useQuery({
    queryKey: queryKeys.reports.incomeExpense(filters),
    queryFn: () => getIncomeExpense(filters),
    select: (data) => data.data,
  })
}

export function useBalanceHistory(filters: ReportFilters) {
  return useQuery({
    queryKey: queryKeys.reports.balanceHistory(filters),
    queryFn: () => getBalanceHistory(filters),
    select: (data) => data.data,
    enabled: !!filters.account_id,
  })
}

export function useSummary(filters: ReportFilters = {}) {
  return useQuery({
    queryKey: queryKeys.reports.summary(filters),
    queryFn: () => getSummary(filters),
  })
}
