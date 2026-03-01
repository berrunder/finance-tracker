# Multi-Select Transaction Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow selecting multiple accounts and categories in transaction filters.

**Architecture:** Update the backend SQL queries to accept UUID arrays instead of single UUIDs. Update the handler to parse repeated query params. On the frontend, create a reusable multi-select combobox component, then build account and category multi-select domain components for the filter bar.

**Tech Stack:** Go (sqlc, pgx/v5), React, TypeScript, shadcn/ui (Popover + cmdk Command), Tailwind CSS v4.

---

### Task 1: Update SQL queries for array filters

**Files:**
- Modify: `backend/queries/transactions.sql` (lines 9-27)

**Step 1: Update ListTransactions and CountTransactions queries**

Replace the single-value filter patterns with array-based patterns:

```sql
-- name: ListTransactions :many
SELECT * FROM transactions
WHERE user_id = @user_id
    AND (cardinality(@account_ids::UUID[]) = 0 OR account_id = ANY(@account_ids))
    AND (cardinality(@category_ids::UUID[]) = 0 OR category_id = ANY(@category_ids))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR date <= sqlc.narg('date_to'))
ORDER BY date DESC, created_at DESC
LIMIT @lim OFFSET @off;

-- name: CountTransactions :one
SELECT COUNT(*) FROM transactions
WHERE user_id = @user_id
    AND (cardinality(@account_ids::UUID[]) = 0 OR account_id = ANY(@account_ids))
    AND (cardinality(@category_ids::UUID[]) = 0 OR category_id = ANY(@category_ids))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR date <= sqlc.narg('date_to'));
```

**Step 2: Regenerate sqlc**

Run: `make sqlc`
Expected: New `ListTransactionsParams` and `CountTransactionsParams` structs with `AccountIds []uuid.UUID` and `CategoryIds []uuid.UUID` fields.

**Step 3: Commit**

```
feat(backend): update transaction queries to accept array filters
```

---

### Task 2: Update backend service and handler for array params

**Files:**
- Modify: `backend/internal/service/transaction.go` (lines 432-440, 148-201)
- Modify: `backend/internal/handler/transaction.go` (lines 29-48)

**Step 1: Update ListTransactionsParams struct** (service/transaction.go:432-440)

```go
type ListTransactionsParams struct {
	AccountIDs  []uuid.UUID
	CategoryIDs []uuid.UUID
	Type        string
	DateFrom    string
	DateTo      string
	Page        int
	PerPage     int
}
```

**Step 2: Update service List method** (service/transaction.go:148-188)

Replace the single UUID conversion with slices:

```go
// Replace lines 148-155 (accountID/categoryID conversions) with:
accountIDs := params.AccountIDs
if accountIDs == nil {
    accountIDs = []uuid.UUID{}
}
categoryIDs := params.CategoryIDs
if categoryIDs == nil {
    categoryIDs = []uuid.UUID{}
}
```

Update `storeParams` (lines 179-188):
```go
storeParams := store.ListTransactionsParams{
    UserID:      userID,
    AccountIds:  accountIDs,
    CategoryIds: categoryIDs,
    Type:        txnType,
    DateFrom:    dateFrom,
    DateTo:      dateTo,
    Off:         offset,
    Lim:         int32(params.PerPage),
}
```

Update `CountTransactionsParams` similarly (lines 195-202):
```go
total, err := s.queries.CountTransactions(ctx, store.CountTransactionsParams{
    UserID:      userID,
    AccountIds:  accountIDs,
    CategoryIds: categoryIDs,
    Type:        txnType,
    DateFrom:    dateFrom,
    DateTo:      dateTo,
})
```

**Step 3: Update handler List** (handler/transaction.go:29-48)

Replace single `q.Get("account_id")` with repeated param parsing:

