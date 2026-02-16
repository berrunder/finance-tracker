import Decimal from 'decimal.js'
import { formatMoney } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/domain/error-banner'

interface DashboardSummaryProps {
  totalIncome: string
  totalExpense: string
  netIncome: string
  currency: string
  isError?: boolean
  onRetry?: () => void
}

export function DashboardSummary({
  totalIncome,
  totalExpense,
  netIncome,
  currency,
  isError,
  onRetry,
}: DashboardSummaryProps) {
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBanner
            message="Failed to load dashboard summary."
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  const netValue = new Decimal(netIncome)
  const isPositive = netValue.greaterThanOrEqualTo(0)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatMoney(totalIncome, currency)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatMoney(totalExpense, currency)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatMoney(netIncome, currency)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
