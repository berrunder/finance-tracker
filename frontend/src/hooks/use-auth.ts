import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { UpdateUserRequest, User } from '@/types/api'
import {
  login as apiLogin,
  logout as apiLogout,
  refreshToken,
  register as apiRegister,
} from '@/api/auth'
import { updateUser as apiUpdateUser } from '@/api/user'
import {
  clearTokens,
  setAccessToken,
  setOnAuthFailure,
  setOnQueryCancellation,
} from '@/api/client'
import { clearAllOfflineData } from '@/lib/db'

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
  updateUser: (data: UpdateUserRequest) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Always start in loading state: the refresh cookie is HttpOnly so we can't
  // check existence from JS — we just attempt a refresh and see.
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  // Register auth failure callback so the API client can clear state via React
  // instead of using window.location.href (which causes a full page reload)
  useEffect(() => {
    setOnAuthFailure(() => {
      setUser(null)
    })
    setOnQueryCancellation(() => {
      queryClient.cancelQueries()
    })
    return () => {
      setOnAuthFailure(null)
      setOnQueryCancellation(null)
    }
  }, [queryClient])

  // Startup: try to refresh via the HttpOnly cookie. If it fails we stay
  // logged out and the user sees the login screen.
  useEffect(() => {
    refreshToken()
      .then((data) => {
        setAccessToken(data.access_token)
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
      setUser(data.user)
    },
    [],
  )

  const updateUser = useCallback(async (data: UpdateUserRequest) => {
    const updatedUser = await apiUpdateUser(data)
    setUser(updatedUser)
  }, [])

  const logout = useCallback(() => {
    apiLogout().catch(() => {})
    clearTokens()
    clearAllOfflineData().catch(() => {})
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
      updateUser,
    }),
    [user, isLoading, login, register, logout, updateUser],
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
