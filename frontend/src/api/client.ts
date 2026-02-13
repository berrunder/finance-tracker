import type { ApiErrorDetail, AuthResponse } from '@/types/api'
import { REFRESH_TOKEN_KEY } from '@/lib/constants'

// Custom error class for API errors
export class ApiError extends Error {
  status: number
  code: string
  details?: string

  constructor(status: number, errorDetail: ApiErrorDetail) {
    super(errorDetail.message)
    this.name = 'ApiError'
    this.status = status
    this.code = errorDetail.code
    this.details = errorDetail.details
  }
}

// Module-level token state (intentionally lost on page refresh)
let accessToken: string | null = null

// Refresh state
let isRefreshing = false
let refreshQueue: Array<{
  resolve: () => void
  reject: (error: Error) => void
}> = []

// Auth failure callback — set by AuthProvider to clear state via React
let onAuthFailure: (() => void) | null = null
export function setOnAuthFailure(cb: (() => void) | null): void {
  onAuthFailure = cb
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function clearTokens(): void {
  accessToken = null
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

async function performRefresh(): Promise<AuthResponse> {
  const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshTokenValue) {
    throw new Error('No refresh token')
  }

  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'Refresh failed' },
    }))
    throw new ApiError(response.status, errorBody.error)
  }

  return response.json() as Promise<AuthResponse>
}

async function handle401<T>(
  endpoint: string,
  options?: RequestOptions,
): Promise<T> {
  if (isRefreshing) {
    // Queue this request — wait for the in-flight refresh to complete
    return new Promise<T>((resolve, reject) => {
      refreshQueue.push({
        resolve: () => {
          resolve(apiClient<T>(endpoint, options))
        },
        reject,
      })
    })
  }

  isRefreshing = true

  try {
    const data = await performRefresh()

    accessToken = data.access_token
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
  } catch (error) {
    // Refresh failed — reject all queued requests, clear auth
    const pending = [...refreshQueue]
    refreshQueue = []
    pending.forEach(({ reject }) => reject(error as Error))
    clearTokens()
    onAuthFailure?.()
    throw error
  } finally {
    // Always reset before draining — any 401 from a retry will start
    // a fresh refresh cycle instead of queueing into a dead queue.
    isRefreshing = false
  }

  // Drain the queue after isRefreshing is false so retries that
  // themselves 401 will correctly enter a new refresh cycle.
  const pending = [...refreshQueue]
  refreshQueue = []
  pending.forEach(({ resolve }) => resolve())

  // Retry the original request
  return apiClient<T>(endpoint, options)
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestOptions,
): Promise<T> {
  const url = `/api/v1${endpoint}`
  const { skipAuth, ...fetchOptions } = options ?? {}

  const headers: Record<string, string> = {}
  // Skip Content-Type for FormData — the browser sets it with the correct boundary
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  Object.assign(headers, fetchOptions.headers as Record<string, string>)

  if (accessToken && !skipAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, { ...fetchOptions, headers })

  // 401 interceptor — skip for auth endpoints (infinite loop guard)
  if (response.status === 401 && !endpoint.startsWith('/auth/')) {
    return handle401<T>(endpoint, options)
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'An unexpected error occurred' },
    }))
    throw new ApiError(response.status, errorBody.error)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}
