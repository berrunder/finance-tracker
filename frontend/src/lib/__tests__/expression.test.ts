import { describe, expect, it } from 'vitest'
import { evaluateExpression } from '../expression'

describe('evaluateExpression', () => {
  it('returns null for plain numbers (no transformation needed)', () => {
    expect(evaluateExpression('42')).toBeNull()
    expect(evaluateExpression('3.14')).toBeNull()
    expect(evaluateExpression('0')).toBeNull()
    expect(evaluateExpression('100.50')).toBeNull()
  })

  it('returns null for empty or whitespace input', () => {
    expect(evaluateExpression('')).toBeNull()
    expect(evaluateExpression('   ')).toBeNull()
  })

  it('evaluates addition', () => {
    expect(evaluateExpression('100+50')).toBe('150')
    expect(evaluateExpression('1.5+2.5')).toBe('4')
  })

  it('evaluates subtraction', () => {
    expect(evaluateExpression('3000-279')).toBe('2721')
    expect(evaluateExpression('100-200')).toBe('-100')
  })

  it('evaluates multiplication', () => {
    expect(evaluateExpression('25*4')).toBe('100')
    expect(evaluateExpression('1.5*2')).toBe('3')
  })

  it('evaluates division', () => {
    expect(evaluateExpression('100/4')).toBe('25')
    expect(evaluateExpression('10/3')).toBe('3.33')
  })

  it('respects standard operator precedence', () => {
    expect(evaluateExpression('2+3*4')).toBe('14')
    expect(evaluateExpression('10-2*3')).toBe('4')
    expect(evaluateExpression('100+50/2')).toBe('125')
  })

  it('handles chained operations', () => {
    expect(evaluateExpression('1+2+3')).toBe('6')
    expect(evaluateExpression('10-3-2')).toBe('5')
    expect(evaluateExpression('2*3*4')).toBe('24')
  })

  it('handles mixed operations', () => {
    expect(evaluateExpression('10+5*2-3')).toBe('17')
    expect(evaluateExpression('100/4+25')).toBe('50')
  })

  it('returns null for division by zero', () => {
    expect(evaluateExpression('100/0')).toBeNull()
  })

  it('returns null for invalid expressions', () => {
    expect(evaluateExpression('3000-')).toBeNull()
    expect(evaluateExpression('+5')).toBeNull()
    expect(evaluateExpression('*5')).toBeNull()
    expect(evaluateExpression('abc')).toBeNull()
    expect(evaluateExpression('10+abc')).toBeNull()
    expect(evaluateExpression('10+')).toBeNull()
  })

  it('returns null for a standalone negative number', () => {
    expect(evaluateExpression('-100')).toBeNull()
  })

  it('handles negative first operand', () => {
    expect(evaluateExpression('-100+50')).toBe('-50')
    expect(evaluateExpression('-5*3')).toBe('-15')
  })

  it('handles spaces in expression', () => {
    expect(evaluateExpression('100 + 50')).toBe('150')
    expect(evaluateExpression(' 3000 - 279 ')).toBe('2721')
  })

  it('respects custom decimal precision', () => {
    expect(evaluateExpression('10/3', 6)).toBe('3.333333')
    expect(evaluateExpression('10/3', 0)).toBe('3')
  })

  it('removes trailing zeros', () => {
    expect(evaluateExpression('5+5')).toBe('10')
    expect(evaluateExpression('1.10+0.90')).toBe('2')
  })

  it('handles double-minus (subtracting a negative)', () => {
    expect(evaluateExpression('5--3')).toBe('8')
  })

  it('handles plus-minus', () => {
    expect(evaluateExpression('5+-3')).toBe('2')
  })
})
