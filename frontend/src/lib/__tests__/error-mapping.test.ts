import { ApiError } from '@/api/client'
import { mapApiErrorToFieldError } from '../error-mapping'

function makeError(code: string, message = 'Error'): ApiError {
  return new ApiError(400, { code, message })
}

describe('mapApiErrorToFieldError', () => {
  it('maps USER_EXISTS to username field', () => {
    const result = mapApiErrorToFieldError(makeError('USER_EXISTS'))
    expect(result).toEqual({
      field: 'username',
      message: 'This username is already taken',
    })
  })

  it('maps INVALID_CREDENTIALS to root', () => {
    const result = mapApiErrorToFieldError(makeError('INVALID_CREDENTIALS'))
    expect(result).toEqual({
      field: 'root',
      message: 'Invalid username or password',
    })
  })

  it('maps INVALID_INVITE_CODE to invite_code field', () => {
    const result = mapApiErrorToFieldError(makeError('INVALID_INVITE_CODE'))
    expect(result).toEqual({
      field: 'invite_code',
      message: 'Invalid invite code',
    })
  })

  it('maps VALIDATION_ERROR to root with original message', () => {
    const error = makeError('VALIDATION_ERROR', 'Field X is invalid')
    const result = mapApiErrorToFieldError(error)
    expect(result).toEqual({
      field: 'root',
      message: 'Field X is invalid',
    })
  })

  it('maps HAS_CHILDREN to root', () => {
    const result = mapApiErrorToFieldError(makeError('HAS_CHILDREN'))
    expect(result).toEqual({
      field: 'root',
      message: 'Cannot delete: category has subcategories',
    })
  })

  it('maps HAS_TRANSACTIONS to root', () => {
    const result = mapApiErrorToFieldError(makeError('HAS_TRANSACTIONS'))
    expect(result).toEqual({
      field: 'root',
      message: 'Cannot delete: category has transactions',
    })
  })

  it('maps NOT_FOUND to root', () => {
    const result = mapApiErrorToFieldError(makeError('NOT_FOUND'))
    expect(result).toEqual({
      field: 'root',
      message: 'Resource not found',
    })
  })

  it('returns null for unknown error code', () => {
    const result = mapApiErrorToFieldError(makeError('SOMETHING_ELSE'))
    expect(result).toBeNull()
  })
})
