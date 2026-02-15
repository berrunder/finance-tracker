import { useState } from 'react'
import { useNavigate } from 'react-router'
import Decimal from 'decimal.js'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { formatMoney } from '@/lib/money'
import { toISODate } from '@/lib/dates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SpendingByCategoryItem } from '@/types/api'

interface SpendingChartProps {
  data: SpendingByCategoryItem[]
  currency: string
  dateFrom?: Date
  dateTo?: Date
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
]

export function SpendingChart({
  data,
  currency,
  dateFrom,
  dateTo,
}: SpendingChartProps) {
  const navigate = useNavigate()
  const [drillDownParentId, setDrillDownParentId] = useState<string | null>(
    null,
  )

  // Filter data based on drill-down state
  const filteredData =
    drillDownParentId === null
      ? data.filter((item) => !item.parent_id)
      : data.filter((item) => item.parent_id === drillDownParentId)

  // Transform data for Recharts
  const chartData = filteredData.map((item) => ({
    name: item.category_name,
    value: new Decimal(item.total).toNumber(),
    categoryId: item.category_id,
  }))

  const hasChildren = (categoryId: string): boolean => {
    return data.some((item) => item.parent_id === categoryId)
  }

  const handleSegmentClick = (categoryId: string) => {
    if (hasChildren(categoryId)) {
      // Drill down to subcategories
      setDrillDownParentId(categoryId)
    } else {
      // Navigate to transactions page with filters
      const params = new URLSearchParams({
        category_id: categoryId,
      })
      if (dateFrom) {
        params.set('date_from', toISODate(dateFrom))
      }
      if (dateTo) {
        params.set('date_to', toISODate(dateTo))
      }
      navigate(`/transactions?${params.toString()}`)
    }
  }

  const handleBack = () => {
    setDrillDownParentId(null)
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No spending data available for the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Spending by Category</CardTitle>
        {drillDownParentId && (
          <Button variant="ghost" size="sm" onClick={handleBack}>
            ← Back
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => entry.name}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              onClick={(entry) => handleSegmentClick(entry.categoryId)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | undefined) =>
                value !== undefined ? formatMoney(String(value), currency) : ''
              }
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
