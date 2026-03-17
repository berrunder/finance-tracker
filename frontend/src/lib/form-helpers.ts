import type {
  FieldValues,
  Path,
  UseFormReturn,
  UseFormSetError,
} from 'react-hook-form'
import type { FocusEvent } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { mapApiErrorToFieldError } from '@/lib/error-mapping'
import { evaluateExpression } from '@/lib/expression'

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

/**
 * Evaluates any arithmetic expressions in the given fields and writes
 * the resolved values back into the form before validation runs.
 * Call this before form.handleSubmit() to handle Enter-key submissions.
 */
export function evalAmountFields<T extends FieldValues>(
  form: UseFormReturn<T>,
  fields: Path<T>[],
  decimals: number = 2,
): void {
  for (const field of fields) {
    const value = form.getValues(field) as string
    const result = evaluateExpression(value, decimals)
    if (result !== null) {
      form.setValue(field, result as T[typeof field], { shouldValidate: false })
    }
  }
}

/**
 * Wraps `form.register()` for an amount field, adding expression evaluation
 * on blur. When the user types e.g. "3000-279", it resolves to "2721" before
 * RHF's blur validation runs.
 */
export function registerAmountField<T extends FieldValues>(
  form: UseFormReturn<T>,
  field: Path<T>,
  decimals: number = 2,
) {
  const registration = form.register(field)
  return {
    ...registration,
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      const result = evaluateExpression(e.target.value, decimals)
      if (result !== null) {
        form.setValue(field, result as T[typeof field], {
          shouldValidate: false,
        })
        e.target.value = result
      }
      registration.onBlur(e)
    },
  }
}
