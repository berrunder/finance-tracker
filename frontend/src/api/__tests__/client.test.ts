import {
  ApiError,
  apiClient,
  setAccessToken,
  getAccessToken,
  setOnAuthFailure,
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
  setAccessToken(null)
  localStorage.clear()
  setOnAuthFailure(null)
})

describe('apiClient', () => {
  it('makes fetch calls with correct URL and headers', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    const result = await apiClient('/accounts')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/accounts', {
      headers: { 'Content-Type': 'application/json' },
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
    localStorage.setItem('refresh_token', 'valid-refresh')

    // First call: 401
    mockFetch.mockResolvedValueOnce(
      errorResponse('UNAUTHORIZED', 'Token expired', 401),
    )
    // Refresh call: success
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        user: { id: '1', username: 'u' },
      }),
    )
    // Retry: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'ok' }))

    const result = await apiClient('/accounts')

    expect(result).toEqual({ data: 'ok' })
    expect(getAccessToken()).toBe('new-access')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
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
    localStorage.setItem('refresh_token', 'valid-refresh')

    let callCount = 0
    mockFetch.mockImplementation((url: string) => {
      callCount++
      if (url === '/api/v1/auth/refresh') {
        return Promise.resolve(
          jsonResponse({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
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
    localStorage.setItem('refresh_token', 'bad-refresh')
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
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it('rejects queued requests when refresh fails', async () => {
    setAccessToken('expired')
    localStorage.setItem('refresh_token', 'bad-refresh')
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
})
