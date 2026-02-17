import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { accountSchema, type AccountFormData } from '@/lib/validators'
import { ACCOUNT_TYPES } from '@/lib/constants'
import { useCreateAccount, useUpdateAccount } from '@/hooks/use-accounts'
import { useCurrencies } from '@/hooks/use-currencies'
import { handleMutationError, getSubmitLabel } from '@/lib/form-helpers'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormError } from '@/components/ui/form-error'
import type { Account } from '@/types/api'

interface AccountFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
}

export function AccountForm({ open, onOpenChange, account }: AccountFormProps) {
  const isEdit = !!account
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const { data: currencies = [] } = useCurrencies()

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: 'bank',
      currency: 'USD',
      initial_balance: '0',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      if (account) {
        reset({
          name: account.name,
          type: account.type as AccountFormData['type'],
          currency: account.currency,
          initial_balance: account.initial_balance,
        })
      } else {
        reset({
          name: '',
          type: 'bank',
          currency: 'USD',
          initial_balance: '0',
        })
      }
    }
  }, [open, account, reset])

  const onSubmit = async (data: AccountFormData) => {
    try {
      if (isEdit) {
        await updateAccount.mutateAsync({
          id: account!.id,
          data: {
            name: data.name,
            type: data.type,
            initial_balance: data.initial_balance,
          },
        })
        toast.success('Account updated')
      } else {
        await createAccount.mutateAsync(data)
        toast.success('Account created')
      }
      onOpenChange(false)
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Account' : 'New Account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} />
            <FormError message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={watch('type')}
              onValueChange={(v) =>
                setValue('type', v as AccountFormData['type'], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormError message={errors.type?.message} />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={watch('currency')}
              onValueChange={(v) =>
                setValue('currency', v, { shouldValidate: true })
              }
              disabled={isEdit}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormError message={errors.currency?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial_balance">Initial Balance</Label>
            <Input
              id="initial_balance"
              inputMode="decimal"
              {...register('initial_balance')}
            />
            <FormError message={errors.initial_balance?.message} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {getSubmitLabel(isEdit, isSubmitting)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
