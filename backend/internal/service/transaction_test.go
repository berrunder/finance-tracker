package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type mockTransactionStore struct {
	createTransactionFn            func(ctx context.Context, arg store.CreateTransactionParams) (store.Transaction, error)
	getTransactionFn               func(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error)
	listTransactionsFn             func(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error)
	countTransactionsFn            func(ctx context.Context, arg store.CountTransactionsParams) (int64, error)
	updateTransactionFn            func(ctx context.Context, arg store.UpdateTransactionParams) (store.Transaction, error)
	deleteTransactionFn            func(ctx context.Context, arg store.DeleteTransactionParams) error
	deleteTransactionByTransferIDFn func(ctx context.Context, arg store.DeleteTransactionByTransferIDParams) error
	getAccountFn                   func(ctx context.Context, arg store.GetAccountParams) (store.Account, error)
	withTxFn                       func(tx pgx.Tx) *store.Queries
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
	require.True(t, deleteCalled, "DeleteTransaction should also be called")
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
