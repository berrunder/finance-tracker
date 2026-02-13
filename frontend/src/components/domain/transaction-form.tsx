import { useCallback, useEffect, useState } from 'react'
import Decimal from 'decimal.js'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import {
  transactionSchema,
  transferSchema,
  type TransactionFormData,
  type TransferFormData,
} from '@/lib/validators'
import { toISODate } from '@/lib/dates'
import { useAccounts } from '@/hooks/use-accounts'
import {
  useCreateTransaction,
  useCreateTransfer,
  useUpdateTransaction,
} from '@/hooks/use-transactions'
import { handleMutationError, getSubmitLabel } from '@/lib/form-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CategoryCombobox } from '@/components/domain/category-combobox'
import { DatePicker } from '@/components/domain/date-picker'
import { TransferCurrencyFields } from '@/components/domain/transfer-currency-fields'
import type { Transaction } from '@/types/api'

type TxType = 'income' | 'expense' | 'transfer'

function resolveTransferPair(
  editTx: Transaction,
  linkedTx: Transaction | null | undefined,
) {
  const source = editTx.type === 'expense' ? editTx : linkedTx
  const destination = editTx.type === 'expense' ? linkedTx : editTx
  return { source: source ?? null, destination: destination ?? null }
}

function computeDestinationAmount(
  isCrossCurrency: boolean | undefined,
  data: { amount: string; to_amount?: string; exchange_rate?: string },
): string {
  if (isCrossCurrency && data.to_amount) return data.to_amount
  if (isCrossCurrency && data.exchange_rate) {
    return new Decimal(data.amount).mul(data.exchange_rate).toFixed(2)
  }
  return data.amount
}

interface TransactionFormProps {
  onClose: () => void
  editTransaction?: Transaction | null
  linkedTransferTransaction?: Transaction | null
}

