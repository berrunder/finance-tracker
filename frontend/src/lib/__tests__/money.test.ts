import Decimal from 'decimal.js'
import { computeBarPercent, formatMoney, parseDecimal } from '../money'
import { describe, expect, it } from 'vitest'

// Lock locale for deterministic output
const originalLanguage = navigator.language
beforeAll(() => {
  Object.defineProperty(navigator, 'language', {
    value: 'en-US',
    configurable: true,
  })
})
afterAll(() => {
  Object.defineProperty(navigator, 'language', {
    value: originalLanguage,
    configurable: true,
  })
})

describe('formatMoney', () => {
  it('formats a simple USD amount', () => {
    expect(formatMoney('1234.56', 'USD')).toBe('$1,234.56')
  })

  it('formats zero', () => {
    expect(formatMoney('0', 'USD')).toBe('$0.00')
  })

  it('formats a whole number with trailing decimals', () => {
    expect(formatMoney('100', 'EUR')).toBe('€100.00')
  })

  it('formats large numbers with grouping', () => {
    expect(formatMoney('1000000.99', 'USD')).toBe('$1,000,000.99')
  })

  it('formats negative amounts', () => {
    expect(formatMoney('-42.50', 'USD')).toBe('-$42.50')
  })
})

describe('parseDecimal', () => {
  it('parses a valid decimal string', () => {
    const result = parseDecimal('123.45')
    expect(result).toBeInstanceOf(Decimal)
    expect(result.toString()).toBe('123.45')
  })

  it('parses an integer string', () => {
    expect(parseDecimal('100').toString()).toBe('100')
  })

  it('throws on invalid input', () => {
    expect(() => parseDecimal('abc')).toThrow()
  })

  it('throws on empty string', () => {
    expect(() => parseDecimal('')).toThrow()
  })
})

describe('computeBarPercent', () => {
  it('returns 100 when value equals max', () => {
    expect(computeBarPercent(new Decimal('500'), new Decimal('500'))).toBe(100)
  })

  it('returns 50 when value is half of max', () => {
    expect(computeBarPercent(new Decimal('250'), new Decimal('500'))).toBe(50)
  })

  it('returns 0 when value is zero', () => {
    expect(computeBarPercent(new Decimal('0'), new Decimal('500'))).toBe(0)
  })

  it('returns 0 when max is zero (avoids division by zero)', () => {
    expect(computeBarPercent(new Decimal('0'), new Decimal('0'))).toBe(0)
  })

  it('handles decimal precision', () => {
    const result = computeBarPercent(new Decimal('333.33'), new Decimal('1000'))
    expect(result).toBeCloseTo(33.333, 2)
  })

  it('handles very small values relative to max', () => {
    const result = computeBarPercent(new Decimal('1'), new Decimal('100000'))
    expect(result).toBeCloseTo(0.001, 3)
  })
})
