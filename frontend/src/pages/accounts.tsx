import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAccounts, useDeleteAccount } from '@/hooks/use-accounts'
import { handleMutationError } from '@/lib/form-helpers'
import { Button } from '@/components/ui/button'
import { AccountTable } from '@/components/domain/account-table'
import { AccountForm } from '@/components/domain/account-form'
import { ConfirmDialog } from '@/components/domain/confirm-dialog'
import type { Account } from '@/types/api'

export default function AccountsPage() {
  const { data: accounts = [], isLoading } = useAccounts()
  const deleteAccount = useDeleteAccount()

  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)

  function handleEdit(account: Account) {
    setEditAccount(account)
    setFormOpen(true)
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setEditAccount(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteAccount.mutateAsync(deleteTarget.id)
      toast.success('Account deleted')
      setDeleteTarget(null)
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center">Loading...</div>
      ) : (
        <AccountTable
          accounts={accounts}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
        />
      )}

      <AccountForm
        open={formOpen}
        onOpenChange={handleFormClose}
        account={editAccount}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Account"
        description={`Deleting "${deleteTarget?.name}" will permanently remove all its transactions. This cannot be undone.`}
        variant="dangerous"
        resourceName={deleteTarget?.name}
        onConfirm={handleDelete}
        loading={deleteAccount.isPending}
      />
    </div>
  )
}
