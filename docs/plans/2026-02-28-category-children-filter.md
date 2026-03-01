# Category Children Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When filtering transactions by category, automatically include transactions from all descendant (child) categories.

**Architecture:** Modify the two SQL queries (`ListTransactions` and `CountTransactions`) to use a recursive CTE that expands the input `category_ids` array to include all descendant category IDs before filtering. The service layer and handler remain unchanged — the change is purely at the SQL level. Write a service-level test that verifies child category IDs are expanded before being passed to the store.

**Tech Stack:** PostgreSQL recursive CTE, sqlc, Go

---

### Task 1: Update ListTransactions SQL query

**Files:**
- Modify: `backend/queries/transactions.sql` (lines 9-18, the `ListTransactions` query)

**Step 1: Update the SQL query to use a recursive CTE**

Replace the `ListTransactions` query in `backend/queries/transactions.sql` with:

```sql
-- name: ListTransactions :many
WITH RECURSIVE expanded_categories AS (
    SELECT id FROM categories
    WHERE id = ANY(@category_ids::UUID[])
    UNION
    SELECT c.id FROM categories c
    INNER JOIN expanded_categories ec ON c.parent_id = ec.id
)
SELECT id, user_id, account_id, category_id, type, amount, description, date, transfer_id, exchange_rate, created_at, updated_at FROM transactions
WHERE user_id = @user_id
    AND (cardinality(@account_ids::UUID[]) = 0 OR account_id = ANY(@account_ids))
    AND (cardinality(@category_ids::UUID[]) = 0 OR category_id IN (SELECT id FROM expanded_categories))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR date <= sqlc.narg('date_to'))
ORDER BY date DESC, created_at DESC
LIMIT @lim OFFSET @off;
```

Key changes:
- Added `WITH RECURSIVE expanded_categories` CTE that starts with input category IDs and recursively finds all children via `parent_id`
- Changed `category_id = ANY(@category_ids)` to `category_id IN (SELECT id FROM expanded_categories)`
- Explicitly listed column names in SELECT (sqlc requires this when using CTEs)

### Task 2: Update CountTransactions SQL query

**Files:**
- Modify: `backend/queries/transactions.sql` (lines 20-27, the `CountTransactions` query)

**Step 1: Update the SQL query with the same recursive CTE**

Replace the `CountTransactions` query with:

```sql
-- name: CountTransactions :one
WITH RECURSIVE expanded_categories AS (
    SELECT id FROM categories
    WHERE id = ANY(@category_ids::UUID[])
    UNION
    SELECT c.id FROM categories c
    INNER JOIN expanded_categories ec ON c.parent_id = ec.id
)
SELECT COUNT(*) FROM transactions
WHERE user_id = @user_id
    AND (cardinality(@account_ids::UUID[]) = 0 OR account_id = ANY(@account_ids))
    AND (cardinality(@category_ids::UUID[]) = 0 OR category_id IN (SELECT id FROM expanded_categories))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR date <= sqlc.narg('date_to'));
```

### Task 3: Regenerate sqlc and verify compilation

**Step 1: Run sqlc generate**

```bash
cd backend && make sqlc
```

Expected: sqlc regenerates `internal/store/transactions.sql.go` with updated query strings. The Go struct signatures (`ListTransactionsParams`, `CountTransactionsParams`) should remain identical since we didn't change the parameters.

**Step 2: Verify the project compiles**

```bash
cd backend && go build ./...
```

Expected: Clean compilation with no errors.

**Step 3: Run existing tests**

```bash
cd backend && go test ./...
```

