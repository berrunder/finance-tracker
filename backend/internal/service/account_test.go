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

type mockAccountStore struct {
	createAccountFn            func(ctx context.Context, arg store.CreateAccountParams) (store.Account, error)
	listAccountsFn             func(ctx context.Context, userID uuid.UUID) ([]store.Account, error)
	getAccountFn               func(ctx context.Context, arg store.GetAccountParams) (store.Account, error)
	updateAccountFn            func(ctx context.Context, arg store.UpdateAccountParams) (store.Account, error)
	deleteAccountFn            func(ctx context.Context, arg store.DeleteAccountParams) error
	getAccountTransactionSumsFn func(ctx context.Context, accountID uuid.UUID) (store.GetAccountTransactionSumsRow, error)
}

func (m *mockAccountStore) CreateAccount(ctx context.Context, arg store.CreateAccountParams) (store.Account, error) {
	return m.createAccountFn(ctx, arg)
}
func (m *mockAccountStore) ListAccounts(ctx context.Context, userID uuid.UUID) ([]store.Account, error) {
	return m.listAccountsFn(ctx, userID)
}
func (m *mockAccountStore) GetAccount(ctx context.Context, arg store.GetAccountParams) (store.Account, error) {
	return m.getAccountFn(ctx, arg)
}
func (m *mockAccountStore) UpdateAccount(ctx context.Context, arg store.UpdateAccountParams) (store.Account, error) {
	return m.updateAccountFn(ctx, arg)
}
func (m *mockAccountStore) DeleteAccount(ctx context.Context, arg store.DeleteAccountParams) error {
	return m.deleteAccountFn(ctx, arg)
}
func (m *mockAccountStore) GetAccountTransactionSums(ctx context.Context, accountID uuid.UUID) (store.GetAccountTransactionSumsRow, error) {
	return m.getAccountTransactionSumsFn(ctx, accountID)
}

func makeTimestamp() pgtype.Timestamptz {
	return pgtype.Timestamptz{Valid: true}
}

func TestAccountGet_Balance(t *testing.T) {
	accountID := uuid.New()
	userID := uuid.New()

	mock := &mockAccountStore{
		getAccountFn: func(ctx context.Context, arg store.GetAccountParams) (store.Account, error) {
			return store.Account{
				ID:             accountID,
				UserID:         userID,
				Name:           "Checking",
				Type:           "bank",
				Currency:       "USD",
				InitialBalance: numericFromString("1000.00"),
				CreatedAt:      makeTimestamp(),
				UpdatedAt:      makeTimestamp(),
			}, nil
		},
		getAccountTransactionSumsFn: func(ctx context.Context, id uuid.UUID) (store.GetAccountTransactionSumsRow, error) {
			return store.GetAccountTransactionSumsRow{
				TotalIncome:  numericFromString("500.00"),
				TotalExpense: numericFromString("200.00"),
			}, nil
		},
	}

	svc := &Account{queries: mock}
	resp, err := svc.Get(context.Background(), userID, accountID)

	require.NoError(t, err)
	require.Equal(t, "1000.00", resp.InitialBalance)
	require.Equal(t, "1300.00", resp.Balance) // 1000 + (500 - 200) = 1300
}

func TestAccountGet_NotFound(t *testing.T) {
	mock := &mockAccountStore{
		getAccountFn: func(ctx context.Context, arg store.GetAccountParams) (store.Account, error) {
			return store.Account{}, pgx.ErrNoRows
		},
	}

	svc := &Account{queries: mock}
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())

	require.ErrorIs(t, err, ErrNotFound)
}

func TestAccountList_MultipleAccounts(t *testing.T) {
	userID := uuid.New()
	acct1 := uuid.New()
	acct2 := uuid.New()

	mock := &mockAccountStore{
		listAccountsFn: func(ctx context.Context, uid uuid.UUID) ([]store.Account, error) {
			return []store.Account{
				{
					ID: acct1, UserID: userID, Name: "Checking", Type: "bank", Currency: "USD",
					InitialBalance: numericFromString("500.00"),
					CreatedAt:      makeTimestamp(),
					UpdatedAt:      makeTimestamp(),
				},
				{
					ID: acct2, UserID: userID, Name: "Savings", Type: "savings", Currency: "USD",
					InitialBalance: numericFromString("2000.00"),
					CreatedAt:      makeTimestamp(),
					UpdatedAt:      makeTimestamp(),
				},
			}, nil
		},
		getAccountTransactionSumsFn: func(ctx context.Context, id uuid.UUID) (store.GetAccountTransactionSumsRow, error) {
			if id == acct1 {
				return store.GetAccountTransactionSumsRow{
					TotalIncome:  numericFromString("100.00"),
					TotalExpense: numericFromString("50.00"),
				}, nil
			}
			return store.GetAccountTransactionSumsRow{
				TotalIncome:  numericFromString("0.00"),
				TotalExpense: numericFromString("0.00"),
			}, nil
		},
	}

	svc := &Account{queries: mock}
	result, err := svc.List(context.Background(), userID)

	require.NoError(t, err)
	require.Len(t, result, 2)
	require.Equal(t, "550.00", result[0].Balance) // 500 + (100 - 50)
	require.Equal(t, "2000.00", result[1].Balance) // 2000 + (0 - 0)
}

func TestAccountCreate_DefaultBalance(t *testing.T) {
	userID := uuid.New()
	accountID := uuid.New()

	var capturedParams store.CreateAccountParams
	mock := &mockAccountStore{
		createAccountFn: func(ctx context.Context, arg store.CreateAccountParams) (store.Account, error) {
			capturedParams = arg
			return store.Account{
				ID: accountID, UserID: userID, Name: arg.Name, Type: arg.Type,
				Currency: arg.Currency, InitialBalance: arg.InitialBalance,
				CreatedAt: makeTimestamp(), UpdatedAt: makeTimestamp(),
			}, nil
		},
		getAccountTransactionSumsFn: func(ctx context.Context, id uuid.UUID) (store.GetAccountTransactionSumsRow, error) {
			return store.GetAccountTransactionSumsRow{
				TotalIncome:  numericFromString("0.00"),
				TotalExpense: numericFromString("0.00"),
			}, nil
		},
	}

	svc := &Account{queries: mock}
	resp, err := svc.Create(context.Background(), userID, dto.CreateAccountRequest{
		Name:     "Cash",
		Type:     "cash",
		Currency: "USD",
		// InitialBalance left empty
	})

	require.NoError(t, err)
	require.Equal(t, "0.00", resp.Balance)
	// The service should have defaulted to "0"
	require.Equal(t, "0.00", numericToString(capturedParams.InitialBalance))
}
