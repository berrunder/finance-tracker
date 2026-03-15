import { apiClient } from './client'

export async function exportTransactionsCSV(
  dateFrom: string,
  dateTo: string,
): Promise<Blob> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  return apiClient<Blob>(`/export/csv?${params}`, { responseType: 'blob' })
}
