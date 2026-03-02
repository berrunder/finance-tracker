import {
  formatDate,
  formatDateShort,
  toISODate,
  formatDateMask,
} from '../dates'

describe('formatDate', () => {
  it('formats an ISO date string to locale-aware format', () => {
    // date-fns "PP" format for en-US is "MMM d, yyyy"
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024')
  })

  it('formats another date correctly', () => {
    expect(formatDate('2023-12-25')).toBe('Dec 25, 2023')
  })
})

describe('formatDateShort', () => {
  it('formats to short form', () => {
    expect(formatDateShort('2024-01-15')).toBe('Jan 15')
  })

  it('formats single-digit day', () => {
    expect(formatDateShort('2024-03-01')).toBe('Mar 1')
  })
})

describe('toISODate', () => {
  it('converts a Date object to YYYY-MM-DD string', () => {
    const date = new Date(2024, 0, 15) // Jan 15, 2024
    expect(toISODate(date)).toBe('2024-01-15')
  })

  it('pads month and day with zeros', () => {
    const date = new Date(2024, 2, 5) // Mar 5, 2024
    expect(toISODate(date)).toBe('2024-03-05')
  })
})

describe('formatDateMask', () => {
  it('formats ISO date to DD.MM.YYYY', () => {
    expect(formatDateMask('2026-03-02')).toBe('02.03.2026')
  })

  it('pads single-digit day and month', () => {
    expect(formatDateMask('2024-01-05')).toBe('05.01.2024')
  })
})
