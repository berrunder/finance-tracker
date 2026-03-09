import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { useIncomeExpense } from '@/hooks/use-reports'
import { toISODate } from '@/lib/dates'
import type { MonthlyIncomeExpenseItem } from '@/types/api'

export interface DashboardMonth {
  key: string
  label: string
  income: string
  expense: string
  isCurrent: boolean
}

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  return format(new Date(Number(year), Number(month) - 1, 1), 'MMM yyyy')
}

export function buildExpectedMonths(now: Date): string[] {
  const start = startOfMonth(now)
  return [
    format(subMonths(start, 2), 'yyyy-MM'),
    format(subMonths(start, 1), 'yyyy-MM'),
    format(start, 'yyyy-MM'),
  ]
}

export function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function normalizeMonths(
  data: MonthlyIncomeExpenseItem[],
  expectedKeys: string[],
  currentKey: string,
): DashboardMonth[] {
  const byMonth = new Map(data.map((item) => [toYearMonth(item.month), item]))

  return expectedKeys.map((key) => {
    const item = byMonth.get(key)
    return {
      key,
      label: formatMonthLabel(key),
      income: item?.income ?? '0.00',
      expense: item?.expense ?? '0.00',
      isCurrent: key === currentKey,
    }
  })
}

export function useDashboardSummary() {
  const now = new Date()
  const dateFrom = toISODate(startOfMonth(subMonths(now, 2)))
  const dateTo = toISODate(endOfMonth(now))

  const { data, isLoading, isError, refetch } = useIncomeExpense({
    date_from: dateFrom,
    date_to: dateTo,
  })

  const expectedKeys = buildExpectedMonths(now)
  const currentKey = format(startOfMonth(now), 'yyyy-MM')
  const months = normalizeMonths(data ?? [], expectedKeys, currentKey)

  return { months, isLoading, isError, refetch }
}
