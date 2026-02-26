import type { UseFormReturn } from 'react-hook-form'
import type {
  useCreateTransaction,
  useUpdateTransaction,
} from '@/hooks/use-transactions'
import type { TransactionFormData } from '@/lib/validators'
import { getSubmitLabel } from '@/lib/form-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-error'
import { AccountCombobox } from '@/components/domain/account-combobox'
import { CategoryCombobox } from '@/components/domain/category-combobox'
import { DatePicker } from '@/components/domain/date-picker'
import type { Account } from '@/types/api'

interface IncomeExpenseFormProps {
  form: UseFormReturn<TransactionFormData>
  accounts: Account[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  onCancel: () => void
  isEdit: boolean
  createTransaction: ReturnType<typeof useCreateTransaction>
  updateTransaction: ReturnType<typeof useUpdateTransaction>
}

export function IncomeExpenseForm({
  form,
  accounts,
  onSubmit,
  onCancel,
  isEdit,
  createTransaction,
  updateTransaction,
}: IncomeExpenseFormProps) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Account</Label>
          <AccountCombobox
            value={form.watch('account_id')}
            onValueChange={(v) =>
              form.setValue('account_id', v, { shouldValidate: true })
            }
            accounts={accounts}
          />
          <FormError message={form.formState.errors.account_id?.message} />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <CategoryCombobox
            value={form.watch('category_id')}
            onValueChange={(v) =>
              form.setValue('category_id', v, {
                shouldValidate: true,
              })
            }
            type={form.watch('type')}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            inputMode="decimal"
            {...form.register('amount')}
            placeholder="0.00"
          />
          <FormError message={form.formState.errors.amount?.message} />
        </div>

        <div className="space-y-2">
          <Label>Date</Label>
          <DatePicker
            value={form.watch('date')}
            onChange={(v) =>
              form.setValue('date', v ?? '', { shouldValidate: true })
            }
          />
          <FormError message={form.formState.errors.date?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input {...form.register('description')} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createTransaction.isPending || updateTransaction.isPending}
        >
          {getSubmitLabel(
            isEdit,
            createTransaction.isPending || updateTransaction.isPending,
          )}
        </Button>
      </div>
    </form>
  )
}
