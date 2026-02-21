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
  },
  exchangeRates: ['exchange-rates'] as const,
  currencies: ['currencies'] as const,
} as const
