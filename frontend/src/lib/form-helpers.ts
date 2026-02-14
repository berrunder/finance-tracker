import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { mapApiErrorToFieldError } from '@/lib/error-mapping'

export function handleMutationError(error: unknown): void {
  if (error instanceof ApiError) {
    toast.error(error.message)
  } else {
    toast.error('An unexpected error occurred')
  }
}

/**
 * Handles API errors from form submissions by mapping known error codes to
 * form field errors or a root-level server error string.
 *
 * Returns the server error message to display above the form, or null if the
 * error was mapped to a specific field.
 */
export function handleFormSubmitError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (error instanceof ApiError) {
    const fieldError = mapApiErrorToFieldError(error)
    if (fieldError) {
      if (fieldError.field === 'root') {
        return fieldError.message
      }
      setError(fieldError.field as Path<T>, { message: fieldError.message })
      return null
    }
    return error.message
  }
  return 'An unexpected error occurred'
}

export function getSubmitLabel(
  isEdit: boolean,
  isPending: boolean,
  editLabel = 'Save',
  createLabel = 'Create',
): string {
  if (isPending) return isEdit ? 'Saving...' : 'Creating...'
  return isEdit ? editLabel : createLabel
}
