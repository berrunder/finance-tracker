import { apiClient } from './client'
import type { FullImportRequest, FullImportResponse } from '@/types/api'

export function importFull(
  data: FullImportRequest,
): Promise<FullImportResponse> {
  return apiClient<FullImportResponse>('/import/full', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
