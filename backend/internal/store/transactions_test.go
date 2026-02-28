//go:build integration

package store_test

import (
	"context"
	"math/big"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

func setupTestDB(t *testing.T) (*store.Queries, func()) {
	t.Helper()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	require.NoError(t, err)

	queries := store.New(pool)
	cleanup := func() {
		pool.Close()
	}

	return queries, cleanup
}

func numericFromInt(v int64) pgtype.Numeric {
	return pgtype.Numeric{
		Int:   big.NewInt(v),
		Exp:   0,
		Valid: true,
	}
}

func TestListTransactions_IncludesChildCategories(t *testing.T) {
	queries, cleanup := setupTestDB(t)
	defer cleanup()

	ctx := context.Background()

	// Create a test user
	suffix := uuid.New().String()[:8]
	user, err := queries.CreateUser(ctx, store.CreateUserParams{
		Username:     "testuser_" + suffix,
		PasswordHash: "hashedpassword",
		DisplayName:  "Test User",
		BaseCurrency: "USD",
		InviteCode:   pgtype.Text{String: "test-invite", Valid: true},
	})
	require.NoError(t, err)

	// Create a test account
	account, err := queries.CreateAccount(ctx, store.CreateAccountParams{
		UserID:         user.ID,
		Name:           "Test Account",
		Type:           "bank",
		Currency:       "USD",
		InitialBalance: numericFromInt(0),
	})
	require.NoError(t, err)

	// Create parent category "Food"
	catFood, err := queries.CreateCategory(ctx, store.CreateCategoryParams{
		UserID:   user.ID,
		ParentID: pgtype.UUID{Valid: false},
		Name:     "Food",
		Type:     "expense",
	})
	require.NoError(t, err)

	// Create child category "Restaurants" under "Food"
	catRestaurants, err := queries.CreateCategory(ctx, store.CreateCategoryParams{
		UserID:   user.ID,
		ParentID: pgtype.UUID{Bytes: catFood.ID, Valid: true},
		Name:     "Restaurants",
		Type:     "expense",
	})
	require.NoError(t, err)

	// Create unrelated category "Transport"
	catTransport, err := queries.CreateCategory(ctx, store.CreateCategoryParams{
		UserID:   user.ID,
		ParentID: pgtype.UUID{Valid: false},
		Name:     "Transport",
		Type:     "expense",
	})
	require.NoError(t, err)

	txDate := pgtype.Date{Time: time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), Valid: true}

	// Create transaction in parent category "Food"
	_, err = queries.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:    user.ID,
		AccountID: account.ID,
		CategoryID: pgtype.UUID{Bytes: catFood.ID, Valid: true},
		Type:       "expense",
		Amount:     numericFromInt(100),
		Description: "Groceries",
		Date:        txDate,
	})
	require.NoError(t, err)

	// Create transaction in child category "Restaurants"
	_, err = queries.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:    user.ID,
		AccountID: account.ID,
		CategoryID: pgtype.UUID{Bytes: catRestaurants.ID, Valid: true},
		Type:       "expense",
		Amount:     numericFromInt(50),
		Description: "Dinner out",
		Date:        txDate,
	})
	require.NoError(t, err)

	// Create transaction in unrelated category "Transport"
	_, err = queries.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:    user.ID,
		AccountID: account.ID,
		CategoryID: pgtype.UUID{Bytes: catTransport.ID, Valid: true},
		Type:       "expense",
		Amount:     numericFromInt(30),
		Description: "Bus fare",
		Date:        txDate,
	})
	require.NoError(t, err)

	baseParams := store.ListTransactionsParams{
		UserID:     user.ID,
		AccountIds: []uuid.UUID{},
		Lim:        100,
	}

	t.Run("parent filter includes child transactions", func(t *testing.T) {
		params := baseParams
		params.CategoryIds = []uuid.UUID{catFood.ID}

		txns, err := queries.ListTransactions(ctx, params)
		require.NoError(t, err)
		require.Len(t, txns, 2)
	})

	t.Run("child filter returns only child transaction", func(t *testing.T) {
		params := baseParams
		params.CategoryIds = []uuid.UUID{catRestaurants.ID}

		txns, err := queries.ListTransactions(ctx, params)
		require.NoError(t, err)
		require.Len(t, txns, 1)
		require.Equal(t, "Dinner out", txns[0].Description)
	})

	t.Run("no category filter returns all", func(t *testing.T) {
		params := baseParams
		params.CategoryIds = []uuid.UUID{}

		txns, err := queries.ListTransactions(ctx, params)
		require.NoError(t, err)
		require.Len(t, txns, 3)
	})

	t.Run("count matches list for parent filter", func(t *testing.T) {
		count, err := queries.CountTransactions(ctx, store.CountTransactionsParams{
			UserID:      user.ID,
			AccountIds:  []uuid.UUID{},
			CategoryIds: []uuid.UUID{catFood.ID},
		})
		require.NoError(t, err)
		require.Equal(t, int64(2), count)
	})
}
