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

const DEBOUNCE_TIMEOUT = 200

export function TransactionFilters({
  filters,
  onFiltersChange,
}: TransactionFiltersProps) {
  const { data: accounts = [] } = useAccounts()
  const dateFromTimer = useRef<number | null>(null)
  const dateToTimer = useRef<number | null>(null)

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
      if (dateFromTimer.current !== null) {
        window.clearTimeout(dateFromTimer.current)
      }
      if (dateToTimer.current !== null) {
        window.clearTimeout(dateToTimer.current)
      }
    }
  }, [])

  function handleDateFromChange(value: string | undefined) {
    if (dateFromTimer.current !== null) {
      window.clearTimeout(dateFromTimer.current)
    }
    dateFromTimer.current = window.setTimeout(() => {
      update({ date_from: value })
    }, DEBOUNCE_TIMEOUT)
  }

  function handleDateToChange(value: string | undefined) {
    if (dateToTimer.current !== null) {
      window.clearTimeout(dateToTimer.current)
    }
    dateToTimer.current = window.setTimeout(() => {
      update({ date_to: value })
    }, DEBOUNCE_TIMEOUT)
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
          type={
            filters.type === 'income' || filters.type === 'expense'
              ? filters.type
              : undefined
          }
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
          onChange={handleDateFromChange}
          placeholder="From date"
        />
      </div>

      <div className="w-44">
        <DatePicker
          value={filters.date_to}
          onChange={handleDateToChange}
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
