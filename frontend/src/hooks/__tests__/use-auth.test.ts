import { createElement, type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../use-auth'

// Mock the API modules
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/api/user', () => ({
  updateUser: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  setAccessToken: vi.fn(),
  clearTokens: vi.fn(),
  setOnAuthFailure: vi.fn(),
  setOnQueryCancellation: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  clearAllOfflineData: vi.fn().mockResolvedValue(undefined),
}))

import {
  login as apiLogin,
  logout as apiLogout,
  refreshToken,
} from '@/api/auth'
import {
  setAccessToken,
  clearTokens,
  setOnQueryCancellation,
} from '@/api/client'

const mockUser = {
  id: '1',
  username: 'testuser',
  display_name: 'Test User',
  base_currency: 'USD',
  created_at: '2024-01-01T00:00:00Z',
}

const mockAuthResponse = {
  access_token: 'access-123',
  user: mockUser,
}

let queryClient = new QueryClient()

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(AuthProvider, null, children),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    )
    spy.mockRestore()
  })

  it('attempts refresh on mount and stays unauthenticated on failure', async () => {
    vi.mocked(refreshToken).mockRejectedValueOnce(new Error('no cookie'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(clearTokens).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('restores session on mount when refresh cookie is valid', async () => {
    vi.mocked(refreshToken).mockResolvedValueOnce(mockAuthResponse)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(setAccessToken).toHaveBeenCalledWith('access-123')
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('login flow sets access token and user', async () => {
    vi.mocked(refreshToken).mockRejectedValueOnce(new Error('no cookie'))
    vi.mocked(apiLogin).mockResolvedValueOnce(mockAuthResponse)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.login('testuser', 'password')
    })

    expect(apiLogin).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password',
    })
    expect(setAccessToken).toHaveBeenCalledWith('access-123')
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout calls API, clears tokens, and resets user', async () => {
    vi.mocked(refreshToken).mockRejectedValueOnce(new Error('no cookie'))
    vi.mocked(apiLogin).mockResolvedValueOnce(mockAuthResponse)
    vi.mocked(apiLogout).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.login('testuser', 'password')
    })

    act(() => {
      result.current.logout()
    })

    expect(apiLogout).toHaveBeenCalledTimes(1)
    expect(clearTokens).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('registers query cancellation callback that calls cancelQueries', async () => {
    vi.mocked(refreshToken).mockRejectedValueOnce(new Error('no cookie'))
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries')

    renderHook(() => useAuth(), { wrapper })

    const cb = vi.mocked(setOnQueryCancellation).mock.calls[0][0]
    expect(cb).toBeTypeOf('function')

    cb!()
    expect(cancelSpy).toHaveBeenCalledTimes(1)
  })
})
