import Decimal from 'decimal.js'

export function formatMoney(amount: string, currency: string): string {
  const decimal = new Decimal(amount)
  return new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency,
  }).format(decimal.toNumber())
}

export function parseDecimal(value: string): Decimal {
  return new Decimal(value)
}
