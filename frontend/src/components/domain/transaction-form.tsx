import { useEffect, useMemo, useState } from 'react'
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
import type { Transaction, UpdateTransactionRequest } from '@/types/api'

type TxType = 'income' | 'expense' | 'transfer'
type IncomeExpenseTxType = Exclude<TxType, 'transfer'>
type TransferPair = {
  source: Transaction | null
  destination: Transaction | null
}

function getTransactionDefaultValues(
  editTransaction?: Transaction | null,
): TransactionFormData {
  if (editTransaction && !editTransaction.transfer_id) {
    return {
      account_id: editTransaction.account_id,
      category_id: editTransaction.category_id ?? '',
      type: editTransaction.type as IncomeExpenseTxType,
      amount: editTransaction.amount,
      description: editTransaction.description,
      date: editTransaction.date,
    }
  }

  return {
    account_id: '',
    category_id: '',
    type: 'expense',
    amount: '',
    description: '',
    date: toISODate(new Date()),
  }
}

function getTransactionResetValues(
  data: TransactionFormData,
): TransactionFormData {
  return {
    account_id: data.account_id,
    category_id: '',
    type: data.type,
    amount: '',
    description: '',
    date: data.date,
  }
}

function resolveTransferPair(
  editTx: Transaction,
  linkedTx: Transaction | null | undefined,
): TransferPair {
  const source = editTx.type === 'expense' ? editTx : linkedTx
  const destination = editTx.type === 'expense' ? linkedTx : editTx
  return { source: source ?? null, destination: destination ?? null }
}

function resolveTransferDestinationAmount(
  isCrossCurrency: boolean,
  data: { amount: string; to_amount?: string; exchange_rate?: string },
): string {
  if (isCrossCurrency && data.to_amount) return data.to_amount
  if (isCrossCurrency && data.exchange_rate) {
    return new Decimal(data.amount).mul(data.exchange_rate).toFixed(2)
  }
  return data.amount
}

function getTransferDefaultValues(
  transferPair: TransferPair,
): TransferFormData {
  if (transferPair.source && transferPair.destination) {
    return {
      from_account_id: transferPair.source.account_id,
      to_account_id: transferPair.destination.account_id,
      amount: transferPair.source.amount,
      to_amount:
        transferPair.source.currency !== transferPair.destination.currency
          ? transferPair.destination.amount
          : '',
      exchange_rate:
        transferPair.source.exchange_rate ??
        transferPair.destination.exchange_rate ??
        '',
      description: transferPair.source.description,
      date: transferPair.source.date,
    }
  }

  return {
    from_account_id: '',
    to_account_id: '',
    amount: '',
    to_amount: '',
    exchange_rate: '',
    description: '',
    date: toISODate(new Date()),
  }
}

function getTransferResetValues(data: TransferFormData): TransferFormData {
  return {
    from_account_id: data.from_account_id,
    to_account_id: data.to_account_id,
    amount: '',
    to_amount: '',
    exchange_rate: '',
    description: '',
    date: data.date,
  }
}

function buildSourceTransferUpdate(
  data: TransferFormData,
): UpdateTransactionRequest {
  return {
    account_id: data.from_account_id,
    category_id: null,
    type: 'expense',
    amount: data.amount,
    description: data.description,
    date: data.date,
  }
}

function buildDestinationTransferUpdate(
  data: TransferFormData,
  destinationAmount: string,
): UpdateTransactionRequest {
  return {
    account_id: data.to_account_id,
    category_id: null,
    type: 'income',
    amount: destinationAmount,
    description: data.description,
    date: data.date,
  }
}

interface TransactionFormProps {
  onClose: () => void
  editTransaction?: Transaction | null
  linkedTransferTransaction?: Transaction | null
}

function getInitialTxType(editTransaction?: Transaction | null): TxType {
  if (!editTransaction) return 'expense'
  if (editTransaction.transfer_id) return 'transfer'
  return editTransaction.type as 'income' | 'expense'
}

interface IncomeExpenseModeFormProps {
  onClose: () => void
  editTransaction?: Transaction | null
  createType: IncomeExpenseTxType
}

