import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Decimal from 'decimal.js'
import {
  correctionSchema,
  moneyRegex,
  type CorrectionFormData,
} from '@/lib/validators'
import { useCreateTransaction } from '@/hooks/use-transactions'
import { handleMutationError, getSubmitLabel } from '@/lib/form-helpers'
import { formatMoney } from '@/lib/money'
import { toISODate } from '@/lib/dates'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-error'
import { CategoryCombobox } from '@/components/domain/category-combobox'
import type { Account } from '@/types/api'

interface CorrectionDialogProps {
  onOpenChange: (open: boolean) => void
  account: Account | null
}

export function CorrectionDialog({
  onOpenChange,
  account,
}: CorrectionDialogProps) {
  const open = account !== null
  const createTransaction = useCreateTransaction()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CorrectionFormData>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { actual_balance: '', category_id: '' },
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      reset({ actual_balance: '', category_id: '' })
      prevTypeRef.current = null
    }
  }, [open, reset])

  // Derive correction type and amount from current input
  const actualBalanceStr = watch('actual_balance')
  let correctionType: 'income' | 'expense' | null = null
  let correctionAmount: Decimal | null = null
  let isZeroCorrection = false

  if (account && moneyRegex.test(actualBalanceStr)) {
    const actual = new Decimal(actualBalanceStr)
    const current = new Decimal(account.balance)
    const diff = actual.minus(current)
    if (diff.greaterThan(0)) {
      correctionType = 'income'
      correctionAmount = diff
    } else if (diff.lessThan(0)) {
      correctionType = 'expense'
      correctionAmount = diff.abs()
    } else {
      isZeroCorrection = true
    }
  }

  // Reset category when correction type changes (income ↔ expense ↔ null)
  const prevTypeRef = useRef<'income' | 'expense' | null>(null)
  useEffect(() => {
    if (prevTypeRef.current !== correctionType) {
      setValue('category_id', '', { shouldValidate: false })
    }
    prevTypeRef.current = correctionType
  }, [correctionType, setValue])

  const onSubmit = async (data: CorrectionFormData) => {
    if (!account || !correctionType || !correctionAmount) return
    try {
      await createTransaction.mutateAsync({
        account_id: account.id,
        category_id: data.category_id,
        type: correctionType,
        amount: correctionAmount.toFixed(2),
        description: 'Correction',
        date: toISODate(new Date()),
      })
      toast.success('Correction saved')
      onOpenChange(false)
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct Account Balance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {account && (
            <p className="text-muted-foreground text-sm">
              Current balance:{' '}
              <span className="text-foreground font-medium">
                {formatMoney(account.balance, account.currency)}
              </span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="actual_balance">Actual Balance</Label>
            <Input
              id="actual_balance"
              inputMode="decimal"
              placeholder="0.00"
              {...register('actual_balance')}
            />
            <FormError message={errors.actual_balance?.message} />
            {isZeroCorrection && (
              <p className="text-muted-foreground text-sm">
                Balance matches — no correction needed
              </p>
            )}
          </div>

          {correctionType && correctionAmount && account && (
            <p className="text-sm">
              Will create a{' '}
              <span
                className={
                  correctionType === 'income'
                    ? 'font-medium text-green-600'
                    : 'font-medium text-red-600'
                }
              >
                {formatMoney(correctionAmount.toFixed(2), account.currency)}{' '}
                {correctionType}
              </span>{' '}
              correction
            </p>
          )}

          {correctionType && (
            <div className="space-y-2">
              <Label>Category</Label>
              <CategoryCombobox
                value={watch('category_id')}
                onValueChange={(v) =>
                  setValue('category_id', v, { shouldValidate: true })
                }
                type={correctionType}
              />
              <FormError message={errors.category_id?.message} />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!correctionType || createTransaction.isPending}
            >
              {getSubmitLabel(true, createTransaction.isPending)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
