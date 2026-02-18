import { apiClient } from './client'
import type { CSVConfirmRequest, CSVUploadResponse } from '@/types/api'

export interface ImportConfirmResponse {
  imported: number
}

export function uploadCSV(file: File): Promise<CSVUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient<CSVUploadResponse>('/import/csv', {
    method: 'POST',
    body: formData,
  })
}

export function confirmImport(
  data: CSVConfirmRequest,
): Promise<ImportConfirmResponse> {
  return apiClient<ImportConfirmResponse>('/import/csv/confirm', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
