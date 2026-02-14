import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useAccounts } from '@/hooks/use-accounts'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CategoryCombobox } from '@/components/domain/category-combobox'
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
  const { data: accounts = [] } = useAccounts()
  const dateTimers = useRef<Record<string, number>>({})

  const categoryFilterType =
    filters.type === 'income' || filters.type === 'expense'
      ? filters.type
      : undefined

  const hasFilters =
    filters.account_id ||
    filters.category_id ||
    filters.type ||
    filters.date_from ||
    filters.date_to

  function update(patch: Partial<Filters>) {
    onFiltersChange({ ...filters, ...patch })
  }

  function clearAll() {
    onFiltersChange({})
  }

  useEffect(() => {
    return () => {
      for (const timer of Object.values(dateTimers.current)) {
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
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <Select
          value={filters.account_id ?? 'all'}
          onValueChange={(v) =>
            update({ account_id: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-52">
        <CategoryCombobox
          value={filters.category_id ?? null}
          onValueChange={(v) => update({ category_id: v || undefined })}
          type={categoryFilterType}
          allowClear
          placeholder="All categories"
        />
      </div>

      <div className="w-32">
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
      </div>

      <div className="w-44">
        <DatePicker
          value={filters.date_from}
          onChange={(v) => debouncedUpdate('date_from', v)}
          placeholder="From date"
        />
      </div>

      <div className="w-44">
        <DatePicker
          value={filters.date_to}
          onChange={(v) => debouncedUpdate('date_to', v)}
          placeholder="To date"
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
