# CSV Export Feature Design

## Overview

Export transactions for a selected date range as a CSV file, in the same format that the full import accepts. Available as a new "Export" tab on the Settings page.

## Backend

### New SQL Query (`queries/export.sql`)

Dedicated query joining transactions with accounts and categories to resolve names. No pagination — returns all matching rows for the date range.

```sql
-- name: ExportTransactions :many
SELECT t.date, a.name AS account, c.name AS category, pc.name AS parent_category,
       t.type, t.amount, a.currency, t.description, t.transfer_id,
       ta.name AS transfer_account
FROM transactions t
JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
LEFT JOIN transactions t2 ON t.transfer_id = t2.transfer_id AND t2.id != t.id AND t.transfer_id IS NOT NULL
LEFT JOIN accounts ta ON t2.account_id = ta.id
WHERE t.user_id = @user_id AND t.date >= @date_from AND t.date <= @date_to
ORDER BY t.date, t.created_at;
```

### Service (`service/export.go`)

Converts query rows to CSV matching `FullImportRow` columns:

| Column | Source |
|--------|--------|
| Date | `dd.MM.yyyy` format |
| Account | account name |
| Category | `Parent\Child` or `Parent` or empty |
| Total | signed decimal (negative=expense, positive=income) |
| Currency | account currency code |
| Description | transaction description |
| Transfer | target account name (empty for non-transfers) |

Returns `[]byte` (CSV with header row).

### Handler (`handler/export.go`)

- Parses `date_from` and `date_to` query params (required, `yyyy-MM-dd` format)
- Calls service, returns CSV with `Content-Type: text/csv` and `Content-Disposition: attachment`

### Route

`GET /api/v1/export/csv?date_from=2026-01-01&date_to=2026-02-28`

## Frontend

### Settings Page — New "Export" Tab

Added to existing Tabs component in `pages/settings.tsx`:
- Two date inputs: Start Date, End Date (default to current month)
- "Export CSV" button
- On click: fetch endpoint, trigger browser file download

### API (`api/export.ts`)

Fetches the CSV endpoint and returns a Blob for download.

## Excluded

- No streaming (CSV built in memory — fine for personal finance scale)
- No format customization (fixed date format, decimal separator)
- No progress indicator
