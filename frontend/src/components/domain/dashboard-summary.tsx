import Decimal from 'decimal.js'
import { formatMoney } from '@/lib/money'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorBanner } from '@/components/domain/error-banner'
import { IncomeExpenseBars } from '@/components/domain/income-expense-bars'
import type { DashboardMonth } from '@/hooks/use-dashboard-summary'

export interface CurrencySubtotal {
  currency: string
  total: string
}

interface DashboardSummaryProps {
  months: DashboardMonth[]
  baseCurrency: string
  totalBalance: string
  currencySubtotals: CurrencySubtotal[]
  isError?: boolean
  onRetry?: () => void
}

function computeMaxValue(months: DashboardMonth[]): Decimal {
  const values = months.flatMap((m) => [
    new Decimal(m.income),
    new Decimal(m.expense),
  ])
  if (values.length === 0) return new Decimal(0)
  return Decimal.max(...values)
}

function TotalPanel({
  totalBalance,
  baseCurrency,
  currencySubtotals,
}: {
  totalBalance: string
  baseCurrency: string
  currencySubtotals: CurrencySubtotal[]
}) {
  return (
    <div>
      <div className="text-sm text-muted-foreground">Total</div>
      <div className="text-3xl font-bold">
        {formatMoney(totalBalance, baseCurrency)}
      </div>
      {currencySubtotals.length > 1 && (
        <div className="hidden md:flex flex-col gap-0.5 mt-2">
          {currencySubtotals.map((s) => (
            <div key={s.currency} className="text-sm text-muted-foreground">
              {formatMoney(s.total, s.currency)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DashboardSummary({
  months,
  baseCurrency,
  totalBalance,
  currencySubtotals,
  isError,
  onRetry,
}: DashboardSummaryProps) {
  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorBanner
            message="Failed to load dashboard summary."
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  const currentMonth = months.find((m) => m.isCurrent)
  const currentMaxValue = currentMonth
    ? computeMaxValue([currentMonth])
    : new Decimal(0)
  const allMaxValue = computeMaxValue(months)

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Mobile: current month only + total below */}
        <div className="md:hidden space-y-4">
          {currentMonth && (
            <IncomeExpenseBars
              income={currentMonth.income}
              expense={currentMonth.expense}
              currency={baseCurrency}
              maxValue={currentMaxValue}
            />
          )}
          <TotalPanel
            totalBalance={totalBalance}
            baseCurrency={baseCurrency}
            currencySubtotals={currencySubtotals}
          />
        </div>

        {/* Desktop: months stacked vertically (current on top) + total to the right */}
        <div className="hidden md:flex md:items-start md:gap-6">
          <div className="flex-1 min-w-0 space-y-2">
            {[...months].reverse().map((m) => (
              <IncomeExpenseBars
                key={m.key}
                income={m.income}
                expense={m.expense}
                currency={baseCurrency}
                label={m.label}
                maxValue={allMaxValue}
                compact={!m.isCurrent}
              />
            ))}
          </div>
          <div className="shrink-0">
            <TotalPanel
              totalBalance={totalBalance}
              baseCurrency={baseCurrency}
              currencySubtotals={currencySubtotals}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
