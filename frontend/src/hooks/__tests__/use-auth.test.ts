import { createElement, type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../use-auth'

// Mock the API modules
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  refreshToken: vi.fn(),
}))

vi.mock('@/api/user', () => ({
  updateUser: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  setAccessToken: vi.fn(),
  clearTokens: vi.fn(),
  setOnAuthFailure: vi.fn(),
}))

import { login as apiLogin, refreshToken } from '@/api/auth'
import { setAccessToken, clearTokens } from '@/api/client'

const mockUser = {
  id: '1',
  username: 'testuser',
  display_name: 'Test User',
  base_currency: 'USD',
  created_at: '2024-01-01T00:00:00Z',
}

const mockAuthResponse = {
  access_token: 'access-123',
  refresh_token: 'refresh-123',
  user: mockUser,
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AuthProvider, null, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
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

  it('starts unauthenticated when no refresh token in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it('login flow sets tokens and user', async () => {
    vi.mocked(apiLogin).mockResolvedValueOnce(mockAuthResponse)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('testuser', 'password')
    })

    expect(apiLogin).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password',
    })
    expect(setAccessToken).toHaveBeenCalledWith('access-123')
    expect(localStorage.getItem('refresh_token')).toBe('refresh-123')
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout clears tokens and user', async () => {
    vi.mocked(apiLogin).mockResolvedValueOnce(mockAuthResponse)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('testuser', 'password')
    })

    act(() => {
      result.current.logout()
    })

    expect(clearTokens).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('refreshes on mount when refresh token exists', async () => {
    localStorage.setItem('refresh_token', 'stored-refresh')
    vi.mocked(refreshToken).mockResolvedValueOnce(mockAuthResponse)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(refreshToken).toHaveBeenCalledWith('stored-refresh')
    expect(setAccessToken).toHaveBeenCalledWith('access-123')
    expect(result.current.user).toEqual(mockUser)
  })

  it('does not refresh on mount when no token in localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(refreshToken).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('clears tokens on refresh failure', async () => {
    localStorage.setItem('refresh_token', 'bad-refresh')
    vi.mocked(refreshToken).mockRejectedValueOnce(new Error('bad token'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(clearTokens).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })
})
