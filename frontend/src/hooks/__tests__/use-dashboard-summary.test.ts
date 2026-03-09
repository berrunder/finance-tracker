import { describe, it, expect } from 'vitest'
import type { MonthlyIncomeExpenseItem } from '@/types/api'
import {
  formatMonthLabel,
  buildExpectedMonths,
  toYearMonth,
  normalizeMonths,
} from '../use-dashboard-summary'

describe('formatMonthLabel', () => {
  it('formats "2026-01" as "Jan 2026"', () => {
    expect(formatMonthLabel('2026-01')).toBe('Jan 2026')
  })

  it('formats "2025-12" as "Dec 2025"', () => {
    expect(formatMonthLabel('2025-12')).toBe('Dec 2025')
  })
})

describe('buildExpectedMonths', () => {
  it('returns 3 month keys ending with current month', () => {
    const now = new Date(2026, 2, 15) // March 15, 2026
    const result = buildExpectedMonths(now)
    expect(result).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('handles year boundary', () => {
    const now = new Date(2026, 1, 1) // Feb 1, 2026
    const result = buildExpectedMonths(now)
    expect(result).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})

describe('toYearMonth', () => {
  it('extracts year-month from full date string', () => {
    expect(toYearMonth('2026-01-01')).toBe('2026-01')
  })

  it('works with year-month only input', () => {
    expect(toYearMonth('2026-03')).toBe('2026-03')
  })
})

describe('normalizeMonths', () => {
  const expectedKeys = ['2026-01', '2026-02', '2026-03']
  const currentKey = '2026-03'

  it('maps API data (full dates) to DashboardMonth with labels and isCurrent', () => {
    const data: MonthlyIncomeExpenseItem[] = [
      { month: '2026-01-01', income: '100.00', expense: '50.00' },
      { month: '2026-02-01', income: '200.00', expense: '150.00' },
      { month: '2026-03-01', income: '300.00', expense: '250.00' },
    ]

    const result = normalizeMonths(data, expectedKeys, currentKey)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      key: '2026-01',
      label: 'Jan 2026',
      income: '100.00',
      expense: '50.00',
      isCurrent: false,
    })
    expect(result[2].isCurrent).toBe(true)
  })

  it('pads missing months with zero values', () => {
    const data: MonthlyIncomeExpenseItem[] = [
      { month: '2026-03-01', income: '500.00', expense: '400.00' },
    ]

    const result = normalizeMonths(data, expectedKeys, currentKey)

    expect(result[0]).toMatchObject({
      key: '2026-01',
      income: '0.00',
      expense: '0.00',
    })
    expect(result[1]).toMatchObject({
      key: '2026-02',
      income: '0.00',
      expense: '0.00',
    })
    expect(result[2]).toMatchObject({
      key: '2026-03',
      income: '500.00',
      expense: '400.00',
    })
  })

  it('handles empty data (all months padded)', () => {
    const result = normalizeMonths([], expectedKeys, currentKey)

    expect(result).toHaveLength(3)
    for (const m of result) {
      expect(m.income).toBe('0.00')
      expect(m.expense).toBe('0.00')
    }
    expect(result[2].isCurrent).toBe(true)
  })
})
