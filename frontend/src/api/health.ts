import { apiClient } from './client'

export function checkHealth(): Promise<void> {
  return apiClient<void>('/health', { skipAuth: true })
}
