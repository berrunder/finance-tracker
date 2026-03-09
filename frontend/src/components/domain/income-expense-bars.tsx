import Decimal from 'decimal.js'
import { formatMoney, computeBarPercent } from '@/lib/money'
import { cn } from '@/lib/utils'

interface IncomeExpenseBarsProps {
  income: string
  expense: string
  currency: string
  label?: string
  maxValue: Decimal
  compact?: boolean
}

export function IncomeExpenseBars({
  income,
  expense,
  currency,
  label,
  maxValue,
  compact,
}: IncomeExpenseBarsProps) {
  const incomeDecimal = new Decimal(income)
  const expenseDecimal = new Decimal(expense)

  const incomePct = computeBarPercent(incomeDecimal, maxValue)
  const expensePct = computeBarPercent(expenseDecimal, maxValue)

  const barHeight = compact ? 'h-1.5' : 'h-3'
  const fontSize = compact ? 'text-[10px]' : 'text-xs'

  return (
    <div className="min-w-0">
      {label && (
        <div className={cn('text-muted-foreground mb-0.5', fontSize)}>
          {label}
        </div>
      )}
      <div
        className={cn('text-green-600 dark:text-green-400 mb-0.5', fontSize)}
      >
        {formatMoney(income, currency)}
      </div>
      <div className={cn('bg-muted overflow-hidden', barHeight)}>
        <div
          className="bg-green-500 h-full transition-all duration-300"
          style={{
            width: `${incomePct}%`,
            minWidth: incomePct > 0 ? '4px' : '0px',
          }}
        />
      </div>
      <div className={cn('bg-muted overflow-hidden', barHeight)}>
        <div
          className="bg-red-500 h-full transition-all duration-300"
          style={{
            width: `${expensePct}%`,
            minWidth: expensePct > 0 ? '4px' : '0px',
          }}
        />
      </div>
      <div className={cn('text-red-600 dark:text-red-400 mt-0.5', fontSize)}>
        {formatMoney(expense, currency)}
      </div>
    </div>
  )
}
