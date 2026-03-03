import { toast } from 'sonner'
import { useDeleteTransaction } from '@/hooks/use-transactions'
import { handleMutationError } from '@/lib/form-helpers'
import { ConfirmDialog } from '@/components/domain/confirm-dialog'
import type { Transaction } from '@/types/api'

interface TransactionDeleteDialogProps {
  deleteTarget: Transaction | null
  onClose: () => void
}

export function TransactionDeleteDialog({
  deleteTarget,
  onClose,
}: TransactionDeleteDialogProps) {
  const deleteTransaction = useDeleteTransaction()

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteTransaction.mutateAsync(deleteTarget.id)
      toast.success('Transaction deleted')
      onClose()
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <ConfirmDialog
      open={!!deleteTarget}
      onOpenChange={(open) => {
        if (!open) onClose()
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
  )
}
