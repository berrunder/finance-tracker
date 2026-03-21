import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useCategories, useDeleteCategory } from '@/hooks/use-categories'
import { useCurrencies } from '@/hooks/use-currencies'
import { ApiError } from '@/api/client'
import { mapApiErrorToFieldError } from '@/lib/error-mapping'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoryList } from '@/components/domain/category-list'
import { CategoryForm } from '@/components/domain/category-form'
import { CurrencyList } from '@/components/domain/currency-list'
import { CurrencyForm } from '@/components/domain/currency-form'
import { ConfirmDialog } from '@/components/domain/confirm-dialog'
import { ProfileForm } from '@/components/domain/profile-form'
import { AppearanceSettings } from '@/components/domain/appearance-settings'
import { ExportTab } from '@/components/domain/export-tab'
import { DataTab } from '@/components/domain/data-tab'
import type { Category, Currency } from '@/types/api'

export default function SettingsPage() {
  const { tab = 'categories' } = useParams<{ tab: string }>()
  const navigate = useNavigate()

  const { data: categories = [], isLoading } = useCategories()
  const deleteCategory = useDeleteCategory()
  const { data: currencies = [], isLoading: currenciesLoading } =
    useCurrencies()

  const [formOpen, setFormOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [addType, setAddType] = useState<'income' | 'expense'>('expense')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const [currencyFormOpen, setCurrencyFormOpen] = useState(false)
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null)

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

      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate(`/settings/${value}`, { replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          {isLoading ? (
            <div className="space-y-6">
              {[1, 2].map((section) => (
                <div key={section} className="space-y-3">
                  <Skeleton className="h-5 w-36" />
                  <div className="space-y-2 pl-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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

        <TabsContent value="currencies" className="mt-4">
          {currenciesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <CurrencyList
              currencies={currencies}
              onAdd={() => {
                setEditCurrency(null)
                setCurrencyFormOpen(true)
              }}
              onEdit={(currency) => {
                setEditCurrency(currency)
                setCurrencyFormOpen(true)
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <ExportTab />
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <DataTab />
        </TabsContent>
      </Tabs>

      <CategoryForm
        open={formOpen}
        onOpenChange={handleFormClose}
        category={editCategory}
        defaultType={addType}
      />

      <CurrencyForm
        open={currencyFormOpen}
        onOpenChange={(open) => {
          setCurrencyFormOpen(open)
          if (!open) setEditCurrency(null)
        }}
        currency={editCurrency}
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
