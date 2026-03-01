import { useState } from 'react'
import { toast } from 'sonner'
import { useResetData } from '@/hooks/use-user'
import { ConfirmDialog } from '@/components/domain/confirm-dialog'
import { Button } from '@/components/ui/button'

export function DataTab() {
  const [open, setOpen] = useState(false)
  const resetData = useResetData()

  async function handleReset() {
    try {
      await resetData.mutateAsync()
      toast.success('All data has been reset')
    } catch {
      toast.error('Failed to reset data')
    } finally {
      setOpen(false)
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <div className="rounded-md border border-destructive/50 p-4 space-y-3">
        <h3 className="font-semibold text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">
          Permanently deletes all your transactions, accounts, and categories.
          Default categories will be restored. This cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Reset All Data
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset All Data?"
        description="This will permanently delete all your transactions, accounts, and categories. Default categories will be restored. This cannot be undone."
        variant="simple"
        onConfirm={handleReset}
        loading={resetData.isPending}
        confirmLabel="Reset"
      />
    </div>
  )
}
