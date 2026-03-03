import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Plus } from 'lucide-react'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionFilters } from '@/components/domain/transaction-filters'
import { TransactionTable } from '@/components/domain/transaction-table'
import { TransactionDeleteDialog } from '@/components/domain/transaction-delete-dialog'
import type { TransactionFilters as Filters } from '@/api/transactions'
import type { Transaction } from '@/types/api'
import { toISODate } from '@/lib/dates'
import { buildSearchParams } from '@/lib/query-string'

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()

  const defaultDateFrom = useMemo(() => toISODate(startOfMonth(new Date())), [])
  const defaultDateTo = useMemo(() => toISODate(endOfMonth(new Date())), [])

  useEffect(() => {
    if (searchParams.get('date_from') && searchParams.get('date_to')) return

    const params = new URLSearchParams(searchParams)
    if (!params.get('date_from')) params.set('date_from', defaultDateFrom)
    if (!params.get('date_to')) params.set('date_to', defaultDateTo)
    setSearchParams(params, { replace: true })
  }, [defaultDateFrom, defaultDateTo, searchParams, setSearchParams])

  // Sync filters with URL
  const filters: Filters = useMemo(
    () => ({
      account_id:
        searchParams.getAll('account_id').length > 0
          ? searchParams.getAll('account_id')
          : undefined,
      category_id:
        searchParams.getAll('category_id').length > 0
          ? searchParams.getAll('category_id')
          : undefined,
      type: searchParams.get('type') ?? undefined,
      date_from: searchParams.get('date_from') ?? defaultDateFrom,
      date_to: searchParams.get('date_to') ?? defaultDateTo,
    }),
    [defaultDateFrom, defaultDateTo, searchParams],
  )

  const handleFiltersChange = useCallback(
    (newFilters: Filters) => {
      setSearchParams(buildSearchParams(newFilters), { replace: true })
    },
    [setSearchParams],
  )

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useTransactions(filters)

  const transactions = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  )
  const total = data?.pages[0]?.pagination.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button onClick={() => navigate('/transactions/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </div>

      <TransactionFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border p-4"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          total={total}
          hasNextPage={hasNextPage}
          onLoadMore={() => fetchNextPage()}
          isLoadingMore={isFetchingNextPage}
          onEdit={(tx) => navigate(`/transactions/${tx.id}`)}
          onDelete={setDeleteTarget}
        />
      )}

      <TransactionDeleteDialog
        deleteTarget={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
