import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { registerSchema, type RegisterFormData } from '@/lib/validators'
import { mapApiErrorToFieldError } from '@/lib/error-mapping'
import { ApiError } from '@/api/client'
import { CURRENCIES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      confirm_password: '',
      display_name: '',
      base_currency: '',
      invite_code: '',
    },
    mode: 'onBlur',
  })

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)
    try {
      const { confirm_password: _, ...apiData } = data
      await registerUser(apiData)
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldError = mapApiErrorToFieldError(error)
        if (fieldError) {
          if (fieldError.field === 'root') {
            setServerError(fieldError.message)
          } else {
            setError(fieldError.field as keyof RegisterFormData, {
              message: fieldError.message,
            })
          }
        } else {
          setServerError(error.message)
        }
      } else {
        setServerError('An unexpected error occurred')
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>
            Fill in the details below to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register('username')} />
              {errors.username && (
                <p className="text-destructive text-sm">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-destructive text-sm">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="text-destructive text-sm">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" {...register('display_name')} />
              {errors.display_name && (
                <p className="text-destructive text-sm">
                  {errors.display_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Base Currency</Label>
              <Select
                onValueChange={(value) =>
                  setValue('base_currency', value, { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.base_currency && (
                <p className="text-destructive text-sm">
                  {errors.base_currency.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite_code">Invite Code</Label>
              <Input id="invite_code" {...register('invite_code')} />
              {errors.invite_code && (
                <p className="text-destructive text-sm">
                  {errors.invite_code.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
