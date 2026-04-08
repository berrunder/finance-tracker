import type { QueryClient } from '@tanstack/react-query'
import type { ReportFilters } from '@/api/reports'

export const queryKeys = {
  auth: ['auth'] as const,
  accounts: {
    all: ['accounts'] as const,
    detail: (id: string) => ['accounts', id] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  transactions: {
    all: ['transactions'] as const,
    list: (filters: Record<string, unknown>) =>
      ['transactions', filters] as const,
    detail: (id: string) => ['transactions', id] as const,
    transfer: (id: string) => ['transactions', 'transfer', id] as const,
    descriptions: (search: string) =>
      ['transactions', 'descriptions', search] as const,
  },
  reports: {
    all: ['reports'] as const,
    spending: (params: ReportFilters) =>
      ['reports', 'spending', params] as const,
    incomeExpense: (params: ReportFilters) =>
      ['reports', 'income-expense', params] as const,
    balanceHistory: (params: ReportFilters) =>
      ['reports', 'balance-history', params] as const,
    summary: (params: ReportFilters) => ['reports', 'summary', params] as const,
    cashFlow: (year: number | null) => ['reports', 'cash-flow', year] as const,
    cashFlowYears: ['reports', 'cash-flow', 'years'] as const,
  },
  exchangeRates: ['exchange-rates'] as const,
  currencies: ['currencies'] as const,
} as const

export function invalidateTransactionRelated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
}
