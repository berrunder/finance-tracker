import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { currencySchema, type CurrencyFormData } from '@/lib/validators'
import { useCreateCurrency, useUpdateCurrency } from '@/hooks/use-currencies'
import { handleFormSubmitError, getSubmitLabel } from '@/lib/form-helpers'
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
import type { Currency } from '@/types/api'

interface CurrencyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency?: Currency | null
}

export function CurrencyForm({
  open,
  onOpenChange,
  currency,
}: CurrencyFormProps) {
  const isEdit = !!currency
  const createCurrency = useCreateCurrency()
  const updateCurrency = useUpdateCurrency()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CurrencyFormData>({
    resolver: zodResolver(currencySchema),
    defaultValues: {
      code: '',
      name: '',
      symbol: '',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      if (currency) {
        reset({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
        })
      } else {
        reset({
          code: '',
          name: '',
          symbol: '',
        })
      }
    }
  }, [open, currency, reset])

  const onSubmit = async (data: CurrencyFormData) => {
    try {
      if (isEdit) {
        await updateCurrency.mutateAsync({
          code: currency!.code,
          data: { name: data.name },
        })
        toast.success('Currency updated')
      } else {
        await createCurrency.mutateAsync({
          code: data.code,
          name: data.name,
          symbol: data.symbol,
        })
        toast.success('Currency created')
      }
      onOpenChange(false)
    } catch (error) {
      const serverError = handleFormSubmitError(error, setError)
      if (serverError) {
        toast.error(serverError)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Currency' : 'New Currency'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency-code">Code</Label>
            <Input
              id="currency-code"
              {...register('code')}
              placeholder="USD"
              maxLength={3}
              disabled={isEdit}
            />
            <FormError message={errors.code?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency-name">Name</Label>
            <Input
              id="currency-name"
              {...register('name')}
              placeholder="US Dollar"
            />
            <FormError message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency-symbol">Symbol</Label>
            <Input
              id="currency-symbol"
              {...register('symbol')}
              placeholder="$"
              maxLength={5}
              disabled={isEdit}
            />
            <FormError message={errors.symbol?.message} />
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
