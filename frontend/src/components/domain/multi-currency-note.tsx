import { Info } from 'lucide-react'
import type { Account } from '@/types/api'

interface MultiCurrencyNoteProps {
  baseCurrency: string
  accounts: Account[]
}

export function MultiCurrencyNote({
  baseCurrency,
  accounts,
}: MultiCurrencyNoteProps) {
  const currencies = [...new Set(accounts.map((a) => a.currency))]
  const hasMultipleCurrencies = currencies.length > 1

  if (!hasMultipleCurrencies) {
    return null
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-4 flex items-start gap-3">
      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <div className="text-sm text-blue-900 dark:text-blue-100">
        <p>
          Totals converted to <strong>{baseCurrency}</strong> using latest
          available rates.
        </p>
      </div>
    </div>
  )
}
