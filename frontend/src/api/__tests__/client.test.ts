import {
  ApiError,
  apiClient,
  clearTokens,
  setAccessToken,
  getAccessToken,
  setOnAuthFailure,
  setOnQueryCancellation,
  setOnNetworkStatus,
  clearOnNetworkStatusIf,
  getNetworkStatus,
} from '../client'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as Response
}

function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ error: { code, message } }, status)
}

beforeEach(() => {
  mockFetch.mockReset()
  clearTokens()
  setOnAuthFailure(null)
  setOnQueryCancellation(null)
  setOnNetworkStatus(null)
})

describe('apiClient', () => {
  it('makes fetch calls with correct URL, headers, and credentials', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    const result = await apiClient('/accounts')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/accounts', {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    expect(result).toEqual({ id: 1 })
  })

  it('includes Authorization header when access token is set', async () => {
    setAccessToken('test-token')
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    await apiClient('/accounts')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/accounts', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      credentials: 'include',
    })
  })

  it('skips Authorization header when skipAuth is true', async () => {
    setAccessToken('test-token')
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiClient('/auth/login', {
      method: 'POST',
      body: '{}',
      skipAuth: true,
    })

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers).not.toHaveProperty('Authorization')
    expect(options.credentials).toBe('include')
  })

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
    } as Response)

    const result = await apiClient('/accounts/1', { method: 'DELETE' })
    expect(result).toBeUndefined()
  })

  it('throws ApiError on error responses', async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse('NOT_FOUND', 'Account not found', 404),
    )

    await expect(apiClient('/accounts/999')).rejects.toThrow(ApiError)

    try {
      mockFetch.mockResolvedValueOnce(
        errorResponse('NOT_FOUND', 'Account not found', 404),
      )
      await apiClient('/accounts/999')
    } catch (e) {
      const err = e as ApiError
      expect(err.status).toBe(404)
      expect(err.code).toBe('NOT_FOUND')
      expect(err.message).toBe('Account not found')
    }
  })

  it('handles non-JSON error body gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('invalid json')),
      headers: new Headers(),
    } as unknown as Response)

    await expect(apiClient('/broken')).rejects.toThrow(ApiError)
  })
})

