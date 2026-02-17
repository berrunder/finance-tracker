package service

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type mockTransactionStore struct {
	createTransactionFn             func(ctx context.Context, arg store.CreateTransactionParams) (store.Transaction, error)
	getTransactionFn                func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error)
	listTransactionsFn              func(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error)
	countTransactionsFn             func(ctx context.Context, arg store.CountTransactionsParams) (int64, error)
	updateTransactionFn             func(ctx context.Context, arg store.UpdateTransactionParams) (store.Transaction, error)
	deleteTransactionFn             func(ctx context.Context, arg store.DeleteTransactionParams) error
	deleteTransactionByTransferIDFn func(ctx context.Context, arg store.DeleteTransactionByTransferIDParams) error
	getTransactionsByTransferIDFn   func(ctx context.Context, arg store.GetTransactionsByTransferIDParams) ([]store.Transaction, error)
	updateTransferTransactionFn     func(ctx context.Context, arg store.UpdateTransferTransactionParams) (store.Transaction, error)
	getAccountFn                    func(ctx context.Context, arg store.GetAccountParams) (store.Account, error)
	listAccountsFn                  func(ctx context.Context, userID uuid.UUID) ([]store.Account, error)
	withTxFn                        func(tx pgx.Tx) *store.Queries
}

func (m *mockTransactionStore) CreateTransaction(ctx context.Context, arg store.CreateTransactionParams) (store.Transaction, error) {
	return m.createTransactionFn(ctx, arg)
}
func (m *mockTransactionStore) GetTransaction(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error) {
	return m.getTransactionFn(ctx, arg)
}
func (m *mockTransactionStore) ListTransactions(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error) {
	return m.listTransactionsFn(ctx, arg)
}
func (m *mockTransactionStore) CountTransactions(ctx context.Context, arg store.CountTransactionsParams) (int64, error) {
	return m.countTransactionsFn(ctx, arg)
}
func (m *mockTransactionStore) UpdateTransaction(ctx context.Context, arg store.UpdateTransactionParams) (store.Transaction, error) {
	return m.updateTransactionFn(ctx, arg)
}
func (m *mockTransactionStore) DeleteTransaction(ctx context.Context, arg store.DeleteTransactionParams) error {
	return m.deleteTransactionFn(ctx, arg)
}
func (m *mockTransactionStore) DeleteTransactionByTransferID(ctx context.Context, arg store.DeleteTransactionByTransferIDParams) error {
	return m.deleteTransactionByTransferIDFn(ctx, arg)
}
func (m *mockTransactionStore) GetAccount(ctx context.Context, arg store.GetAccountParams) (store.Account, error) {
	return m.getAccountFn(ctx, arg)
}
func (m *mockTransactionStore) ListAccounts(ctx context.Context, userID uuid.UUID) ([]store.Account, error) {
	return m.listAccountsFn(ctx, userID)
}
func (m *mockTransactionStore) GetTransactionsByTransferID(ctx context.Context, arg store.GetTransactionsByTransferIDParams) ([]store.Transaction, error) {
	return m.getTransactionsByTransferIDFn(ctx, arg)
}
func (m *mockTransactionStore) UpdateTransferTransaction(ctx context.Context, arg store.UpdateTransferTransactionParams) (store.Transaction, error) {
	return m.updateTransferTransactionFn(ctx, arg)
}
func (m *mockTransactionStore) WithTx(tx pgx.Tx) *store.Queries {
	if m.withTxFn != nil {
		return m.withTxFn(tx)
	}
	return nil
}

func TestTransactionCreate_InvalidDate(t *testing.T) {
	mock := &mockTransactionStore{}

	svc := &Transaction{queries: mock}
	_, err := svc.Create(context.Background(), uuid.New(), dto.CreateTransactionRequest{
		AccountID: uuid.New(),
		Type:      "expense",
		Amount:    "50.00",
		Date:      "not-a-date",
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid date")
}

func TestTransactionGet_NotFound(t *testing.T) {
	mock := &mockTransactionStore{
		getTransactionFn: func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error) {
			return store.Transaction{}, pgx.ErrNoRows
		},
	}

	svc := &Transaction{queries: mock}
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())

	require.ErrorIs(t, err, ErrNotFound)
}

