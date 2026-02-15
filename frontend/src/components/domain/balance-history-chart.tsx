import Decimal from 'decimal.js'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatMoney } from '@/lib/money'
import { formatDateShort } from '@/lib/dates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BalanceHistoryItem } from '@/types/api'

interface BalanceHistoryChartProps {
  data: BalanceHistoryItem[]
  currency: string
  accountName?: string
}

export function BalanceHistoryChart({
  data,
  currency,
  accountName,
}: BalanceHistoryChartProps) {
  // Transform data for Recharts
  const chartData = data.map((item) => ({
    date: formatDateShort(item.date),
    balance: new Decimal(item.balance).toNumber(),
  }))

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Balance History {accountName && `- ${accountName}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No balance history available for the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Balance History {accountName && `- ${accountName}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number | undefined) =>
                value !== undefined ? formatMoney(String(value), currency) : ''
              }
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Balance"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
