# CSV Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Export transactions for a date range as a CSV file matching the full import format.

**Architecture:** New SQL query joins transactions with accounts/categories to get names. Service converts rows to CSV bytes. Handler streams CSV as file download. Frontend adds "Export" tab on Settings page with date pickers and download button.

**Tech Stack:** Go (encoding/csv, chi), PostgreSQL (sqlc), React, shadcn/ui, date-fns

---

### Task 1: SQL Query for Export

**Files:**
- Create: `backend/queries/export.sql`

**Step 1: Write the SQL query**

Create `backend/queries/export.sql`:

```sql
-- name: ExportTransactions :many
SELECT
    t.date,
    a.name AS account_name,
    COALESCE(pc.name, '') AS parent_category_name,
    COALESCE(c.name, '') AS category_name,
    t.type,
    t.amount,
    a.currency,
    t.description,
    t.transfer_id,
    COALESCE(ta.name, '') AS transfer_account_name
FROM transactions t
JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
LEFT JOIN transactions t2
    ON t.transfer_id = t2.transfer_id
    AND t2.id != t.id
    AND t.transfer_id IS NOT NULL
LEFT JOIN accounts ta ON t2.account_id = ta.id
WHERE t.user_id = @user_id
    AND t.date >= @date_from
    AND t.date <= @date_to
ORDER BY t.date, t.created_at;
```

**Step 2: Generate sqlc code**

Run: `make sqlc` (from repo root)
Expected: Success, new types in `backend/internal/store/export.sql.go`

**Step 3: Verify build**

Run: `cd backend && go build ./...`
Expected: PASS

**Step 4: Commit**

```
feat: add SQL query for transaction export
```

---

### Task 2: Export Service

**Files:**
- Create: `backend/internal/service/export.go`

**Step 1: Write the service**

Create `backend/internal/service/export.go`:

```go
package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"

	"github.com/google/uuid"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type exportStore interface {
	ExportTransactions(ctx context.Context, arg store.ExportTransactionsParams) ([]store.ExportTransactionsRow, error)
}

type Export struct {
	queries exportStore
}

func NewExport(queries *store.Queries) *Export {
	return &Export{queries: queries}
}

func (s *Export) ExportCSV(ctx context.Context, userID uuid.UUID, dateFrom, dateTo string) ([]byte, error) {
	df, err := dateFromString(dateFrom)
	if err != nil {
		return nil, fmt.Errorf("invalid date_from: %w", err)
	}
	dt, err := dateFromString(dateTo)
	if err != nil {
		return nil, fmt.Errorf("invalid date_to: %w", err)
	}

	rows, err := s.queries.ExportTransactions(ctx, store.ExportTransactionsParams{
		UserID:   userID,
		DateFrom: df,
		DateTo:   dt,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)

	// Header matching FullImportRow fields
	if err := w.Write([]string{"date", "account", "category", "total", "currency", "description", "transfer"}); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}

	for _, row := range rows {
		// Build category string: "Parent\Child" or just "Parent" or empty
		category := ""
		if row.CategoryName != "" {
			if row.ParentCategoryName != "" {
				category = row.ParentCategoryName + `\` + row.CategoryName
			} else {
				category = row.CategoryName
			}
		}

		// Signed amount: negative for expense, positive for income
		amount := numericToString(row.Amount)
		if row.Type == "expense" {
			amount = "-" + amount
		}

		// Date in dd.MM.yyyy format
		date := row.Date.Time.Format("02.01.2006")

		if err := w.Write([]string{
			date,
			row.AccountName,
			category,
			amount,
			row.Currency,
			row.Description,
			row.TransferAccountName,
		}); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, fmt.Errorf("CSV write error: %w", err)
	}

	return buf.Bytes(), nil
}
```

**Note:** The exact field names on `store.ExportTransactionsRow` depend on sqlc output from Task 1. After running `make sqlc`, check `backend/internal/store/export.sql.go` for the generated struct and adjust field names accordingly (e.g., `AccountName` vs `Account_Name`). The sqlc config has `emit_json_tags: true` so field names should be PascalCase of the SQL aliases.

**Step 2: Verify build**

Run: `cd backend && go build ./...`
Expected: PASS

**Step 3: Commit**

```
feat: add export service for CSV generation
```

---

### Task 3: Export Handler

**Files:**
- Create: `backend/internal/handler/export.go`

**Step 1: Write the handler**

Create `backend/internal/handler/export.go`:

