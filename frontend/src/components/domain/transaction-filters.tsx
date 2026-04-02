import { useEffect, useRef, useState } from 'react'
import { X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AccountMultiCombobox } from '@/components/domain/account-multi-combobox'
import { CategoryMultiCombobox } from '@/components/domain/category-multi-combobox'
import { DatePicker } from '@/components/domain/date-picker'
import type { TransactionFilters as Filters } from '@/api/transactions'

interface TransactionFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

const DEBOUNCE_MS = 200

export function TransactionFilters({
  filters,
  onFiltersChange,
}: TransactionFiltersProps) {
  const dateTimers = useRef<Record<string, number>>({})
  const [descState, setDescState] = useState({
    synced: filters.description,
    value: filters.description ?? '',
  })
  if (descState.synced !== filters.description) {
    setDescState({
      synced: filters.description,
      value: filters.description ?? '',
    })
  }

  const categoryFilterType =
    filters.type === 'income' || filters.type === 'expense'
      ? filters.type
      : undefined

  const hasFilters =
    (filters.account_id && filters.account_id.length > 0) ||
    (filters.category_id && filters.category_id.length > 0) ||
    filters.type ||
    filters.date_from ||
    filters.date_to ||
    filters.description

  function update(patch: Partial<Filters>) {
    onFiltersChange({ ...filters, ...patch })
  }

  function clearAll() {
    onFiltersChange({})
  }

  useEffect(() => {
    const timers = dateTimers.current

    return () => {
      for (const timer of Object.values(timers)) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  function debouncedUpdate(key: keyof Filters, value: string | undefined) {
    if (dateTimers.current[key] !== undefined) {
      window.clearTimeout(dateTimers.current[key])
    }
    dateTimers.current[key] = window.setTimeout(() => {
      update({ [key]: value })
    }, DEBOUNCE_MS)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search description..."
            value={descState.value}
            onChange={(e) => {
              setDescState({ synced: descState.synced, value: e.target.value })
              debouncedUpdate('description', e.target.value || undefined)
            }}
            className="pl-8"
          />
        </div>

        <AccountMultiCombobox
          selected={filters.account_id ?? []}
          onSelectedChange={(v) =>
            update({ account_id: v.length > 0 ? v : undefined })
          }
        />

        <CategoryMultiCombobox
          selected={filters.category_id ?? []}
          onSelectedChange={(v) =>
            update({ category_id: v.length > 0 ? v : undefined })
          }
          type={categoryFilterType}
        />

        <Select
          value={filters.type ?? 'all'}
          onValueChange={(v) => update({ type: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>

        <DatePicker
          value={filters.date_from}
          onChange={(v) => debouncedUpdate('date_from', v)}
          placeholder="From date"
          maxDate={filters.date_to}
        />

        <DatePicker
          value={filters.date_to}
          onChange={(v) => debouncedUpdate('date_to', v)}
          placeholder="To date"
          minDate={filters.date_from}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
