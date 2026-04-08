import { useSearchParams } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { useCategories } from '@/hooks/use-categories'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { useCashFlow, useCashFlowYears } from '@/hooks/use-reports'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CashFlowTable } from '@/components/domain/cash-flow-table'
import { ErrorBanner } from '@/components/domain/error-banner'

function parseYearParam(value: string | null): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

export default function CashFlowReportPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    data: years,
    isLoading: isYearsLoading,
    isError: isYearsError,
    refetch: refetchYears,
  } = useCashFlowYears()

  const requestedYear = parseYearParam(searchParams.get('year'))
  const selectedYear =
    (requestedYear && years?.includes(requestedYear)
      ? requestedYear
      : years?.[0]) ?? null

  const {
    data: cashFlowData,
    isLoading: isCashFlowLoading,
    isError: isCashFlowError,
    refetch: refetchCashFlow,
  } = useCashFlow(selectedYear)

  const { data: categories = [] } = useCategories()
  const { data: rates = [] } = useExchangeRates()

  if (!user) return null

  function handleYearChange(value: string) {
    const next = new URLSearchParams(searchParams)
    next.set('year', value)
    setSearchParams(next, { replace: true })
  }

  if (isYearsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isYearsError) {
    return (
      <ErrorBanner
        message="Failed to load cash-flow years."
        onRetry={refetchYears}
      />
    )
  }

  if (!years || years.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No transactions yet. Add some transactions to see your cash flow.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Year</Label>
        <Select
          value={selectedYear ? String(selectedYear) : ''}
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Select a year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCashFlowLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isCashFlowError ? (
        <ErrorBanner
          message="Failed to load cash-flow report."
          onRetry={refetchCashFlow}
        />
      ) : cashFlowData ? (
        <CashFlowTable
          data={cashFlowData}
          categories={categories}
          rates={rates}
          baseCurrency={user.base_currency}
        />
      ) : null}
    </div>
  )
}
