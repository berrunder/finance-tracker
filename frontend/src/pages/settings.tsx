import { useState } from 'react'
import { toast } from 'sonner'
import { useCategories, useDeleteCategory } from '@/hooks/use-categories'
import { ApiError } from '@/api/client'
import { mapApiErrorToFieldError } from '@/lib/error-mapping'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoryList } from '@/components/domain/category-list'
import { CategoryForm } from '@/components/domain/category-form'
import { ConfirmDialog } from '@/components/domain/confirm-dialog'
import type { Category } from '@/types/api'

export default function SettingsPage() {
  const { data: categories = [], isLoading } = useCategories()
  const deleteCategory = useDeleteCategory()

  const [formOpen, setFormOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [addType, setAddType] = useState<'income' | 'expense'>('expense')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  function handleAdd(type: 'income' | 'expense') {
    setAddType(type)
    setEditCategory(null)
    setFormOpen(true)
  }

  function handleEdit(category: Category) {
    setEditCategory(category)
    setAddType(category.type as 'income' | 'expense')
    setFormOpen(true)
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setEditCategory(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteCategory.mutateAsync(deleteTarget.id)
      toast.success('Category deleted')
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldError = mapApiErrorToFieldError(error)
        toast.error(fieldError?.message ?? error.message)
      } else {
        toast.error('Failed to delete category')
      }
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          {isLoading ? (
            <div className="text-muted-foreground py-8 text-center">
              Loading...
            </div>
          ) : (
            <CategoryList
              categories={categories}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <p className="text-muted-foreground">Profile settings coming soon.</p>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <p className="text-muted-foreground">
            Appearance settings coming soon.
          </p>
        </TabsContent>
      </Tabs>

      <CategoryForm
        open={formOpen}
        onOpenChange={handleFormClose}
        category={editCategory}
        defaultType={addType}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Category"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        variant="simple"
        onConfirm={handleDelete}
        loading={deleteCategory.isPending}
      />
    </div>
  )
}
