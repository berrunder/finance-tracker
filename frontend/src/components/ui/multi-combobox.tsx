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

interface MultiComboboxOption {
  value: string
  label: string
}

interface MultiComboboxProps {
  options: MultiComboboxOption[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
}

export function MultiCombobox({
  options,
  selected,
  onSelectedChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false)

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)

  const displayText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} selected`

  function toggle(value: string) {
    onSelectedChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            selected.length === 0 && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{displayText}</span>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            {selected.length > 0 && (
              <span
                className="opacity-50 hover:opacity-100"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onSelectedChange([])
                }}
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value)
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