Expected: All existing tests pass (the mock-based tests don't hit real SQL, so they should be unaffected).

**Step 4: Commit**

```bash
git add backend/queries/transactions.sql backend/internal/store/transactions.sql.go
git commit -m "feat: include child categories when filtering transactions

Use recursive CTE in ListTransactions and CountTransactions queries
to automatically expand selected category IDs to include all
descendant categories."
```

### Task 4: Write integration test for recursive category filtering

Since the recursive CTE logic lives entirely in SQL, mock-based unit tests can't verify it. Write an integration test that uses a real PostgreSQL database.

**Files:**
- Create: `backend/internal/store/transactions_test.go`

**Step 1: Write the integration test**

```go
//go:build integration

package store_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

func setupTestDB(t *testing.T) (*store.Queries, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	require.NoError(t, err)

	queries := store.New(pool)
	return queries, func() { pool.Close() }
}

func TestListTransactions_IncludesChildCategories(t *testing.T) {
	queries, cleanup := setupTestDB(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test user
	userID := uuid.New()
	_, err := queries.CreateUser(ctx, store.CreateUserParams{
		ID:           userID,
		Username:     "testuser_" + userID.String()[:8],
		PasswordHash: "hash",
		DisplayName:  "Test User",
		BaseCurrency: "USD",
	})
	require.NoError(t, err)

	// Create an account
	account, err := queries.CreateAccount(ctx, store.CreateAccountParams{
		UserID:   userID,
		Name:     "Test Account",
		Type:     "bank",
		Currency: "USD",
	})
	require.NoError(t, err)

	// Create parent category "Food"
	parentCat, err := queries.CreateCategory(ctx, store.CreateCategoryParams{
		UserID: userID,
		Name:   "Food",
		Type:   "expense",
	})
	require.NoError(t, err)

	// Create child category "Food > Restaurants"
	childCat, err := queries.CreateCategory(ctx, store.CreateCategoryParams{
		UserID:   userID,
		ParentID: pgtype.UUID{Bytes: parentCat.ID, Valid: true},
		Name:     "Restaurants",
		Type:     "expense",
	})
	require.NoError(t, err)

	// Create another unrelated category
	otherCat, err := queries.CreateCategory(ctx, store.CreateCategoryParams{
		UserID: userID,
		Name:   "Transport",
		Type:   "expense",
	})
	require.NoError(t, err)

	amount := pgtype.Numeric{}
	amount.Scan("10.00")
	date := pgtype.Date{}
	date.Scan("2026-01-15")

	// Create transaction with parent category
	_, err = queries.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:    userID,
		AccountID: account.ID,
		CategoryID: pgtype.UUID{Bytes: parentCat.ID, Valid: true},
		Type:      "expense",
		Amount:    amount,
		Date:      date,
	})
	require.NoError(t, err)

	// Create transaction with child category
	_, err = queries.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:    userID,
		AccountID: account.ID,
		CategoryID: pgtype.UUID{Bytes: childCat.ID, Valid: true},
		Type:      "expense",
		Amount:    amount,
		Date:      date,
	})
	require.NoError(t, err)

	// Create transaction with unrelated category
	_, err = queries.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:    userID,
		AccountID: account.ID,
		CategoryID: pgtype.UUID{Bytes: otherCat.ID, Valid: true},
		Type:      "expense",
		Amount:    amount,
		Date:      date,
	})
	require.NoError(t, err)

	// Filter by parent category only — should return parent + child transactions
	txns, err := queries.ListTransactions(ctx, store.ListTransactionsParams{
		UserID:      userID,
		AccountIds:  []uuid.UUID{},
		CategoryIds: []uuid.UUID{parentCat.ID},
		Lim:         100,
	})
	require.NoError(t, err)
	require.Len(t, txns, 2, "filtering by parent should include child category transactions")

	// Verify the count query matches
	count, err := queries.CountTransactions(ctx, store.CountTransactionsParams{
		UserID:      userID,
		AccountIds:  []uuid.UUID{},
		CategoryIds: []uuid.UUID{parentCat.ID},
	})
	require.NoError(t, err)
	require.Equal(t, int64(2), count)

	// Filter by child category only — should return only child transaction
	txns, err = queries.ListTransactions(ctx, store.ListTransactionsParams{
		UserID:      userID,
		AccountIds:  []uuid.UUID{},
		CategoryIds: []uuid.UUID{childCat.ID},
		Lim:         100,
	})
	require.NoError(t, err)
	require.Len(t, txns, 1, "filtering by child should return only child transaction")

	// Filter by no categories — should return all 3
	txns, err = queries.ListTransactions(ctx, store.ListTransactionsParams{
		UserID:      userID,
		AccountIds:  []uuid.UUID{},
		CategoryIds: []uuid.UUID{},
		Lim:         100,
	})
	require.NoError(t, err)
	require.Len(t, txns, 3, "no category filter should return all transactions")
}
```

**Step 2: Verify the test runs against the database**

```bash
cd backend && DATABASE_URL="your-connection-string" go test -tags=integration ./internal/store/ -run TestListTransactions_IncludesChildCategories -v
```

Expected: PASS — 2 transactions returned when filtering by parent, 1 when filtering by child, 3 when no filter.

**Step 3: Commit**

```bash
git add backend/internal/store/transactions_test.go
git commit -m "test: add integration test for recursive category filtering"
```

### Task 5: Verify existing unit tests still pass

**Step 1: Run all unit tests**

```bash
cd backend && go test ./...
```

Expected: All existing tests pass. The mock-based tests in `service/transaction_test.go` are unaffected since they mock the store layer.
