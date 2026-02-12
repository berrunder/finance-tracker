import type { ApiError } from '@/api/client'

interface FieldError {
  field: string
  message: string
}

export function mapApiErrorToFieldError(error: ApiError): FieldError | null {
  switch (error.code) {
    case 'USER_EXISTS':
      return { field: 'username', message: 'This username is already taken' }
    case 'INVALID_CREDENTIALS':
      return { field: 'root', message: 'Invalid username or password' }
    case 'INVALID_INVITE_CODE':
      return { field: 'invite_code', message: 'Invalid invite code' }
    case 'VALIDATION_ERROR':
      return { field: 'root', message: error.message }
    default:
      return null
  }
}
