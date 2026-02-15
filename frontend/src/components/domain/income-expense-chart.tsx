import Decimal from 'decimal.js'
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
import { formatMoney } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MonthlyIncomeExpenseItem } from '@/types/api'

interface IncomeExpenseChartProps {
  data: MonthlyIncomeExpenseItem[]
  currency: string
}

export function IncomeExpenseChart({
  data,
  currency,
}: IncomeExpenseChartProps) {
  // Transform data for Recharts
  const chartData = data.map((item) => ({
    month: item.month,
    income: new Decimal(item.income).toNumber(),
    expense: new Decimal(item.expense).toNumber(),
  }))

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No income or expense data available for the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expense</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              formatter={(value: number | undefined) =>
                value !== undefined ? formatMoney(String(value), currency) : ''
              }
            />
            <Legend />
            <Bar dataKey="income" fill="#22c55e" name="Income" />
            <Bar dataKey="expense" fill="#ef4444" name="Expense" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
