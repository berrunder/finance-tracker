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
    spending: (params: Record<string, unknown>) =>
      ['reports', 'spending', params] as const,
    incomeExpense: (params: Record<string, unknown>) =>
      ['reports', 'income-expense', params] as const,
    balanceHistory: (params: Record<string, unknown>) =>
      ['reports', 'balance-history', params] as const,
    summary: (params: Record<string, unknown>) =>
      ['reports', 'summary', params] as const,
  },
  exchangeRates: ['exchange-rates'] as const,
} as const