```go
params := service.ListTransactionsParams{
    Type:     q.Get("type"),
    DateFrom: q.Get("date_from"),
    DateTo:   q.Get("date_to"),
    Page:     1,
    PerPage:  20,
}

for _, v := range q["account_id"] {
    id, err := uuid.Parse(v)
    if err == nil {
        params.AccountIDs = append(params.AccountIDs, id)
    }
}
for _, v := range q["category_id"] {
    id, err := uuid.Parse(v)
    if err == nil {
        params.CategoryIDs = append(params.CategoryIDs, id)
    }
}
```

**Step 4: Build and test**

Run: `cd backend && go build ./... && go test ./...`

**Step 5: Update API docs**

Modify: `backend/docs/API.md` — update the `GET /transactions` params table:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `account_id` | uuid | — | Filter by account(s). Repeat for multiple: `?account_id=x&account_id=y` |
| `category_id` | uuid | — | Filter by category(ies). Repeat for multiple: `?category_id=x&category_id=y` |

**Step 6: Commit**

```
feat(backend): support multiple account/category IDs in transaction list
```

---

### Task 3: Update service test for array params

**Files:**
- Modify: `backend/internal/service/transaction_test.go`

**Step 1: Check existing tests and update**

Update any `ListTransactionsParams` usage in tests to use the new `AccountIDs`/`CategoryIDs` slice fields instead of `AccountID`/`CategoryID` pointers.

**Step 2: Run tests**

Run: `cd backend && go test ./...`
Expected: All pass.

**Step 3: Commit** (if changes needed)

```
test(backend): update transaction list tests for array filter params
```

---

### Task 4: Update frontend query string builder for arrays

**Files:**
- Modify: `frontend/src/lib/query-string.ts`
- Test: `frontend/src/lib/__tests__/query-string.test.ts` (create if needed)

**Step 1: Update buildQueryString to handle arrays**

```ts
export function buildQueryString<T extends object>(args: T): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== '') {
          params.append(key, String(item))
        }
      }
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
```

**Step 2: Verify types and build**

Run: `cd frontend && npm run check:types`

**Step 3: Commit**

```
feat(frontend): support array values in query string builder
```

---

### Task 5: Update frontend filter types and URL param handling

**Files:**
- Modify: `frontend/src/api/transactions.ts` (lines 12-20)
- Modify: `frontend/src/pages/transactions.tsx` (lines 52-71)

**Step 1: Update TransactionFilters type** (api/transactions.ts)

```ts
export interface TransactionFilters {
  account_id?: string[]
  category_id?: string[]
  type?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
}
```

**Step 2: Update URL param sync in TransactionsPage** (pages/transactions.tsx)

Update `filters` useMemo (lines 52-61):
```ts
const filters: Filters = useMemo(
  () => ({
    account_id: searchParams.getAll('account_id').length > 0
      ? searchParams.getAll('account_id')
      : undefined,
    category_id: searchParams.getAll('category_id').length > 0
      ? searchParams.getAll('category_id')
      : undefined,
    type: searchParams.get('type') ?? undefined,
    date_from: searchParams.get('date_from') ?? defaultDateFrom,
    date_to: searchParams.get('date_to') ?? defaultDateTo,
  }),
  [defaultDateFrom, defaultDateTo, searchParams],
)
```

Update `handleFiltersChange` (lines 63-71):
```ts
const handleFiltersChange = useCallback(
  (newFilters: Filters) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(newFilters)) {
      if (value === undefined || value === '') continue
      if (Array.isArray(value)) {
        for (const item of value) {
          params.append(key, item)
        }
      } else {
        params.set(key, value as string)
      }
    }
    setSearchParams(params, { replace: true })
  },
  [setSearchParams],
)
```

**Step 3: Verify types**

Run: `cd frontend && npm run check:types`

**Step 4: Commit**

```
feat(frontend): update filter types to support multiple account/category IDs
```

---

### Task 6: Create multi-combobox UI component

**Files:**
- Create: `frontend/src/components/ui/multi-combobox.tsx`

**Step 1: Create the component**

A generic multi-select combobox using Popover + cmdk Command (same primitives as existing comboboxes). Props:

