import { apiClient } from './client'
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@/types/api'

interface CategoriesResponse {
  data: Category[]
}

export function getCategories(): Promise<CategoriesResponse> {
  return apiClient<CategoriesResponse>('/categories')
}

export function createCategory(data: CreateCategoryRequest): Promise<Category> {
  return apiClient<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateCategory(
  id: string,
  data: UpdateCategoryRequest,
): Promise<Category> {
  return apiClient<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteCategory(id: string): Promise<void> {
  return apiClient<void>(`/categories/${id}`, { method: 'DELETE' })
}
