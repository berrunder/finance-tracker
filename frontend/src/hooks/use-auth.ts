import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { createElement } from 'react'
import type { User } from '@/types/api'
import {
  login as apiLogin,
  register as apiRegister,
  refreshToken,
} from '@/api/auth'
import { setAccessToken, clearTokens, setOnAuthFailure } from '@/api/client'
import { REFRESH_TOKEN_KEY } from '@/lib/constants'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: {
    username: string
    password: string
    display_name: string
    base_currency: string
    invite_code: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Register auth failure callback so the API client can clear state via React
  // instead of using window.location.href (which causes a full page reload)
  useEffect(() => {
    setOnAuthFailure(() => {
      setUser(null)
    })
    return () => setOnAuthFailure(null)
  }, [])

  // Startup: try to refresh from stored refresh token
  useEffect(() => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!storedRefreshToken) {
      setIsLoading(false)
      return
    }

    refreshToken(storedRefreshToken)
      .then((data) => {
        setAccessToken(data.access_token)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
        setUser(data.user)
      })
      .catch(() => {
        clearTokens()
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiLogin({ username, password })
    setAccessToken(data.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
    setUser(data.user)
  }, [])

  const register = useCallback(
    async (regData: {
      username: string
      password: string
      display_name: string
      base_currency: string
      invite_code: string
    }) => {
      const data = await apiRegister(regData)
      setAccessToken(data.access_token)
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
      setUser(data.user)
    },
    [],
  )

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  )

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
