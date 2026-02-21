import { startOfMonth, endOfMonth } from 'date-fns'
import { toISODate } from '@/lib/dates'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { useSummary } from '@/hooks/use-reports'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DashboardSummary } from '@/components/domain/dashboard-summary'
import { DashboardRecent } from '@/components/domain/dashboard-recent'
import { DashboardAccounts } from '@/components/domain/dashboard-accounts'
import { MultiCurrencyNote } from '@/components/domain/multi-currency-note'

export default function DashboardPage() {
  const { user } = useAuth()
  const now = new Date()
  const dateFrom = toISODate(startOfMonth(now))
  const dateTo = toISODate(endOfMonth(now))

  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useSummary({
    date_from: dateFrom,
    date_to: dateTo,
  })
  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    isError: isTransactionsError,
    refetch: refetchTransactions,
  } = useTransactions({ per_page: 10 })
  const { data: accounts = [], isLoading: isAccountsLoading } = useAccounts()
  const { data: categories = [], isLoading: isCategoriesLoading } =
    useCategories()

  const isLoading =
    isSummaryLoading ||
    isTransactionsLoading ||
    isAccountsLoading ||
    isCategoriesLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {/* Summary cards skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Recent transactions skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user || !summary) {
    return null
  }

  const recentTransactions = transactionsData?.pages[0]?.data.slice(0, 10) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <MultiCurrencyNote
        baseCurrency={user.base_currency}
        accounts={accounts}
      />

      <DashboardSummary
        totalIncome={summary.total_income}
        totalExpense={summary.total_expense}
        netIncome={summary.net_income}
        currency={user.base_currency}
        isError={isSummaryError}
        onRetry={refetchSummary}
      />

      <DashboardAccounts accounts={accounts} />

      <DashboardRecent
        transactions={recentTransactions}
        accounts={accounts}
        categories={categories}
        isError={isTransactionsError}
        onRetry={refetchTransactions}
      />
    </div>
  )
}