export function TransactionForm({
  onClose,
  editTransaction,
  linkedTransferTransaction,
}: TransactionFormProps) {
  const isEdit = !!editTransaction
  const [txType, setTxType] = useState<TxType>('expense')
  const { data: accounts = [] } = useAccounts()
  const createTransaction = useCreateTransaction()
  const createTransfer = useCreateTransfer()
  const updateTransaction = useUpdateTransaction()

  // Transaction form (income/expense)
  const txForm = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      account_id: '',
      category_id: '',
      type: 'expense',
      amount: '',
      description: '',
      date: toISODate(new Date()),
    },
    mode: 'onBlur',
  })

  // Transfer form
  const trForm = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_account_id: '',
      to_account_id: '',
      amount: '',
      to_amount: '',
      exchange_rate: '',
      description: '',
      date: toISODate(new Date()),
    },
    mode: 'onBlur',
  })

  const isTransfer = txType === 'transfer'

  // Populate edit mode
  useEffect(() => {
    if (editTransaction) {
      if (editTransaction.transfer_id) {
        const { source: sourceTx, destination: destinationTx } =
          resolveTransferPair(editTransaction, linkedTransferTransaction)

        if (!sourceTx || !destinationTx) {
          return
        }

        setTxType('transfer')
        trForm.reset({
          from_account_id: sourceTx.account_id,
          to_account_id: destinationTx.account_id,
          amount: sourceTx.amount,
          to_amount:
            sourceTx.currency !== destinationTx.currency
              ? destinationTx.amount
              : '',
          exchange_rate:
            sourceTx.exchange_rate ?? destinationTx.exchange_rate ?? '',
          description: sourceTx.description,
          date: sourceTx.date,
        })
        return
      }

      const type = editTransaction.type as 'income' | 'expense'
      setTxType(type)
      txForm.reset({
        account_id: editTransaction.account_id,
        category_id: editTransaction.category_id ?? '',
        type,
        amount: editTransaction.amount,
        description: editTransaction.description,
        date: editTransaction.date,
      })
    }
  }, [editTransaction, linkedTransferTransaction, trForm, txForm])

  // Determine if cross-currency transfer
  const fromAccountId = trForm.watch('from_account_id')
  const toAccountId = trForm.watch('to_account_id')
  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const isCrossCurrency =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  function handleTypeChange(value: string) {
    if (!value) return
    if (value === 'income' || value === 'expense' || value === 'transfer') {
      setTxType(value)
      if (value !== 'transfer') {
        txForm.setValue('type', value)
      }
    }
  }

  async function handleTxSubmit(data: TransactionFormData) {
    try {
      if (isEdit) {
        await updateTransaction.mutateAsync({
          id: editTransaction!.id,
          data: {
            account_id: data.account_id,
            category_id: data.category_id,
            type: data.type,
            amount: data.amount,
            description: data.description,
            date: data.date,
          },
        })
        toast.success('Transaction updated')
        onClose()
      } else {
        await createTransaction.mutateAsync({
          account_id: data.account_id,
          category_id: data.category_id,
          type: data.type,
          amount: data.amount,
          description: data.description,
          date: data.date,
        })
        toast.success('Transaction created')
        // Clear form but keep account + date
        txForm.reset({
          account_id: data.account_id,
          category_id: '',
          type: data.type,
          amount: '',
          description: '',
          date: data.date,
        })
      }
    } catch (error) {
      handleMutationError(error)
    }
  }

  async function handleTransferSubmit(data: TransferFormData) {
    try {
      if (isEdit && editTransaction?.transfer_id) {
        const { source: sourceTx, destination: destinationTx } =
          resolveTransferPair(editTransaction, linkedTransferTransaction)

        if (!sourceTx || !destinationTx) {
          toast.error('Unable to edit this transfer. Reload and try again.')
          return
        }

        const destinationAmount = computeDestinationAmount(
          isCrossCurrency,
          data,
        )

        await updateTransaction.mutateAsync({
          id: sourceTx.id,
          data: {
            account_id: data.from_account_id,
            category_id: null,
            type: 'expense',
            amount: data.amount,
            description: data.description,
            date: data.date,
          },
        })

        await updateTransaction.mutateAsync({
          id: destinationTx.id,
          data: {
            account_id: data.to_account_id,
            category_id: null,
            type: 'income',
            amount: destinationAmount,
            description: data.description,
            date: data.date,
          },
        })

        toast.success('Transfer updated')
        onClose()
        return
      }

      await createTransfer.mutateAsync({
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        amount: data.amount,
        to_amount: data.to_amount || undefined,
        exchange_rate: data.exchange_rate || undefined,
        description: data.description,
        date: data.date,
      })
      toast.success('Transfer created')
      trForm.reset({
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        amount: '',
        to_amount: '',
        exchange_rate: '',
        description: '',
        date: data.date,
      })
    } catch (error) {
      handleMutationError(error)
    }
  }

  const handleExchangeRateChange = useCallback(
    (value: string) => trForm.setValue('exchange_rate', value),
    [trForm],
  )
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">
          {isEdit ? 'Edit Transaction' : 'New Transaction'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!isEdit && (
        <div className="mb-4">
          <ToggleGroup
            type="single"
            value={txType}
            onValueChange={handleTypeChange}
            variant="outline"
          >
            <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
            <ToggleGroupItem value="income">Income</ToggleGroupItem>
            <ToggleGroupItem value="transfer">Transfer</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {isTransfer ? (
        <form
          onSubmit={trForm.handleSubmit(handleTransferSubmit)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>From Account</Label>
              <Select
                value={fromAccountId}
                onValueChange={(v) =>
                  trForm.setValue('from_account_id', v, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {trForm.formState.errors.from_account_id && (
                <p className="text-destructive text-sm">
                  {trForm.formState.errors.from_account_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>To Account</Label>
              <Select
                value={toAccountId}
                onValueChange={(v) =>
                  trForm.setValue('to_account_id', v, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.id !== fromAccountId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {trForm.formState.errors.to_account_id && (
                <p className="text-destructive text-sm">
                  {trForm.formState.errors.to_account_id.message}
                </p>
              )}
            </div>
          </div>

          {isCrossCurrency ? (
            <TransferCurrencyFields
              amount={trForm.watch('amount')}
              toAmount={trForm.watch('to_amount') ?? ''}
              exchangeRate={trForm.watch('exchange_rate') ?? ''}
              onAmountChange={(v) =>
                trForm.setValue('amount', v, { shouldValidate: true })
              }
              onToAmountChange={(v) => trForm.setValue('to_amount', v)}
              onExchangeRateChange={handleExchangeRateChange}
              fromCurrency={fromAccount?.currency ?? ''}
              toCurrency={toAccount?.currency ?? ''}
            />
          ) : (
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                inputMode="decimal"
                {...trForm.register('amount')}
                placeholder="0.00"
              />
              {trForm.formState.errors.amount && (
                <p className="text-destructive text-sm">
                  {trForm.formState.errors.amount.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...trForm.register('description')} />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <DatePicker
              value={trForm.watch('date')}
              onChange={(v) =>
                trForm.setValue('date', v ?? '', { shouldValidate: true })
              }
            />
            {trForm.formState.errors.date && (
              <p className="text-destructive text-sm">
                {trForm.formState.errors.date.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTransfer.isPending || updateTransaction.isPending}
            >
              {getSubmitLabel(
                isEdit,
                createTransfer.isPending || updateTransaction.isPending,
                'Save Transfer',
                'Create Transfer',
              )}
            </Button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={txForm.handleSubmit(handleTxSubmit)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={txForm.watch('account_id')}
                onValueChange={(v) =>
                  txForm.setValue('account_id', v, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {txForm.formState.errors.account_id && (
                <p className="text-destructive text-sm">
                  {txForm.formState.errors.account_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <CategoryCombobox
                value={txForm.watch('category_id')}
                onValueChange={(v) =>
                  txForm.setValue('category_id', v, {
                    shouldValidate: true,
                  })
                }
                type={txForm.watch('type')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                inputMode="decimal"
                {...txForm.register('amount')}
                placeholder="0.00"
              />
              {txForm.formState.errors.amount && (
                <p className="text-destructive text-sm">
                  {txForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                value={txForm.watch('date')}
                onChange={(v) =>
                  txForm.setValue('date', v ?? '', { shouldValidate: true })
                }
              />
              {txForm.formState.errors.date && (
                <p className="text-destructive text-sm">
                  {txForm.formState.errors.date.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input {...txForm.register('description')} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createTransaction.isPending || updateTransaction.isPending
              }
            >
              {getSubmitLabel(
                isEdit,
                createTransaction.isPending || updateTransaction.isPending,
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
