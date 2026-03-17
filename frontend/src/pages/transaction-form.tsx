import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import {
  useTransaction,
  useTransactions,
  useTransfer,
} from '@/hooks/use-transactions'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionForm } from '@/components/domain/transaction-form'
import { TransactionTable } from '@/components/domain/transaction-table'
import { TransactionDeleteDialog } from '@/components/domain/transaction-delete-dialog'
import type { Transaction } from '@/types/api'

export default function TransactionFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const isNew = !id

  const { data: transaction, isLoading: txLoading } = useTransaction(id ?? '')
  const { data: transferData, isLoading: linkedTxLoading } = useTransfer(
    !isNew && !!transaction?.transfer_id ? (id ?? '') : '',
  )
  const linkedTransaction = useMemo(
    () => transferData?.data.find((t) => t.id !== id) ?? null,
    [transferData, id],
  )

  const {
    data: recentData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useTransactions({ per_page: 5 })

  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()

  const recentTransactions = useMemo(
    () => recentData?.pages.flatMap((p) => p.data) ?? [],
    [recentData],
  )
  const recentTotal = recentData?.pages[0]?.pagination.total ?? 0

  const isEditLoading =
    !isNew && (txLoading || (!!transaction?.transfer_id && linkedTxLoading))

  function handleClose() {
    navigate('/transactions')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/transactions')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isNew ? 'New Transaction' : 'Edit Transaction'}
        </h1>
      </div>

      {isEditLoading ? (
        <div className="space-y-3 rounded-lg border p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <TransactionForm
          onClose={handleClose}
          editTransaction={isNew ? null : (transaction ?? null)}
          linkedTransferTransaction={isNew ? null : (linkedTransaction ?? null)}
        />
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Transactions</h2>
        <TransactionTable
          transactions={recentTransactions}
          accounts={accounts}
          categories={categories}
          total={recentTotal}
          hasNextPage={hasNextPage}
          onLoadMore={() => fetchNextPage()}
          isLoadingMore={isFetchingNextPage}
          onEdit={(tx) => navigate(`/transactions/${tx.id}`)}
          onDelete={setDeleteTarget}
        />
      </div>

      <TransactionDeleteDialog
        deleteTarget={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
