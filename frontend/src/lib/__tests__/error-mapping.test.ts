import { ApiError } from '@/api/client'
import { mapApiErrorToFieldError } from '../error-mapping'

function makeError(code: string, message = 'Error'): ApiError {
  return new ApiError(400, { code, message })
}

describe('mapApiErrorToFieldError', () => {
  it('maps REGISTRATION_REJECTED to root', () => {
    const result = mapApiErrorToFieldError(makeError('REGISTRATION_REJECTED'))
    expect(result).toEqual({
      field: 'root',
      message: 'Registration rejected',
    })
  })

  it('maps INVALID_CREDENTIALS to root', () => {
    const result = mapApiErrorToFieldError(makeError('INVALID_CREDENTIALS'))
    expect(result).toEqual({
      field: 'root',
      message: 'Invalid username or password',
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
