import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BarRectangleItem } from 'recharts'
import { formatMoney, parseDecimal } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/domain/error-banner'
import { Skeleton } from '@/components/ui/skeleton'
import type { SpendingByCategoryItem } from '@/types/api'

interface SpendingChartProps {
  data: SpendingByCategoryItem[]
  currency: string
  dateFrom?: string
  dateTo?: string
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

interface ChartItem {
  name: string
  value: number
  categoryId: string
}

const BAR_HEIGHT = 36
const CHART_PADDING = 24

export function SpendingChart({
  data,
  currency,
  dateFrom,
  dateTo,
  isLoading,
  isError,
  onRetry,
}: SpendingChartProps) {
  const navigate = useNavigate()
  const [drillDownParentId, setDrillDownParentId] = useState<string | null>(
    null,
  )

  // Shared formatter for tooltip and bar labels
  const formatValue = (value: unknown): string => {
    if (typeof value !== 'number') return ''
    return formatMoney(String(value), currency)
  }

  // Filter data based on drill-down state
  const filteredData =
    drillDownParentId === null
      ? data.filter((item) => !item.parent_id)
      : data.filter((item) => item.parent_id === drillDownParentId)

  // Transform and sort data for Recharts (descending by value)
  const chartData: ChartItem[] = filteredData
    .map((item) => ({
      name: item.category_name,
      value: parseDecimal(item.total).toNumber(),
      categoryId: item.category_id,
    }))
    .sort((a, b) => b.value - a.value)

  const chartHeight = chartData.length * BAR_HEIGHT + CHART_PADDING

  function hasChildren(categoryId: string): boolean {
    return data.some((item) => item.parent_id === categoryId)
  }

  function handleBarClick(data: BarRectangleItem) {
    const entry = data.payload as ChartItem
    if (drillDownParentId === null && hasChildren(entry.categoryId)) {
      setDrillDownParentId(entry.categoryId)
    } else {
      const params = new URLSearchParams({
        category_id: entry.categoryId,
      })
      if (dateFrom) {
        params.set('date_from', dateFrom)
      }
      if (dateTo) {
        params.set('date_to', dateTo)
      }
      navigate(`/transactions?${params.toString()}`)
    }
  }

  function handleBack() {
    setDrillDownParentId(null)
  }

  function renderContent() {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[85, 70, 55, 40, 30, 20].map((w, i) => (
            <Skeleton
              key={i}
              className="h-5 rounded"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      )
    }

    if (isError) {
      return (
        <ErrorBanner
          message="Failed to load spending data."
          onRetry={onRetry}
        />
      )
    }

    if (chartData.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No spending data available for the selected period.
        </p>
      )
    }

    return (
      <div className="overflow-y-auto max-h-[300px]">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} layout="vertical" barSize={20}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 13 }}
            />
            <Tooltip
              formatter={(value) => formatValue(value)}
            />
            <Bar
              dataKey="value"
              fill="#3b82f6"
              cursor="pointer"
              name="Spending"
              label={{
                position: 'right',
                formatter: formatValue,
                fontSize: 12,
              }}
              onClick={handleBarClick}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
      <CardContent>{renderContent()}</CardContent>
    </Card>
  )
}
