import { useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type {
  useCreateTransfer,
  useUpdateTransfer,
} from '@/hooks/use-transactions'
import type { TransferFormData } from '@/lib/validators'
import { getSubmitLabel } from '@/lib/form-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/components/ui/form-error'
import { AccountCombobox } from '@/components/domain/account-combobox'
import { DatePicker } from '@/components/domain/date-picker'
import { TransferCurrencyFields } from '@/components/domain/transfer-currency-fields'
import type { Account } from '@/types/api'

interface TransferFormProps {
  form: UseFormReturn<TransferFormData>
  accounts: Account[]
  onSubmit: (data: TransferFormData) => Promise<void>
  onCancel: () => void
  isEdit: boolean
  createTransfer: ReturnType<typeof useCreateTransfer>
  updateTransfer: ReturnType<typeof useUpdateTransfer>
}

export function TransferForm({
  form,
  accounts,
  onSubmit,
  onCancel,
  isEdit,
  createTransfer,
  updateTransfer,
}: TransferFormProps) {
  const fromAccountId = form.watch('from_account_id')
  const toAccountId = form.watch('to_account_id')
  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const isCrossCurrency =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  const handleExchangeRateChange = useCallback(
    (value: string) => form.setValue('exchange_rate', value),
    [form],
  )

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>From Account</Label>
          <AccountCombobox
            value={fromAccountId}
            onValueChange={(v) =>
              form.setValue('from_account_id', v, { shouldValidate: true })
            }
            accounts={accounts}
          />
          <FormError message={form.formState.errors.from_account_id?.message} />
        </div>

        <div className="space-y-2">
          <Label>To Account</Label>
          <AccountCombobox
            value={toAccountId}
            onValueChange={(v) =>
              form.setValue('to_account_id', v, { shouldValidate: true })
            }
            accounts={accounts.filter((a) => a.id !== fromAccountId)}
          />
          <FormError message={form.formState.errors.to_account_id?.message} />
        </div>
      </div>

      {isCrossCurrency ? (
        <TransferCurrencyFields
          amount={form.watch('amount')}
          toAmount={form.watch('to_amount') ?? ''}
          exchangeRate={form.watch('exchange_rate') ?? ''}
          onAmountChange={(v) =>
            form.setValue('amount', v, { shouldValidate: true })
          }
          onToAmountChange={(v) => form.setValue('to_amount', v)}
          onExchangeRateChange={handleExchangeRateChange}
          fromCurrency={fromAccount?.currency ?? ''}
          toCurrency={toAccount?.currency ?? ''}
        />
      ) : (
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input
            inputMode="decimal"
            {...form.register('amount')}
            placeholder="0.00"
          />
          <FormError message={form.formState.errors.amount?.message} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Description</Label>
        <Input {...form.register('description')} />
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createTransfer.isPending || updateTransfer.isPending}
        >
          {getSubmitLabel(
            isEdit,
            createTransfer.isPending || updateTransfer.isPending,
            'Save Transfer',
            'Create Transfer',
          )}
        </Button>
      </div>
    </form>
  )
}
