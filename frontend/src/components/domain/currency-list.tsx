import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import type { Currency, ExchangeRate } from '@/types/api'

interface CurrencyListProps {
  currencies: Currency[]
  onAdd: () => void
  onEdit: (currency: Currency) => void
}

function getLatestRate(
  rates: ExchangeRate[],
  fromCurrency: string,
  toCurrency: string,
): string | null {
  // rates are sorted by date DESC from the API
  const rate = rates.find(
    (r) => r.from_currency === fromCurrency && r.to_currency === toCurrency,
  )
  return rate?.rate ?? null
}

export function CurrencyList({ currencies, onAdd, onEdit }: CurrencyListProps) {
  const { user } = useAuth()
  const { data: exchangeRates = [] } = useExchangeRates()
  const baseCurrency = user?.base_currency ?? ''

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Currencies</h3>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="space-y-0.5">
        <div className="text-muted-foreground grid grid-cols-[60px_1fr_60px_100px_40px] gap-2 px-3 py-1.5 text-xs font-medium">
          <span>Code</span>
          <span>Name</span>
          <span>Symbol</span>
          <span className="text-right">Rate ({baseCurrency})</span>
          <span />
        </div>

        {currencies.map((currency) => {
          const rate =
            currency.code === baseCurrency
              ? '1.00'
              : getLatestRate(exchangeRates, currency.code, baseCurrency)

          return (
            <div
              key={currency.code}
              className="group grid grid-cols-[60px_1fr_60px_100px_40px] items-center gap-2 rounded-md px-3 py-1.5 hover:bg-accent"
            >
              <span className="text-sm font-medium">{currency.code}</span>
              <span className="text-sm">{currency.name}</span>
              <span className="text-sm">{currency.symbol}</span>
              <span className="text-muted-foreground text-right text-sm">
                {rate ?? 'N/A'}
              </span>
              <div className="flex justify-end opacity-0 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onEdit(currency)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}

        {currencies.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No currencies configured
          </p>
        )}
      </div>
    </div>
  )
}
