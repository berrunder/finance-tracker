import { apiClient } from './client'
import type { Currency } from '@/types/api'

interface CurrenciesResponse {
  data: Currency[]
}

export function getCurrencies(): Promise<CurrenciesResponse> {
  return apiClient<CurrenciesResponse>('/currencies', { skipAuth: true })
}