describe('401 interceptor', () => {
  it('triggers refresh and retries the original request on 401', async () => {
    setAccessToken('expired-token')

    // First call: 401
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'Token expired', 401),
    )
    // Refresh call: success (cookie is set by the server, no body token)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        access_token: 'new-access',
        user: { id: '1', username: 'u' },
      }),
    )
    // Retry: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'ok' }))

    const result = await apiClient('/accounts')

    expect(result).toEqual({ data: 'ok' })
    expect(getAccessToken()).toBe('new-access')
    // The refresh call must send credentials so the HttpOnly cookie reaches the server
    const refreshCall = mockFetch.mock.calls.find(
      ([url]) => url === '/api/v1/auth/refresh',
    )
    expect(refreshCall?.[1]?.credentials).toBe('include')
  })

  it('does NOT trigger refresh for /auth/ endpoints', async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'Bad creds', 401),
    )

    await expect(
      apiClient('/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toThrow(ApiError)

    // Only one fetch call — no refresh attempted
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('queues concurrent 401 requests and retries after refresh', async () => {
    setAccessToken('expired')

    let callCount = 0
    mockFetch.mockImplementation((url: string) => {
      callCount++
      if (url === '/api/v1/auth/refresh') {
        return Promise.resolve(
          jsonResponse({
            access_token: 'new-access',
            user: { id: '1', username: 'u' },
          }),
        )
      }
      // First two calls return 401, subsequent retries succeed
      if (callCount <= 2) {
        return Promise.resolve(errorResponse('UNAUTHORIZED', 'expired', 401))
      }
      if (url === '/api/v1/accounts') {
        return Promise.resolve(jsonResponse({ first: true }))
      }
      return Promise.resolve(jsonResponse({ second: true }))
    })

    const [r1, r2] = await Promise.all([
      apiClient('/accounts'),
      apiClient('/categories'),
    ])

    expect(r1).toEqual({ first: true })
    expect(r2).toEqual({ second: true })
  })

  it('clears tokens and calls onAuthFailure when refresh fails', async () => {
    setAccessToken('expired')
    const onFailure = vi.fn()
    setOnAuthFailure(onFailure)

    // Original: 401
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    // Refresh: fails
    mockFetch.mockResolvedValueOnce(
      errorResponse('INVALID_TOKEN', 'bad refresh', 401),
    )

    await expect(apiClient('/accounts')).rejects.toThrow()

    expect(getAccessToken()).toBeNull()
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it('rejects queued requests when refresh fails', async () => {
    setAccessToken('expired')
    setOnAuthFailure(vi.fn())

    // Both calls 401
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    // Refresh fails
    mockFetch.mockResolvedValueOnce(
      errorResponse('INVALID_TOKEN', 'bad refresh', 401),
    )

    const results = await Promise.allSettled([
      apiClient('/accounts'),
      apiClient('/categories'),
    ])

    expect(results[0].status).toBe('rejected')
    expect(results[1].status).toBe('rejected')
  })

  it('circuit breaker prevents repeated refresh attempts after failure', async () => {
    setAccessToken('expired')
    setOnAuthFailure(vi.fn())

    // First request: 401 → refresh fails
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    mockFetch.mockResolvedValueOnce(
      errorResponse('INVALID_TOKEN', 'bad refresh', 401),
    )

    await expect(apiClient('/accounts')).rejects.toThrow()
    const callsAfterFirstFailure = mockFetch.mock.calls.length

    // Second request: 401 → circuit breaker should block refresh
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )

    await expect(apiClient('/accounts')).rejects.toThrow(ApiError)
    // Only 1 new fetch call (the request itself), no refresh attempt
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirstFailure + 1)
  })

  it('circuit breaker resets after successful login (setAccessToken)', async () => {
    setAccessToken('expired')
    setOnAuthFailure(vi.fn())

    // Trigger circuit breaker
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    mockFetch.mockResolvedValueOnce(
      errorResponse('INVALID_TOKEN', 'bad refresh', 401),
    )
    await expect(apiClient('/accounts')).rejects.toThrow()

    // Simulate re-login
    setAccessToken('fresh-token')

    // Next 401 should attempt refresh again
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        access_token: 'new-access',
        user: { id: '1', username: 'u' },
      }),
    )
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'ok' }))

    const result = await apiClient('/accounts')
    expect(result).toEqual({ data: 'ok' })
  })

  it('calls onQueryCancellation when refresh fails', async () => {
    setAccessToken('expired')
    setOnAuthFailure(vi.fn())
    const onCancel = vi.fn()
    setOnQueryCancellation(onCancel)

    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    mockFetch.mockResolvedValueOnce(
      errorResponse('INVALID_TOKEN', 'bad refresh', 401),
    )

    await expect(apiClient('/accounts')).rejects.toThrow()

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('network status', () => {
  it('publishes online=true on a successful response', async () => {
    const onStatus = vi.fn()
    setOnNetworkStatus(onStatus)
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiClient('/accounts')

    expect(onStatus).toHaveBeenCalledWith(true)
    expect(getNetworkStatus()).toBe(true)
  })

  it('publishes online=true even on 4xx/5xx responses (server reachable)', async () => {
    const onStatus = vi.fn()
    setOnNetworkStatus(onStatus)
    mockFetch.mockResolvedValueOnce(
      errorResponse('NOT_FOUND', 'not found', 404),
    )

    await expect(apiClient('/accounts/x')).rejects.toThrow(ApiError)

    expect(onStatus).toHaveBeenCalledWith(true)
    expect(getNetworkStatus()).toBe(true)
  })

  it.each([
    ['Chrome', new TypeError('Failed to fetch')],
    ['Safari', new TypeError('Load failed')],
    ['Firefox', new TypeError('NetworkError when attempting to fetch')],
  ])('publishes online=false on %s network error', async (_browser, error) => {
    const onStatus = vi.fn()
    setOnNetworkStatus(onStatus)
    mockFetch.mockRejectedValueOnce(error)

    await expect(apiClient('/accounts')).rejects.toThrow()

    expect(onStatus).toHaveBeenCalledWith(false)
    expect(getNetworkStatus()).toBe(false)
  })

  it('does not publish on non-network errors during fetch', async () => {
    const onStatus = vi.fn()
    setOnNetworkStatus(onStatus)
    // A non-TypeError thrown by fetch (rare, but isn't a network signal)
    mockFetch.mockRejectedValueOnce(new Error('aborted'))

    await expect(apiClient('/accounts')).rejects.toThrow()

    expect(onStatus).not.toHaveBeenCalled()
  })

  it('clearOnNetworkStatusIf only clears when the active callback matches', async () => {
    const cbA = vi.fn()
    const cbB = vi.fn()
    setOnNetworkStatus(cbA)

    // Stale cleanup from a previous registration: must NOT clear.
    clearOnNetworkStatusIf(cbB)
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await apiClient('/accounts')
    expect(cbA).toHaveBeenCalledWith(true)

    // Cleanup with the active callback: clears.
    clearOnNetworkStatusIf(cbA)
    cbA.mockClear()
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }))
    await apiClient('/accounts')
    expect(cbA).not.toHaveBeenCalled()
  })

  it('updates getNetworkStatus on the refresh fetch path', async () => {
    setAccessToken('expired')
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'expired', 401),
    )
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        access_token: 'new-access',
        user: { id: '1', username: 'u' },
      }),
    )
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'ok' }))

    await apiClient('/accounts')

    // All three fetches reached the server, so latest state is online=true.
    expect(getNetworkStatus()).toBe(true)
  })
})
