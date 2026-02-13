import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions, useDeleteTransaction } from '@/hooks/use-transactions'
import { handleMutationError } from '@/lib/form-helpers'
import { Button } from '@/components/ui/button'
import { TransactionFilters } from '@/components/domain/transaction-filters'
import { TransactionTable } from '@/components/domain/transaction-table'
import { TransactionForm } from '@/components/domain/transaction-form'
import { ConfirmDialog } from '@/components/domain/confirm-dialog'
import type { TransactionFilters as Filters } from '@/api/transactions'
import type { Transaction } from '@/types/api'
import { toISODate } from '@/lib/dates'

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [formOpen, setFormOpen] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null,
  )
  const [linkedTransferTransaction, setLinkedTransferTransaction] =
    useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const deleteTransaction = useDeleteTransaction()

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
      account_id: searchParams.get('account_id') ?? undefined,
      category_id: searchParams.get('category_id') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      date_from: searchParams.get('date_from') ?? defaultDateFrom,
      date_to: searchParams.get('date_to') ?? defaultDateTo,
    }),
    [defaultDateFrom, defaultDateTo, searchParams],
  )

  const handleFiltersChange = useCallback(
    (newFilters: Filters) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(newFilters)) {
        if (value) params.set(key, value as string)
      }
      setSearchParams(params, { replace: true })
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

  function handleEdit(transaction: Transaction) {
    setEditTransaction(transaction)
    if (transaction.transfer_id) {
      setLinkedTransferTransaction(
        transactions.find((tx) => tx.id === transaction.transfer_id) ?? null,
      )
    } else {
      setLinkedTransferTransaction(null)
    }
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditTransaction(null)
    setLinkedTransferTransaction(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteTransaction.mutateAsync(deleteTarget.id)
      toast.success('Transaction deleted')
      setDeleteTarget(null)
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </div>

      <TransactionFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {formOpen && (
        <TransactionForm
          onClose={handleFormClose}
          editTransaction={editTransaction}
          linkedTransferTransaction={linkedTransferTransaction}
        />
      )}

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Loading...</div>
      ) : (
        <TransactionTable
          transactions={transactions}
          accounts={accounts}
          categories={categories}
          total={total}
          hasNextPage={hasNextPage}
          onLoadMore={() => fetchNextPage()}
          isLoadingMore={isFetchingNextPage}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Transaction"
        description={
          deleteTarget?.transfer_id
            ? 'This is part of a transfer. Both linked transactions will be deleted.'
            : 'This will permanently delete this transaction.'
        }
        variant="simple"
        onConfirm={handleDelete}
        loading={deleteTransaction.isPending}
      />
    </div>
  )
}
