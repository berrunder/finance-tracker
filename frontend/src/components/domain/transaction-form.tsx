import { useEffect, useState } from 'react'
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
import { handleMutationError } from '@/lib/form-helpers'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TransferForm } from '@/components/domain/transfer-form'
import { IncomeExpenseForm } from '@/components/domain/income-expense-form'
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
  isCrossCurrency: boolean,
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

  function handleTypeChange(value: string) {
    if (!value) return
    const newType = value as TxType
    setTxType(newType)
    if (newType !== 'transfer') {
      txForm.setValue('type', newType)
    }
  }

  async function handleTxSubmit(data: TransactionFormData) {
    try {
      if (isEdit) {
        await updateTransaction.mutateAsync({ id: editTransaction!.id, data })
        toast.success('Transaction updated')
        onClose()
      } else {
        await createTransaction.mutateAsync(data)
        toast.success('Transaction created')
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

        const fromAccount = accounts.find((a) => a.id === data.from_account_id)
        const toAccount = accounts.find((a) => a.id === data.to_account_id)
        const isCrossCurrency =
          fromAccount &&
          toAccount &&
          fromAccount.currency !== toAccount.currency

        const destinationAmount = computeDestinationAmount(
          !!isCrossCurrency,
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
        ...data,
        to_amount: data.to_amount || undefined,
        exchange_rate: data.exchange_rate || undefined,
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
        <TransferForm
          form={trForm}
          accounts={accounts}
          onSubmit={handleTransferSubmit}
          onCancel={onClose}
          isEdit={isEdit}
          createTransfer={createTransfer}
          updateTransaction={updateTransaction}
        />
      ) : (
        <IncomeExpenseForm
          form={txForm}
          accounts={accounts}
          onSubmit={handleTxSubmit}
          onCancel={onClose}
          isEdit={isEdit}
          createTransaction={createTransaction}
          updateTransaction={updateTransaction}
        />
      )}
    </div>
  )
}
