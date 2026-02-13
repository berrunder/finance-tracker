import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { categorySchema, type CategoryFormData } from '@/lib/validators'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/hooks/use-categories'
import { handleMutationError, getSubmitLabel } from '@/lib/form-helpers'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORY_TYPES } from '@/lib/constants'
import type { Category } from '@/types/api'

interface CategoryFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  defaultType?: 'income' | 'expense'
}

export function CategoryForm({
  open,
  onOpenChange,
  category,
  defaultType = 'expense',
}: CategoryFormProps) {
  const isEdit = !!category
  const { data: categories = [] } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: defaultType,
      parent_id: null,
    },
    mode: 'onBlur',
  })

  const currentType = watch('type')

  // Root categories of the same type (for parent dropdown)
  const parentOptions = categories.filter(
    (c) =>
      c.type === currentType && c.parent_id === null && c.id !== category?.id,
  )

  useEffect(() => {
    if (open) {
      if (category) {
        reset({
          name: category.name,
          type: category.type as CategoryFormData['type'],
          parent_id: category.parent_id,
        })
      } else {
        reset({
          name: '',
          type: defaultType,
          parent_id: null,
        })
      }
    }
  }, [open, category, defaultType, reset])

  const onSubmit = async (data: CategoryFormData) => {
    try {
      if (isEdit) {
        await updateCategory.mutateAsync({
          id: category!.id,
          data: {
            name: data.name,
            parent_id: data.parent_id || null,
          },
        })
        toast.success('Category updated')
      } else {
        await createCategory.mutateAsync({
          name: data.name,
          type: data.type,
          parent_id: data.parent_id || null,
        })
        toast.success('Category created')
      }
      onOpenChange(false)
    } catch (error) {
      handleMutationError(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" {...register('name')} />
            {errors.name && (
              <p className="text-destructive text-sm">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={watch('type')}
              onValueChange={(v) =>
                setValue('type', v as CategoryFormData['type'], {
                  shouldValidate: true,
                })
              }
              disabled={isEdit}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-destructive text-sm">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Parent Category</Label>
            <Select
              value={watch('parent_id') ?? 'none'}
              onValueChange={(v) =>
                setValue('parent_id', v === 'none' ? null : v, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None (root category)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (root category)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {getSubmitLabel(isEdit, isSubmitting)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
