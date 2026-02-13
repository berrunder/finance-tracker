import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  variant?: 'simple' | 'dangerous'
  confirmLabel?: string
  resourceName?: string
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = 'simple',
  confirmLabel = 'Delete',
  resourceName,
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const [typedName, setTypedName] = useState('')

  const canConfirm = variant === 'simple' || typedName === resourceName

  function handleConfirm() {
    onConfirm()
    setTypedName('')
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTypedName('')
        onOpenChange(v)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {variant === 'dangerous' && resourceName && (
          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-semibold">{resourceName}</span> to
              confirm
            </Label>
            <Input
              id="confirm-name"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={resourceName}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? 'Deleting...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