```ts
interface MultiComboboxOption {
  value: string
  label: string
}

interface MultiComboboxProps {
  options: MultiComboboxOption[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
  placeholder?: string       // shown when nothing selected, e.g. "All accounts"
  searchPlaceholder?: string // shown in search input
  emptyMessage?: string      // shown when no options match search
}
```

Behavior:
- Trigger button shows: placeholder when empty, option label when 1 selected, "N selected" when multiple.
- Popover stays open when toggling items (no `setOpen(false)` on select).
- Each item shows a `Check` icon when selected.
- Clear button (X) appears on trigger when items are selected.

```tsx
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
    <div className="flex gap-1">
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
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
      {selected.length > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onSelectedChange([])}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
```

**Step 2: Verify types**

Run: `cd frontend && npm run check:types`

**Step 3: Commit**

```
feat(frontend): add multi-combobox UI component
```

---

### Task 7: Create account and category multi-select domain components

**Files:**
- Create: `frontend/src/components/domain/account-multi-combobox.tsx`
- Create: `frontend/src/components/domain/category-multi-combobox.tsx`

**Step 1: Create AccountMultiCombobox**

```tsx
import { useAccounts } from '@/hooks/use-accounts'
import { MultiCombobox } from '@/components/ui/multi-combobox'

interface AccountMultiComboboxProps {
  selected: string[]
  onSelectedChange: (selected: string[]) => void
}

export function AccountMultiCombobox({
  selected,
  onSelectedChange,
}: AccountMultiComboboxProps) {
  const { data: accounts = [] } = useAccounts()

  const options = accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }))

  return (
    <MultiCombobox
      options={options}
      selected={selected}
      onSelectedChange={onSelectedChange}
      placeholder="All accounts"
      searchPlaceholder="Search accounts..."
      emptyMessage="No accounts found."
    />
  )
}
```

**Step 2: Create CategoryMultiCombobox**

```tsx
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
```

**Step 3: Verify types**

Run: `cd frontend && npm run check:types`

**Step 4: Commit**

```
feat(frontend): add account and category multi-select comboboxes
```

---

### Task 8: Wire multi-select comboboxes into transaction filters

**Files:**
- Modify: `frontend/src/components/domain/transaction-filters.tsx`

**Step 1: Replace single-select with multi-select components**

Update imports — remove `Select` imports, `CategoryCombobox` import, `useAccounts` hook. Add `AccountMultiCombobox` and `CategoryMultiCombobox` imports.

Update `hasFilters` check:
```ts
const hasFilters =
  (filters.account_id && filters.account_id.length > 0) ||
  (filters.category_id && filters.category_id.length > 0) ||
  filters.type ||
  filters.date_from ||
  filters.date_to
```

Replace the account Select (lines 69-88) with:
```tsx
<div className="w-full md:w-44">
  <AccountMultiCombobox
    selected={filters.account_id ?? []}
    onSelectedChange={(v) =>
      update({ account_id: v.length > 0 ? v : undefined })
    }
  />
</div>
```

Replace the CategoryCombobox (lines 90-98) with:
```tsx
<div className="w-full md:w-52">
  <CategoryMultiCombobox
    selected={filters.category_id ?? []}
    onSelectedChange={(v) =>
      update({ category_id: v.length > 0 ? v : undefined })
    }
    type={categoryFilterType}
  />
</div>
```

**Step 2: Verify types and build**

Run: `cd frontend && npm run check:types && npm run build`

**Step 3: Commit**

```
feat(frontend): use multi-select comboboxes in transaction filters
```

---

### Task 9: Final verification and lint

**Step 1: Run all checks**

Run:
```sh
cd backend && go build ./... && go test ./...
cd ../frontend && npm run check:types && npm run lint && npm run build && npm test
```

**Step 2: Manual smoke test**

Run: `make dev-backend` and `make dev-frontend`

Verify:
- Transaction filters show multi-select comboboxes for accounts and categories
- Selecting multiple accounts filters correctly
- Selecting multiple categories filters correctly
- URL params update correctly (repeated params)
- Clearing filters works
- Search within dropdowns works
- "N selected" display when multiple items chosen

**Step 3: Commit any fixes if needed**