func TestTransactionDelete_WithTransfer(t *testing.T) {
	userID := uuid.New()
	txnID := uuid.New()
	transferID := uuid.New()

	deleteByTransferCalled := false
	deleteCalled := false

	mock := &mockTransactionStore{
		getTransactionFn: func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error) {
			return store.Transaction{
				ID:         txnID,
				UserID:     userID,
				TransferID: pgtype.UUID{Bytes: transferID, Valid: true},
			}, nil
		},
		deleteTransactionByTransferIDFn: func(ctx context.Context, arg store.DeleteTransactionByTransferIDParams) error {
			deleteByTransferCalled = true
			require.Equal(t, transferID, uuid.UUID(arg.TransferID.Bytes))
			return nil
		},
		deleteTransactionFn: func(ctx context.Context, arg store.DeleteTransactionParams) error {
			deleteCalled = true
			return nil
		},
	}

	svc := &Transaction{queries: mock}
	err := svc.Delete(context.Background(), userID, txnID)

	require.NoError(t, err)
	require.True(t, deleteByTransferCalled, "DeleteTransactionByTransferID should be called")
	require.False(t, deleteCalled, "DeleteTransaction should not be called for transfer transactions")
}

func TestTransactionDelete_NoTransfer(t *testing.T) {
	userID := uuid.New()
	txnID := uuid.New()

	deleteByTransferCalled := false
	deleteCalled := false

	mock := &mockTransactionStore{
		getTransactionFn: func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error) {
			return store.Transaction{
				ID:         txnID,
				UserID:     userID,
				TransferID: pgtype.UUID{Valid: false},
			}, nil
		},
		deleteTransactionByTransferIDFn: func(ctx context.Context, arg store.DeleteTransactionByTransferIDParams) error {
			deleteByTransferCalled = true
			return nil
		},
		deleteTransactionFn: func(ctx context.Context, arg store.DeleteTransactionParams) error {
			deleteCalled = true
			return nil
		},
	}

	svc := &Transaction{queries: mock}
	err := svc.Delete(context.Background(), userID, txnID)

	require.NoError(t, err)
	require.False(t, deleteByTransferCalled, "DeleteTransactionByTransferID should NOT be called")
	require.True(t, deleteCalled, "DeleteTransaction should be called")
}

func TestTransactionList_PaginationDefaults(t *testing.T) {
	userID := uuid.New()

	var capturedListParams store.ListTransactionsParams
	mock := &mockTransactionStore{
		listTransactionsFn: func(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error) {
			capturedListParams = arg
			return []store.Transaction{}, nil
		},
		countTransactionsFn: func(ctx context.Context, arg store.CountTransactionsParams) (int64, error) {
			return 0, nil
		},
		listAccountsFn: func(ctx context.Context, userID uuid.UUID) ([]store.Account, error) {
			return []store.Account{}, nil
		},
	}

	svc := &Transaction{queries: mock}

	t.Run("page 0 clamped to 1", func(t *testing.T) {
		resp, err := svc.List(context.Background(), userID, ListTransactionsParams{Page: 0, PerPage: 10})
		require.NoError(t, err)
		require.Equal(t, 1, resp.Pagination.Page)
		require.Equal(t, int32(0), capturedListParams.Off)
	})

	t.Run("perPage 0 defaults to 20", func(t *testing.T) {
		resp, err := svc.List(context.Background(), userID, ListTransactionsParams{Page: 1, PerPage: 0})
		require.NoError(t, err)
		require.Equal(t, 20, resp.Pagination.PerPage)
		require.Equal(t, int32(20), capturedListParams.Lim)
	})

	t.Run("perPage 200 clamped to 20", func(t *testing.T) {
		resp, err := svc.List(context.Background(), userID, ListTransactionsParams{Page: 1, PerPage: 200})
		require.NoError(t, err)
		require.Equal(t, 20, resp.Pagination.PerPage)
		require.Equal(t, int32(20), capturedListParams.Lim)
	})
}

