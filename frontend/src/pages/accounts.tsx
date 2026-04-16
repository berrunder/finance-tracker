import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAccounts, useDeleteAccount } from '@/hooks/use-accounts'
import { useAuth } from '@/hooks/use-auth'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { groupAccountsByType } from '@/lib/account-groups'
import { handleMutationError } from '@/lib/form-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AccountTable } from '@/components/domain/account-table'
import { AccountForm } from '@/components/domain/account-form'
import { ConfirmDialog } from '@/components/domain/confirm-dialog'
import { CorrectionDialog } from '@/components/domain/correction-dialog'
import type { Account } from '@/types/api'

export default function AccountsPage() {
  const { user } = useAuth()
  const { data: accounts = [], isLoading } = useAccounts()
  const { data: rates = [] } = useExchangeRates()
  const deleteAccount = useDeleteAccount()

  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [correctTarget, setCorrectTarget] = useState<Account | null>(null)
  const [query, setQuery] = useState('')

  const trimmedQuery = query.trim().toLowerCase()

  const groups = useMemo(() => {
    const baseCurrency = user?.base_currency ?? 'USD'
    const filtered = trimmedQuery
      ? accounts.filter((a) => a.name.toLowerCase().includes(trimmedQuery))
      : accounts
    return groupAccountsByType(filtered, baseCurrency, rates)
  }, [accounts, rates, trimmedQuery, user?.base_currency])

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

  const emptyMessage = trimmedQuery
    ? `No accounts match "${query.trim()}".`
    : 'No accounts yet. Create one to get started.'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search accounts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8 rounded" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 md:hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        </>
      ) : (
        <AccountTable
          groups={groups}
          onEdit={handleEdit}
          onDelete={setDeleteTarget}
          onCorrect={setCorrectTarget}
          emptyMessage={emptyMessage}
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

      <CorrectionDialog
        onOpenChange={(open) => {
          if (!open) setCorrectTarget(null)
        }}
        account={correctTarget}
      />
    </div>
  )
}
