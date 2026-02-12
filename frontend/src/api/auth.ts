import { apiClient } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/types/api'

export function login(data: LoginRequest): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
  })
}

export function register(data: RegisterRequest): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
  })
}

export function refreshToken(token: string): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: token }),
    skipAuth: true,
  })
}
