import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from '@/api/categories'
import { isNetworkError } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'
import { putCategories, getAllOfflineCategories } from '@/lib/db'
import type { UpdateCategoryRequest } from '@/types/api'

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      try {
        const data = await getCategories()
        await putCategories(data.data)
        return data
      } catch (error) {
        if (isNetworkError(error)) {
          const cached = await getAllOfflineCategories()
          return { data: cached }
        }
        throw error
      }
    },
    select: (data) => data.data,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}
