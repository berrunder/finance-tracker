import { toast } from 'sonner'
import { ApiError } from '@/api/client'

export function handleMutationError(error: unknown): void {
  if (error instanceof ApiError) {
    toast.error(error.message)
  } else {
    toast.error('An unexpected error occurred')
  }
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
