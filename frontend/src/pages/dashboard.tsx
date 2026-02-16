import { startOfMonth, endOfMonth } from 'date-fns'
import { toISODate } from '@/lib/dates'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { useSummary } from '@/hooks/use-reports'
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
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Loading...</p>
      </div>
    )
  }

  if (!user || !summary) {
    return null
  }

  const recentTransactions =
    transactionsData?.pages[0]?.data.slice(0, 10) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <MultiCurrencyNote baseCurrency={user.base_currency} accounts={accounts} />

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
