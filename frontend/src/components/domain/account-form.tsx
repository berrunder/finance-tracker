import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { accountSchema, type AccountFormData } from '@/lib/validators'
import { ACCOUNT_TYPES } from '@/lib/constants'
import { useCreateAccount, useUpdateAccount } from '@/hooks/use-accounts'
import { useCurrencies } from '@/hooks/use-currencies'
import {
  evalAmountFields,
  handleFormSubmitError,
  getSubmitLabel,
  registerAmountField,
} from '@/lib/form-helpers'
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

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: 'deposit',
      currency: 'USD',
      initial_balance: '0',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      if (account) {
        form.reset({
          name: account.name,
          type: account.type as AccountFormData['type'],
          currency: account.currency,
          initial_balance: account.initial_balance,
        })
      } else {
        form.reset({
          name: '',
          type: 'deposit',
          currency: 'USD',
          initial_balance: '0',
        })
      }
    }
  }, [open, account, form])

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
      const serverError = handleFormSubmitError(error, form.setError)
      if (serverError) {
        toast.error(serverError)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Account' : 'New Account'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            evalAmountFields(form, ['initial_balance'])
            return form.handleSubmit(onSubmit)(e)
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} />
            <FormError message={form.formState.errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.watch('type')}
              onValueChange={(v) =>
                form.setValue('type', v as AccountFormData['type'], {
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
            <FormError message={form.formState.errors.type?.message} />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={form.watch('currency')}
              onValueChange={(v) =>
                form.setValue('currency', v, { shouldValidate: true })
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
            <FormError message={form.formState.errors.currency?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial_balance">Initial Balance</Label>
            <Input
              id="initial_balance"
              inputMode="decimal"
              {...registerAmountField(form, 'initial_balance')}
            />
            <FormError
              message={form.formState.errors.initial_balance?.message}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {getSubmitLabel(isEdit, form.formState.isSubmitting)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
