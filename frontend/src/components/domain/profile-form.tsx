import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { profileSchema, type ProfileFormData } from '@/lib/validators'
import { useAuth } from '@/hooks/use-auth'
import { useCurrencies } from '@/hooks/use-currencies'
import { handleMutationError } from '@/lib/form-helpers'
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

export function ProfileForm() {
  const { user, updateUser } = useAuth()
  const { data: currencies = [] } = useCurrencies()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: user?.display_name ?? '',
      base_currency: user?.base_currency ?? 'USD',
    },
    mode: 'onBlur',
  })

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateUser(data)
      toast.success('Profile updated')
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" value={user?.username ?? ''} disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Display Name</Label>
        <Input id="display_name" {...register('display_name')} />
        <FormError message={errors.display_name?.message} />
      </div>

      <div className="space-y-2">
        <Label>Base Currency</Label>
        <Select
          value={watch('base_currency')}
          onValueChange={(v) =>
            setValue('base_currency', v, { shouldValidate: true })
          }
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
        <FormError message={errors.base_currency?.message} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </Button>
    </form>
  )
}
