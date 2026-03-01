import { REFRESH_TOKEN_KEY } from '@/lib/constants'
import { getAccessToken, setAccessToken } from './client'

async function fetchExport(
  dateFrom: string,
  dateTo: string,
): Promise<Response> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  return fetch(`/api/v1/export/csv?${params}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  })
}

export async function exportTransactionsCSV(
  dateFrom: string,
  dateTo: string,
): Promise<Blob> {
  let response = await fetchExport(dateFrom, dateTo)

  // Handle expired token: refresh and retry once
  if (response.status === 401) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (refreshToken) {
      const refreshResponse = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (refreshResponse.ok) {
        const data = (await refreshResponse.json()) as {
          access_token: string
          refresh_token: string
        }
        setAccessToken(data.access_token)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
        response = await fetchExport(dateFrom, dateTo)
      }
    }
  }

  if (!response.ok) {
    throw new Error('Export failed')
  }

  return response.blob()
}
