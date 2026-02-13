import { apiClient } from './client'
import type {
  Transaction,
  PaginatedResponse,
  CreateTransactionRequest,
  CreateTransferRequest,
  UpdateTransactionRequest,
} from '@/types/api'

export interface TransactionFilters {
  account_id?: string
  category_id?: string
  type?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}

function buildQueryString(filters: TransactionFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function getTransactions(
  filters: TransactionFilters = {},
): Promise<PaginatedResponse<Transaction>> {
  return apiClient<PaginatedResponse<Transaction>>(
    `/transactions${buildQueryString(filters)}`,
  )
}

export function getTransaction(id: string): Promise<Transaction> {
  return apiClient<Transaction>(`/transactions/${id}`)
}

export function createTransaction(
  data: CreateTransactionRequest,
): Promise<Transaction> {
  return apiClient<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function createTransfer(
  data: CreateTransferRequest,
): Promise<{ data: Transaction[] }> {
  return apiClient<{ data: Transaction[] }>('/transactions/transfer', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTransaction(
  id: string,
  data: UpdateTransactionRequest,
): Promise<Transaction> {
  return apiClient<Transaction>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteTransaction(id: string): Promise<void> {
  return apiClient<void>(`/transactions/${id}`, { method: 'DELETE' })
}