func TestTransactionList_InvalidDateFilters_DefaultsToCurrentMonth(t *testing.T) {
	userID := uuid.New()

	var capturedListParams store.ListTransactionsParams
	mock := &mockTransactionStore{
		listTransactionsFn: func(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error) {
			capturedListParams = arg
			return []store.Transaction{}, nil
		},
		countTransactionsFn: func(ctx context.Context, arg store.CountTransactionsParams) (int64, error) {
			return 0, nil
		},
		listAccountsFn: func(ctx context.Context, userID uuid.UUID) ([]store.Account, error) {
			return []store.Account{}, nil
		},
	}

	svc := &Transaction{queries: mock}

	_, err := svc.List(context.Background(), userID, ListTransactionsParams{
		DateFrom: "bad-date",
		DateTo:   "also-bad",
		Page:     1,
		PerPage:  20,
	})

	require.NoError(t, err)
	require.True(t, capturedListParams.DateFrom.Valid)
	require.True(t, capturedListParams.DateTo.Valid)

	now := time.Now()
	expectedStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	expectedEnd := expectedStart.AddDate(0, 1, -1)

	require.Equal(t, expectedStart.Format("2006-01-02"), capturedListParams.DateFrom.Time.Format("2006-01-02"))
	require.Equal(t, expectedEnd.Format("2006-01-02"), capturedListParams.DateTo.Time.Format("2006-01-02"))
}

func TestTransactionList_InvalidDateFilter_PreservesValidCounterpart(t *testing.T) {
	userID := uuid.New()
	now := time.Now()
	expectedStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	expectedEnd := expectedStart.AddDate(0, 1, -1)

	t.Run("valid from, invalid to", func(t *testing.T) {
		var capturedListParams store.ListTransactionsParams
		mock := &mockTransactionStore{
			listTransactionsFn: func(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error) {
				capturedListParams = arg
				return []store.Transaction{}, nil
			},
			countTransactionsFn: func(ctx context.Context, arg store.CountTransactionsParams) (int64, error) {
				return 0, nil
			},
			listAccountsFn: func(ctx context.Context, userID uuid.UUID) ([]store.Account, error) {
				return []store.Account{}, nil
			},
		}

		svc := &Transaction{queries: mock}

		_, err := svc.List(context.Background(), userID, ListTransactionsParams{
			DateFrom: "2026-01-15",
			DateTo:   "bad-date",
			Page:     1,
			PerPage:  20,
		})

		require.NoError(t, err)
		require.True(t, capturedListParams.DateFrom.Valid)
		require.True(t, capturedListParams.DateTo.Valid)
		require.Equal(t, "2026-01-15", capturedListParams.DateFrom.Time.Format("2006-01-02"))
		require.Equal(t, expectedEnd.Format("2006-01-02"), capturedListParams.DateTo.Time.Format("2006-01-02"))
	})

	t.Run("invalid from, valid to", func(t *testing.T) {
		var capturedListParams store.ListTransactionsParams
		mock := &mockTransactionStore{
			listTransactionsFn: func(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error) {
				capturedListParams = arg
				return []store.Transaction{}, nil
			},
			countTransactionsFn: func(ctx context.Context, arg store.CountTransactionsParams) (int64, error) {
				return 0, nil
			},
			listAccountsFn: func(ctx context.Context, userID uuid.UUID) ([]store.Account, error) {
				return []store.Account{}, nil
			},
		}

		svc := &Transaction{queries: mock}

		_, err := svc.List(context.Background(), userID, ListTransactionsParams{
			DateFrom: "bad-date",
			DateTo:   "2026-01-31",
			Page:     1,
			PerPage:  20,
		})

		require.NoError(t, err)
		require.True(t, capturedListParams.DateFrom.Valid)
		require.True(t, capturedListParams.DateTo.Valid)
		require.Equal(t, expectedStart.Format("2006-01-02"), capturedListParams.DateFrom.Time.Format("2006-01-02"))
		require.Equal(t, "2026-01-31", capturedListParams.DateTo.Time.Format("2006-01-02"))
	})
}

