import { describe, it, expect } from 'vitest'
import type { Account, ExchangeRate } from '@/types/api'
import { convertToBase, groupAccountsByType } from '../account-groups'

function makeAccount(overrides: Partial<Account> & { name: string }): Account {
  return {
    id: overrides.name,
    type: 'deposit',
    currency: 'USD',
    initial_balance: '0.00',
    balance: '100.00',
    recent_tx_count: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

const usdToEur: ExchangeRate = {
  id: '1',
  from_currency: 'USD',
  to_currency: 'EUR',
  rate: '0.90',
  date: '2024-01-01',
}

describe('convertToBase', () => {
  it('returns balance unchanged when currencies match', () => {
    const result = convertToBase('100.00', 'USD', 'USD', [])
    expect(result.toFixed(2)).toBe('100.00')
  })

  it('converts using direct rate', () => {
    const result = convertToBase('100.00', 'USD', 'EUR', [usdToEur])
    expect(result.toFixed(2)).toBe('90.00')
  })

  it('converts using inverse rate', () => {
    const result = convertToBase('100.00', 'EUR', 'USD', [usdToEur])
    expect(result.toFixed(2)).toBe('111.11')
  })

  it('returns 0 when no rate found', () => {
    const result = convertToBase('100.00', 'GBP', 'USD', [usdToEur])
    expect(result.toFixed(2)).toBe('0.00')
  })
})

describe('groupAccountsByType', () => {
  it('groups accounts by type in correct order', () => {
    const accounts = [
      makeAccount({ name: 'Savings', type: 'deposit' }),
      makeAccount({ name: 'Wallet', type: 'cash' }),
      makeAccount({ name: 'Visa', type: 'credit_card' }),
      makeAccount({ name: 'Main Card', type: 'debit_card' }),
    ]

    const groups = groupAccountsByType(accounts, 'USD', [])
    const types = groups.map((g) => g.type)
    expect(types).toEqual(['debit_card', 'cash', 'deposit', 'credit_card'])
  })

  it('excludes empty groups', () => {
    const accounts = [makeAccount({ name: 'Cash', type: 'cash' })]

    const groups = groupAccountsByType(accounts, 'USD', [])
    expect(groups).toHaveLength(1)
    expect(groups[0].type).toBe('cash')
  })

  it('sorts accounts within a group alphabetically (case-insensitive)', () => {
    const accounts = [
      makeAccount({ name: 'charlie', type: 'deposit' }),
      makeAccount({ name: 'Alpha', type: 'deposit' }),
      makeAccount({ name: 'bravo', type: 'deposit' }),
    ]

    const groups = groupAccountsByType(accounts, 'USD', [])
    expect(groups[0].accounts.map((a) => a.name)).toEqual([
      'Alpha',
      'bravo',
      'charlie',
    ])
  })

  it('sums balances in base currency', () => {
    const accounts = [
      makeAccount({
        name: 'USD Savings',
        type: 'deposit',
        balance: '200.00',
        currency: 'USD',
      }),
      makeAccount({
        name: 'EUR Savings',
        type: 'deposit',
        balance: '100.00',
        currency: 'EUR',
      }),
    ]

    const groups = groupAccountsByType(accounts, 'USD', [usdToEur])
    expect(groups[0].total).toBe('311.11')
    expect(groups[0].totalCurrency).toBe('USD')
  })
})
