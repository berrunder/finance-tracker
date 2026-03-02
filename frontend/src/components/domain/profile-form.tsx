import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  profileSchema,
  changePasswordSchema,
  type ProfileFormData,
  type ChangePasswordFormData,
} from '@/lib/validators'
import { useAuth } from '@/hooks/use-auth'
import { useCurrencies } from '@/hooks/use-currencies'
import { handleMutationError } from '@/lib/form-helpers'
import { ApiError } from '@/api/client'
import { changePassword } from '@/api/user'
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
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false)

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

  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    reset: resetPw,
    setError: setPwError,
    formState: { errors: pwErrors, isSubmitting: isPwSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
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

  const onSubmitPassword = async (data: ChangePasswordFormData) => {
    try {
      await changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
      })
      toast.success('Password updated')
      resetPw()
      setPasswordSectionOpen(false)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setPwError('current_password', { message: 'Current password is incorrect' })
      } else {
        handleMutationError(error)
      }
    }
  }

  const handleTogglePasswordSection = () => {
    if (passwordSectionOpen) {
      resetPw()
    }
    setPasswordSectionOpen((prev) => !prev)
  }

  return (
    <div className="max-w-md space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleTogglePasswordSection}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {passwordSectionOpen ? 'Cancel password change' : 'Change password'}
        </button>

        {passwordSectionOpen && (
          <form onSubmit={handleSubmitPw(onSubmitPassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                {...registerPw('current_password')}
              />
              <FormError message={pwErrors.current_password?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                {...registerPw('new_password')}
              />
              <FormError message={pwErrors.new_password?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_new_password">Confirm New Password</Label>
              <Input
                id="confirm_new_password"
                type="password"
                {...registerPw('confirm_new_password')}
              />
              <FormError message={pwErrors.confirm_new_password?.message} />
            </div>

            <Button type="submit" disabled={isPwSubmitting}>
              {isPwSubmitting ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
