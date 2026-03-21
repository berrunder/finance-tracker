import { apiClient } from './client'
import type {
  Currency,
  CreateCurrencyRequest,
  UpdateCurrencyRequest,
} from '@/types/api'

interface CurrenciesResponse {
  data: Currency[]
}

export function getCurrencies(): Promise<CurrenciesResponse> {
  return apiClient<CurrenciesResponse>('/currencies', { skipAuth: true })
}

export function createCurrency(data: CreateCurrencyRequest): Promise<Currency> {
  return apiClient<Currency>('/currencies', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateCurrency(
  code: string,
  data: UpdateCurrencyRequest,
): Promise<Currency> {
  return apiClient<Currency>(`/currencies/${code}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