```go
package handler

import (
	"net/http"

	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Export struct {
	svc *service.Export
}

func NewExport(svc *service.Export) *Export {
	return &Export{svc: svc}
}

func (h *Export) CSV(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	q := r.URL.Query()

	dateFrom := q.Get("date_from")
	dateTo := q.Get("date_to")
	if dateFrom == "" || dateTo == "" {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "date_from and date_to are required")
		return
	}

	data, err := h.svc.ExportCSV(r.Context(), userID, dateFrom, dateTo)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "EXPORT_ERROR", "Failed to export transactions")
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="export.csv"`)
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}
```

**Step 2: Verify build**

Run: `cd backend && go build ./...`
Expected: PASS

**Step 3: Commit**

```
feat: add export handler for CSV download
```

---

### Task 4: Wire Backend (Route + DI)

**Files:**
- Modify: `backend/internal/server/routes.go` — add `exportH *handler.Export` param and route
- Modify: `backend/cmd/api/main.go` — create service, handler, pass to router

**Step 1: Add route**

In `backend/internal/server/routes.go`:
- Add `exportH *handler.Export` parameter to `NewRouter`
- Inside the protected routes group, add:
```go
r.Route("/export", func(r chi.Router) {
	r.Get("/csv", exportH.CSV)
})
```

**Step 2: Wire DI in main.go**

In `backend/cmd/api/main.go`:
- Add service: `exportSvc := service.NewExport(queries)`
- Add handler: `exportH := handler.NewExport(exportSvc)`
- Pass `exportH` to `server.NewRouter(...)` call

**Step 3: Verify build**

Run: `cd backend && go build ./...`
Expected: PASS

**Step 4: Run tests**

Run: `cd backend && go test ./...`
Expected: PASS

**Step 5: Commit**

```
feat: wire export endpoint GET /api/v1/export/csv
```

---

### Task 5: Frontend API Function

**Files:**
- Create: `frontend/src/api/export.ts`

**Step 1: Write the API function**

Create `frontend/src/api/export.ts`:

```typescript
import { getAccessToken } from './client'

export async function exportTransactionsCSV(
  dateFrom: string,
  dateTo: string,
): Promise<Blob> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  const response = await fetch(`/api/v1/export/csv?${params}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  })

  if (!response.ok) {
    throw new Error('Export failed')
  }

  return response.blob()
}
```

**Note:** We use `fetch` directly here instead of `apiClient` because `apiClient` always parses JSON (`response.json()`), but we need a blob response. This is in the `api/` layer (not a component), so it's acceptable per project conventions. Auth is handled via `getAccessToken()` from `client.ts`.

**Step 2: Verify types**

Run: `cd frontend && npm run check:types`
Expected: PASS

**Step 3: Commit**

```
feat: add frontend API function for CSV export
```

---

### Task 6: Export Tab Component

**Files:**
- Create: `frontend/src/components/domain/export-tab.tsx`
- Modify: `frontend/src/pages/settings.tsx` — add Export tab

**Step 1: Create ExportTab component**

Create `frontend/src/components/domain/export-tab.tsx`:

```tsx
import { useState } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { toISODate } from '@/lib/dates'
import { exportTransactionsCSV } from '@/api/export'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/domain/date-picker'
import { Label } from '@/components/ui/label'

export function ExportTab() {
  const now = new Date()
  const [dateFrom, setDateFrom] = useState(toISODate(startOfMonth(now)))
  const [dateTo, setDateTo] = useState(toISODate(endOfMonth(now)))
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    if (!dateFrom || !dateTo) {
      toast.error('Please select both start and end dates')
      return
    }

    setLoading(true)
    try {
      const blob = await exportTransactionsCSV(dateFrom, dateTo)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${dateFrom}-to-${dateTo}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Failed to export transactions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <p className="text-sm text-muted-foreground">
        Export your transactions as a CSV file for the selected date range.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <DatePicker
            value={dateFrom}
            onChange={(d) => setDateFrom(d ?? '')}
            placeholder="Select start date"
          />
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <DatePicker
            value={dateTo}
            onChange={(d) => setDateTo(d ?? '')}
            placeholder="Select end date"
          />
        </div>
      </div>

      <Button onClick={handleExport} disabled={loading || !dateFrom || !dateTo}>
        <Download className="mr-2 h-4 w-4" />
        {loading ? 'Exporting...' : 'Export CSV'}
      </Button>
    </div>
  )
}
```

**Step 2: Add tab to settings page**

In `frontend/src/pages/settings.tsx`:

1. Add import: `import { ExportTab } from '@/components/domain/export-tab'`
2. Add `<TabsTrigger value="export">Export</TabsTrigger>` after the appearance trigger
3. Add tab content before closing `</Tabs>`:
```tsx
<TabsContent value="export" className="mt-4">
  <ExportTab />
</TabsContent>
```

**Step 3: Verify types and build**

Run: `cd frontend && npm run check:types && npm run build`
Expected: PASS

**Step 4: Commit**

```
feat: add Export tab to Settings page with date range CSV download
```

---

### Task 7: Update API Documentation

**Files:**
- Modify: `backend/docs/API.md` — add export endpoint documentation

**Step 1: Add endpoint docs**

Add to the API docs:

```markdown
### Export

#### GET /api/v1/export/csv

Export transactions as CSV file.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| date_from | string | yes | Start date (yyyy-MM-dd) |
| date_to | string | yes | End date (yyyy-MM-dd) |

**Response:** `200 OK` with `Content-Type: text/csv`

CSV columns: `date,account,category,total,currency,description,transfer`

- `date`: dd.MM.yyyy format
- `category`: "Parent\Child" or "Parent" or empty
- `total`: signed decimal (negative=expense, positive=income)
- `transfer`: target account name for transfers, empty otherwise

**Errors:**
- `400` — missing date_from or date_to
- `401` — unauthorized
```

**Step 2: Commit**

```
docs: add CSV export endpoint to API docs
```

---

### Task 8: Verify End-to-End

**Step 1: Run full backend verification**

Run: `cd backend && go build ./... && go test ./...`
Expected: PASS

**Step 2: Run full frontend verification**

Run: `cd frontend && npm run check:types && npm run build && npm run lint`
Expected: PASS

**Step 3: Final commit if any fixes needed**
