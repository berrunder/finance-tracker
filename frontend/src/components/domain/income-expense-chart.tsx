import Decimal from 'decimal.js'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useNavigate } from 'react-router'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { BarRectangleItem } from 'recharts'
import { formatMoney } from '@/lib/money'
import { toISODate } from '@/lib/dates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBanner } from '@/components/domain/error-banner'
import type { MonthlyIncomeExpenseItem } from '@/types/api'

interface IncomeExpenseChartProps {
  data: MonthlyIncomeExpenseItem[]
  currency: string
  isError?: boolean
  onRetry?: () => void
}

interface ChartData {
  month: string
  income: number
  expense: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: ChartData
  }>
  currency: string
}

// Custom tooltip component - declared outside render
function CustomTooltip({ active, payload, currency }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload
  const income = new Decimal(data.income)
  const expense = new Decimal(data.expense)
  const net = income.minus(expense)

  // Format month from "2024-01" to "January 2024"
  const [year, monthStr] = data.month.split('-')
  const monthName = format(
    new Date(Number(year), Number(monthStr) - 1, 1),
    'MMMM yyyy',
  )

  return (
    <div className="bg-background border rounded-md p-3 shadow-md">
      <p className="font-medium mb-2">{monthName}</p>
      <p className="text-sm text-green-600 dark:text-green-400">
        Income: {formatMoney(String(income), currency)}
      </p>
      <p className="text-sm text-red-600 dark:text-red-400">
        Expense: {formatMoney(String(expense), currency)}
      </p>
      <p className="text-sm font-medium border-t mt-2 pt-2">
        Net: {formatMoney(String(net), currency)}
      </p>
    </div>
  )
}

export function IncomeExpenseChart({
  data,
  currency,
  isError,
  onRetry,
}: IncomeExpenseChartProps) {
  const navigate = useNavigate()

  const chartData: ChartData[] = data.map((item) => ({
    month: item.month,
    income: new Decimal(item.income).toNumber(),
    expense: new Decimal(item.expense).toNumber(),
  }))

  function handleBarClick(data: BarRectangleItem) {
    const barData = data.payload as ChartData
    if (!barData.month) return

    const [year, month] = barData.month.split('-')
    const monthDate = new Date(Number(year), Number(month) - 1, 1)

    const dateFrom = toISODate(startOfMonth(monthDate))
    const dateTo = toISODate(endOfMonth(monthDate))

    navigate(`/transactions?date_from=${dateFrom}&date_to=${dateTo}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expense</CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorBanner
            message="Failed to load income vs expense data."
            onRetry={onRetry}
          />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No income or expense data available for the selected period.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend />
              <Bar
                dataKey="income"
                fill="#22c55e"
                name="Income"
                cursor="pointer"
                onClick={handleBarClick}
              />
              <Bar
                dataKey="expense"
                fill="#ef4444"
                name="Expense"
                cursor="pointer"
                onClick={handleBarClick}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
