import { apiClient } from './client'
import type { ExchangeRate } from '@/types/api'

interface ExchangeRatesResponse {
  data: ExchangeRate[]
}

export function getExchangeRates(): Promise<ExchangeRatesResponse> {
  return apiClient<ExchangeRatesResponse>('/exchange-rates')
}