func TestTransactionList_UsesListAccountsForCurrency(t *testing.T) {
	userID := uuid.New()
	accountID := uuid.New()

	getAccountCalled := false
	mock := &mockTransactionStore{
		listTransactionsFn: func(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error) {
			return []store.Transaction{{
				ID:        uuid.New(),
				UserID:    userID,
				AccountID: accountID,
				Type:      "expense",
				Amount:    numericFromString("12.34"),
				Date:      pgtype.Date{Time: time.Now(), Valid: true},
			}}, nil
		},
		countTransactionsFn: func(ctx context.Context, arg store.CountTransactionsParams) (int64, error) {
			return 1, nil
		},
		listAccountsFn: func(ctx context.Context, userID uuid.UUID) ([]store.Account, error) {
			return []store.Account{{ID: accountID, UserID: userID, Currency: "USD"}}, nil
		},
		getAccountFn: func(ctx context.Context, arg store.GetAccountParams) (store.Account, error) {
			getAccountCalled = true
			return store.Account{}, nil
		},
	}

	svc := &Transaction{queries: mock}

	resp, err := svc.List(context.Background(), userID, ListTransactionsParams{Page: 1, PerPage: 20})
	require.NoError(t, err)
	items, ok := resp.Data.([]dto.TransactionResponse)
	require.True(t, ok)
	require.Len(t, items, 1)

	item := items[0]
	require.Equal(t, "USD", item.Currency)
	require.False(t, getAccountCalled, "GetAccount should not be called per row in list response")
}

func TestUpdateTransfer_NotFound(t *testing.T) {
	mock := &mockTransactionStore{
		getTransactionFn: func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error) {
			return store.Transaction{}, pgx.ErrNoRows
		},
	}

	svc := &Transaction{queries: mock}
	_, err := svc.UpdateTransfer(context.Background(), uuid.New(), uuid.New(), dto.UpdateTransferRequest{
		FromAccountID: uuid.New(),
		ToAccountID:   uuid.New(),
		Amount:        "100.00",
		Date:          "2024-01-15",
	})

	require.ErrorIs(t, err, ErrNotFound)
}

func TestTransactionDelete_NotFound(t *testing.T) {
	userID := uuid.New()
	txnID := uuid.New()

	mock := &mockTransactionStore{
		getTransactionFn: func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error) {
			return store.Transaction{}, pgx.ErrNoRows
		},
		deleteTransactionByTransferIDFn: func(ctx context.Context, arg store.DeleteTransactionByTransferIDParams) error {
			t.Fatalf("DeleteTransactionByTransferID should not be called when transaction is missing")
			return nil
		},
		deleteTransactionFn: func(ctx context.Context, arg store.DeleteTransactionParams) error {
			t.Fatalf("DeleteTransaction should not be called when transaction is missing")
			return nil
		},
	}

	svc := &Transaction{queries: mock}
	err := svc.Delete(context.Background(), userID, txnID)

	require.ErrorIs(t, err, ErrNotFound)
}

func TestUpdateTransfer_NotATransfer(t *testing.T) {
	txnID := uuid.New()
	userID := uuid.New()

	mock := &mockTransactionStore{
		getTransactionFn: func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error) {
			return store.Transaction{
				ID:         txnID,
				UserID:     userID,
				TransferID: pgtype.UUID{Valid: false},
			}, nil
		},
	}

	svc := &Transaction{queries: mock}
	_, err := svc.UpdateTransfer(context.Background(), userID, txnID, dto.UpdateTransferRequest{
		FromAccountID: uuid.New(),
		ToAccountID:   uuid.New(),
		Amount:        "100.00",
		Date:          "2024-01-15",
	})

	require.ErrorIs(t, err, ErrNotATransfer)
}
