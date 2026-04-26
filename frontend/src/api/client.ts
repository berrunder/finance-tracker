import type { ApiErrorDetail, AuthResponse } from '@/types/api'

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

// Module-level token state (intentionally lost on page refresh — the HttpOnly
// refresh cookie restores the session on reload).
let accessToken: string | null = null

// Refresh state
let isRefreshing = false
let refreshQueue: Array<{
  resolve: () => void
  reject: (error: Error) => void
}> = []

// Circuit breaker: once refresh fails, stop attempting until a successful login resets it
let authFailed = false

// Auth failure callback — set by AuthProvider to clear state via React
let onAuthFailure: (() => void) | null = null
export function setOnAuthFailure(cb: (() => void) | null): void {
  onAuthFailure = cb
}

// Query cancellation callback — set by AuthProvider to cancel in-flight queries
let onQueryCancellation: (() => void) | null = null
export function setOnQueryCancellation(cb: (() => void) | null): void {
  onQueryCancellation = cb
}

// Network status — published synchronously from every fetch result so the UI
// can read truth without waiting for React commits (navigator.onLine is
// unreliable on mobile PWAs after waking from background).
let onNetworkStatus: ((online: boolean) => void) | null = null
let lastNetworkStatus: boolean | null = null

export function setOnNetworkStatus(
  cb: ((online: boolean) => void) | null,
): void {
  onNetworkStatus = cb
}

// Compare-and-clear: only nulls the slot if the active callback is still `cb`.
// Prevents an unmounting provider from clobbering a newly-mounted one when
// React remounts overlap (HMR, Suspense).
export function clearOnNetworkStatusIf(cb: (online: boolean) => void): void {
  if (onNetworkStatus === cb) onNetworkStatus = null
}

// Latest fetch-derived online state. `null` until the first fetch runs.
// Read by callers (e.g. post-mutation toasts) that need the freshest signal
// without going through React state.
export function getNetworkStatus(): boolean | null {
  return lastNetworkStatus
}

export function setAccessToken(token: string | null): void {
  accessToken = token
  if (token !== null) {
    authFailed = false
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function clearTokens(): void {
  accessToken = null
  authFailed = false
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
  responseType?: 'blob'
}

function apiUrl(endpoint: string): string {
  return `${import.meta.env.BASE_URL}api/v1${endpoint}`
}

async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(input, init)
    // Reaching the server (even with a 4xx/5xx) proves connectivity.
    lastNetworkStatus = true
    onNetworkStatus?.(true)
    return response
  } catch (error) {
    if (isNetworkError(error)) {
      lastNetworkStatus = false
      onNetworkStatus?.(false)
    }
    throw error
  }
}

async function performRefresh(): Promise<AuthResponse> {
  const response = await trackedFetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
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
  // Circuit breaker: if refresh already failed, don't try again
  if (authFailed) {
    throw new ApiError(401, {
      code: 'UNAUTHORIZED',
      message: 'Session expired',
    })
  }

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
  } catch (error) {
    const pending = [...refreshQueue]
    refreshQueue = []
    pending.forEach(({ reject }) => reject(error as Error))

    if (isNetworkError(error)) {
      // Network failure — don't lock out, the refresh cookie may still be valid
      throw error
    }

    // Auth failure — activate circuit breaker, cancel queries, clear auth
    clearTokens()
    authFailed = true
    onQueryCancellation?.()
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
  const url = apiUrl(endpoint)
  const { skipAuth, responseType, ...fetchOptions } = options ?? {}

  const headers: Record<string, string> = {}
  // Skip Content-Type for FormData — the browser sets it with the correct boundary
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  Object.assign(headers, fetchOptions.headers as Record<string, string>)

  if (accessToken && !skipAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await trackedFetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  })

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

  if (responseType === 'blob') {
    return response.blob() as Promise<T>
  }

  return response.json() as Promise<T>
}

/**
 * Returns true if the error is a network failure (offline, DNS, timeout)
 * as opposed to an HTTP error from the server.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false
  const msg = error.message.toLowerCase()
  return (
    msg === 'failed to fetch' || // Chrome/Edge
    msg === 'load failed' || // Safari
    msg.includes('networkerror') // Firefox
  )
}
