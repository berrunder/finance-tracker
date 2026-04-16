import Decimal from 'decimal.js'
import type { Account, ExchangeRate } from '@/types/api'

export const ACCOUNT_TYPE_ORDER = [
  'debit_card',
  'cash',
  'deposit',
  'credit_card',
  'other',
] as const

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  debit_card: 'Debit Cards',
  cash: 'Cash',
  deposit: 'Deposits',
  credit_card: 'Credit Cards',
  other: 'Other',
}

export interface AccountGroup {
  type: string
  label: string
  accounts: Account[]
  total: string
  totalCurrency: string
}

export function convertToBase(
  balance: string,
  fromCurrency: string,
  baseCurrency: string,
  rates: ExchangeRate[],
): Decimal {
  if (fromCurrency === baseCurrency) {
    return new Decimal(balance)
  }

  const direct = rates.find(
    (r) => r.from_currency === fromCurrency && r.to_currency === baseCurrency,
  )
  if (direct) {
    return new Decimal(balance).mul(new Decimal(direct.rate))
  }

  const inverse = rates.find(
    (r) => r.from_currency === baseCurrency && r.to_currency === fromCurrency,
  )
  if (inverse) {
    return new Decimal(balance).div(new Decimal(inverse.rate))
  }

  return new Decimal(0)
}

export function groupAccountsByType(
  accounts: Account[],
  baseCurrency: string,
  rates: ExchangeRate[],
): AccountGroup[] {
  const byType = new Map<string, Account[]>()
  for (const account of accounts) {
    const list = byType.get(account.type) ?? []
    list.push(account)
    byType.set(account.type, list)
  }

  const groups: AccountGroup[] = []
  for (const type of ACCOUNT_TYPE_ORDER) {
    const typeAccounts = byType.get(type)
    if (!typeAccounts || typeAccounts.length === 0) continue

    typeAccounts.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )

    const total = typeAccounts.reduce(
      (sum, a) =>
        sum.add(convertToBase(a.balance, a.currency, baseCurrency, rates)),
      new Decimal(0),
    )

    groups.push({
      type,
      label: ACCOUNT_TYPE_LABELS[type] ?? type,
      accounts: typeAccounts,
      total: total.toFixed(2),
      totalCurrency: baseCurrency,
    })
  }

  return groups
}
