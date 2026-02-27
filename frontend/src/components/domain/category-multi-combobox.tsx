import { useCategories } from '@/hooks/use-categories'
import { MultiCombobox } from '@/components/ui/multi-combobox'
import type { Category } from '@/types/api'

interface CategoryMultiComboboxProps {
  selected: string[]
  onSelectedChange: (selected: string[]) => void
  type?: 'income' | 'expense'
}

interface FlatCategory {
  id: string
  label: string
  type: string
}

function flattenCategories(categories: Category[]): FlatCategory[] {
  const flat: FlatCategory[] = []
  for (const cat of categories) {
    flat.push({ id: cat.id, label: cat.name, type: cat.type })
    if (cat.children) {
      for (const child of cat.children) {
        flat.push({
          id: child.id,
          label: `${cat.name} > ${child.name}`,
          type: child.type,
        })
      }
    }
  }
  return flat
}

export function CategoryMultiCombobox({
  selected,
  onSelectedChange,
  type,
}: CategoryMultiComboboxProps) {
  const { data: categories = [] } = useCategories()

  const flat = flattenCategories(categories)
  const filtered = type ? flat.filter((c) => c.type === type) : flat

  const options = filtered.map((c) => ({
    value: c.id,
    label: c.label,
  }))

  return (
    <MultiCombobox
      options={options}
      selected={selected}
      onSelectedChange={onSelectedChange}
      placeholder="All categories"
      searchPlaceholder="Search categories..."
      emptyMessage="No categories found."
    />
  )
}
