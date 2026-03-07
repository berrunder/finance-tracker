import Decimal from 'decimal.js'

export function formatMoney(amount: string, currency: string): string {
  const decimal = new Decimal(amount)
  if (!currency) {
    return decimal.toFixed(2)
  }
  return new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency,
  }).format(decimal.toNumber())
}

export function parseDecimal(value: string): Decimal {
  return new Decimal(value)
}
