import { apiClient } from './client'
import type {
  Account,
  CreateAccountRequest,
  UpdateAccountRequest,
} from '@/types/api'

interface AccountsResponse {
  data: Account[]
}

export function getAccounts(): Promise<AccountsResponse> {
  return apiClient<AccountsResponse>('/accounts')
}

export function getAccount(id: string): Promise<Account> {
  return apiClient<Account>(`/accounts/${id}`)
}

export function createAccount(data: CreateAccountRequest): Promise<Account> {
  return apiClient<Account>('/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAccount(
  id: string,
  data: UpdateAccountRequest,
): Promise<Account> {
  return apiClient<Account>(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteAccount(id: string): Promise<void> {
  return apiClient<void>(`/accounts/${id}`, { method: 'DELETE' })
}
