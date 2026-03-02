import { apiClient } from './client'
import type { UpdateUserRequest, User } from '@/types/api'

export function updateUser(data: UpdateUserRequest): Promise<User> {
  return apiClient<User>('/user', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function resetUserData(): Promise<void> {
  return apiClient<void>('/user/reset', { method: 'POST' })
}

export function changePassword(data: {
  current_password: string
  new_password: string
}): Promise<void> {
  return apiClient<void>('/user/password', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
