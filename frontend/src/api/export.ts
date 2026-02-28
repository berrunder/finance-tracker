import { getAccessToken } from './client'

export async function exportTransactionsCSV(
  dateFrom: string,
  dateTo: string,
): Promise<Blob> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  const response = await fetch(`/api/v1/export/csv?${params}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  })

  if (!response.ok) {
    throw new Error('Export failed')
  }

  return response.blob()
}
