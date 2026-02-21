import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/api'

interface CategoryListProps {
  categories: Category[]
  onAdd: (type: 'income' | 'expense') => void
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}

function CategoryActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function CategoryRow({
  category,
  indent = false,
  onEdit,
  onDelete,
}: {
  category: Category
  indent?: boolean
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-accent',
        indent && 'ml-9 border-l-2 border-muted pl-3',
      )}
    >
      <span className={cn('text-sm', indent && 'text-muted-foreground')}>
        {category.name}
      </span>
      <CategoryActions
        onEdit={() => onEdit(category)}
        onDelete={() => onDelete(category)}
      />
    </div>
  )
}

function CategoryGroup({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = (category.children?.length ?? 0) > 0

  return (
    <div>
      <div className="group flex items-center gap-1">
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : (
          <div className="w-7 shrink-0" />
        )}
        <div className="flex flex-1 items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
          <span className="text-sm font-medium">{category.name}</span>
          <CategoryActions
            onEdit={() => onEdit(category)}
            onDelete={() => onDelete(category)}
          />
        </div>
      </div>
      {expanded &&
        category.children?.map((child) => (
          <CategoryRow
            key={child.id}
            category={child}
            indent
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </div>
  )
}

function CategorySection({
  title,
  type,
  categories,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string
  type: 'income' | 'expense'
  categories: Category[]
  onAdd: (type: 'income' | 'expense') => void
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}) {
  const filtered = categories.filter((c) => c.type === type)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="ghost" size="sm" onClick={() => onAdd(type)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">
          No {type} categories
        </p>
      ) : (
        <div className="space-y-0.5">
          {filtered.map((cat) => (
            <CategoryGroup
              key={cat.id}
              category={cat}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CategoryList({
  categories,
  onAdd,
  onEdit,
  onDelete,
}: CategoryListProps) {
  return (
    <div className="space-y-6">
      <CategorySection
        title="Expense Categories"
        type="expense"
        categories={categories}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <CategorySection
        title="Income Categories"
        type="income"
        categories={categories}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}
