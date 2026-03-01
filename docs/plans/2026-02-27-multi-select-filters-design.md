# Multi-Select Transaction Filters

## Goal

Update transaction filters to allow selecting multiple accounts and multiple categories simultaneously.

## Changes

### Backend

1. **SQL queries** (`queries/transactions.sql`): Change `ListTransactions` and its count query to use `= ANY(sqlc.narg('account_ids')::UUID[])` pattern instead of single `= sqlc.narg('account_id')`.
2. **Handler** (`internal/handler/transaction.go`): Parse repeated `account_id` and `category_id` query params into `[]uuid.UUID` slices.
3. Regenerate sqlc code.
4. Update API docs.

### Frontend

1. **New UI component** `components/ui/multi-combobox.tsx`: Generic multi-select combobox (Popover + cmdk Command) with search, checkmarks, stays open on selection.
2. **New domain component** `components/domain/account-multi-combobox.tsx`: Wraps MultiCombobox with account data. Used only in filters.
3. **New domain component** `components/domain/category-multi-combobox.tsx`: Wraps MultiCombobox with category data (flattened tree with "Parent > Child" labels). Used only in filters.
4. **Filter component** `components/domain/transaction-filters.tsx`: Replace single-select account Select and CategoryCombobox with multi-select variants.
5. **Filter types/state** `pages/transactions.tsx`: Update `Filters` type — `account_id` becomes `account_ids: string[]`, `category_id` becomes `category_ids: string[]`. Update URL param serialization (comma-separated values).
6. **Query string** `lib/query-string.ts`: Handle array values — serialize as repeated params (`account_id=a&account_id=b`).

### UX

- Trigger shows "All accounts" / "All categories" when empty
- Shows the name when 1 selected, "N accounts" / "N categories" when multiple
- Popover stays open during multi-selection
- Checkbox indicator on each item
- Search within dropdown
- Clear button to reset
