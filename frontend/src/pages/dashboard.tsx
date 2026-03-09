import { useState } from 'react'
import { useNavigate } from 'react-router'
import Decimal from 'decimal.js'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { useDashboardSummary } from '@/hooks/use-dashboard-summary'
import { convertToBase } from '@/lib/account-groups'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DashboardSummary,
  type CurrencySubtotal,
} from '@/components/domain/dashboard-summary'
import { DashboardRecent } from '@/components/domain/dashboard-recent'
import { DashboardAccounts } from '@/components/domain/dashboard-accounts'
import { MultiCurrencyNote } from '@/components/domain/multi-currency-note'
import { TransactionDeleteDialog } from '@/components/domain/transaction-delete-dialog'
import type { Transaction, Account, ExchangeRate } from '@/types/api'

function computeTotalBalance(
  accounts: Account[],
  baseCurrency: string,
  rates: ExchangeRate[],
): string {
  return accounts
    .reduce(
      (sum, a) =>
        sum.add(convertToBase(a.balance, a.currency, baseCurrency, rates)),
      new Decimal(0),
    )
    .toFixed(2)
}

function computeCurrencySubtotals(accounts: Account[]): CurrencySubtotal[] {
  const byCurrency = new Map<string, Decimal>()
  for (const a of accounts) {
    const prev = byCurrency.get(a.currency) ?? new Decimal(0)
    byCurrency.set(a.currency, prev.add(new Decimal(a.balance)))
  }
  return Array.from(byCurrency.entries())
    .sort(([, a], [, b]) => b.cmp(a))
    .map(([currency, total]) => ({ currency, total: total.toFixed(2) }))
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const {
    months,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useDashboardSummary()
  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    isError: isTransactionsError,
    refetch: refetchTransactions,
  } = useTransactions({ per_page: 10 })
  const { data: accounts = [], isLoading: isAccountsLoading } = useAccounts()
  const { data: categories = [], isLoading: isCategoriesLoading } =
    useCategories()
  const { data: rates = [] } = useExchangeRates()

  const isLoading =
    isSummaryLoading ||
    isTransactionsLoading ||
    isAccountsLoading ||
    isCategoriesLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Skeleton className="h-9 w-36" />
        </div>
        {/* Summary skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
              <div className="shrink-0">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="mt-1 h-8 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
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

  if (!user) {
    return null
  }

  const recentTransactions = transactionsData?.pages[0]?.data.slice(0, 10) ?? []
  const totalBalance = computeTotalBalance(accounts, user.base_currency, rates)
  const currencySubtotals = computeCurrencySubtotals(accounts)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button size="sm" onClick={() => navigate('/transactions/new')}>
          <Plus className="h-4 w-4" />
          New Transaction
        </Button>
      </div>

      <MultiCurrencyNote
        baseCurrency={user.base_currency}
        accounts={accounts}
      />

      <DashboardSummary
        months={months}
        baseCurrency={user.base_currency}
        totalBalance={totalBalance}
        currencySubtotals={currencySubtotals}
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
        onEdit={(tx) => navigate(`/transactions/${tx.id}`)}
        onDelete={setDeleteTarget}
      />

      <TransactionDeleteDialog
        deleteTarget={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