function IncomeExpenseModeForm({
  onClose,
  editTransaction,
  createType,
}: IncomeExpenseModeFormProps) {
  const isEdit = !!editTransaction
  const { data: accounts = [] } = useAccounts()
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()

  const txForm = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: getTransactionDefaultValues(editTransaction),
    mode: 'onBlur',
  })

  useEffect(() => {
    txForm.reset(getTransactionDefaultValues(editTransaction))
  }, [editTransaction, txForm])

  useEffect(() => {
    if (isEdit) return

    const previousType = txForm.getValues('type')
    txForm.setValue('type', createType, { shouldValidate: true })
    if (previousType !== createType) {
      txForm.setValue('category_id', '', { shouldValidate: true })
    }
  }, [createType, isEdit, txForm])

  async function handleTxSubmit(data: TransactionFormData) {
    try {
      if (isEdit) {
        if (!editTransaction) return
        await updateTransaction.mutateAsync({ id: editTransaction.id, data })
        toast.success('Transaction updated')
        onClose()
        return
      }

      await createTransaction.mutateAsync(data)
      toast.success('Transaction created')
      txForm.reset(getTransactionResetValues(data))
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <IncomeExpenseForm
      form={txForm}
      accounts={accounts}
      onSubmit={handleTxSubmit}
      onCancel={onClose}
      isEdit={isEdit}
      createTransaction={createTransaction}
      updateTransaction={updateTransaction}
    />
  )
}

interface TransferModeFormProps {
  onClose: () => void
  editTransaction?: Transaction | null
  linkedTransferTransaction?: Transaction | null
}

function TransferModeForm({
  onClose,
  editTransaction,
  linkedTransferTransaction,
}: TransferModeFormProps) {
  const isEdit = !!editTransaction
  const { data: accounts = [] } = useAccounts()
  const createTransfer = useCreateTransfer()
  const updateTransaction = useUpdateTransaction()

  const transferPair = useMemo(
    () =>
      editTransaction?.transfer_id
        ? resolveTransferPair(editTransaction, linkedTransferTransaction)
        : { source: null, destination: null },
    [editTransaction, linkedTransferTransaction],
  )

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )

  const trForm = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: getTransferDefaultValues(transferPair),
    mode: 'onBlur',
  })

  useEffect(() => {
    trForm.reset(getTransferDefaultValues(transferPair))
  }, [transferPair, trForm])

  async function handleTransferSubmit(data: TransferFormData) {
    try {
      if (isEdit && editTransaction?.transfer_id) {
        const { source: sourceTx, destination: destinationTx } = transferPair

        if (!sourceTx || !destinationTx) {
          toast.error('Unable to edit this transfer. Reload and try again.')
          return
        }

        const fromAccount = accountsById.get(data.from_account_id)
        const toAccount = accountsById.get(data.to_account_id)
        const isCrossCurrency =
          fromAccount &&
          toAccount &&
          fromAccount.currency !== toAccount.currency

        const destinationAmount = resolveTransferDestinationAmount(
          !!isCrossCurrency,
          data,
        )

        // TODO: add transfer update endpoint that accepts both transactions update in one request to avoid potential inconsistencies
        await Promise.all([
          updateTransaction.mutateAsync({
            id: sourceTx.id,
            data: buildSourceTransferUpdate(data),
          }),
          updateTransaction.mutateAsync({
            id: destinationTx.id,
            data: buildDestinationTransferUpdate(data, destinationAmount),
          }),
        ])

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
      trForm.reset(getTransferResetValues(data))
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <TransferForm
      form={trForm}
      accounts={accounts}
      onSubmit={handleTransferSubmit}
      onCancel={onClose}
      isEdit={isEdit}
      createTransfer={createTransfer}
      updateTransaction={updateTransaction}
    />
  )
}

export function TransactionForm({
  onClose,
  editTransaction,
  linkedTransferTransaction,
}: TransactionFormProps) {
  const isEdit = !!editTransaction
  const [txType, setTxType] = useState<TxType>('expense')

  const activeTxType = isEdit ? getInitialTxType(editTransaction) : txType
  const isTransfer = activeTxType === 'transfer'

  function handleTypeChange(value: string) {
    if (!value) return
    setTxType(value as TxType)
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
        <TransferModeForm
          onClose={onClose}
          editTransaction={editTransaction}
          linkedTransferTransaction={linkedTransferTransaction}
        />
      ) : (
        <IncomeExpenseModeForm
          onClose={onClose}
          editTransaction={editTransaction}
          createType={activeTxType}
        />
      )}
    </div>
  )
}
