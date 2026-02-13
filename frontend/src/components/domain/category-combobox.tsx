import { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useCategories } from '@/hooks/use-categories'
import type { Category } from '@/types/api'

interface CategoryComboboxProps {
  value: string | null | undefined
  onValueChange: (value: string) => void
  type?: 'income' | 'expense'
  allowClear?: boolean
  placeholder?: string
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

export function CategoryCombobox({
  value,
  onValueChange,
  type,
  allowClear = false,
  placeholder = 'Select category',
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const { data: categories = [] } = useCategories()

  const flat = flattenCategories(categories)
  const filtered = type ? flat.filter((c) => c.type === type) : flat
  const selected = flat.find((c) => c.id === value)

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            {selected?.label ?? placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No categories found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((cat) => (
                  <CommandItem
                    key={cat.id}
                    value={cat.label}
                    onSelect={() => {
                      onValueChange(cat.id === value ? '' : cat.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === cat.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {cat.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {allowClear && value && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onValueChange('')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
