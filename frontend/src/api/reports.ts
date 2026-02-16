import { apiClient } from './client'
import { buildQueryString } from '@/lib/query-string'
import type {
  SpendingByCategoryItem,
  MonthlyIncomeExpenseItem,
  BalanceHistoryItem,
  SummaryResponse,
} from '@/types/api'

export interface ReportFilters {
  date_from?: string
  date_to?: string
  account_id?: string
}

export function getSpendingByCategory(
  filters: ReportFilters = {},
): Promise<{ data: SpendingByCategoryItem[] }> {
  return apiClient<{ data: SpendingByCategoryItem[] }>(
    `/reports/spending${buildQueryString(filters)}`,
  )
}

export function getIncomeExpense(
  filters: ReportFilters = {},
): Promise<{ data: MonthlyIncomeExpenseItem[] }> {
  return apiClient<{ data: MonthlyIncomeExpenseItem[] }>(
    `/reports/income-expense${buildQueryString(filters)}`,
  )
}

export function getBalanceHistory(
  filters: ReportFilters,
): Promise<{ data: BalanceHistoryItem[] }> {
  return apiClient<{ data: BalanceHistoryItem[] }>(
    `/reports/balance-history${buildQueryString(filters)}`,
  )
}

export function getSummary(
  filters: ReportFilters = {},
): Promise<SummaryResponse> {
  return apiClient<SummaryResponse>(
    `/reports/summary${buildQueryString(filters)}`,
  )
}
