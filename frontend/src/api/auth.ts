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

export function refreshToken(): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/refresh', {
    method: 'POST',
    skipAuth: true,
  })
}

export function logout(): Promise<void> {
  return apiClient<void>('/auth/logout', {
    method: 'POST',
    skipAuth: true,
  })
}
