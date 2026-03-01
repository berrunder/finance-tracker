package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

var ErrNotFound = errors.New("not found")

type accountStore interface {
	CreateAccount(ctx context.Context, arg store.CreateAccountParams) (store.Account, error)
	ListAccounts(ctx context.Context, userID uuid.UUID) ([]store.ListAccountsRow, error)
	GetAccount(ctx context.Context, arg store.GetAccountParams) (store.Account, error)
	UpdateAccount(ctx context.Context, arg store.UpdateAccountParams) (store.Account, error)
	DeleteAccount(ctx context.Context, arg store.DeleteAccountParams) error
	GetAccountTransactionSums(ctx context.Context, accountID uuid.UUID) (store.GetAccountTransactionSumsRow, error)
}

type Account struct {
	queries accountStore
}

func NewAccount(queries *store.Queries) *Account {
	return &Account{queries: queries}
}

func accountToResponse(a store.Account, sums store.GetAccountTransactionSumsRow) dto.AccountResponse {
	balance := numericAdd(a.InitialBalance, numericSub(sums.TotalIncome, sums.TotalExpense))
	return dto.AccountResponse{
		ID:             a.ID,
		Name:           a.Name,
		Type:           a.Type,
		Currency:       a.Currency,
		InitialBalance: numericToString(a.InitialBalance),
		Balance:        numericToString(balance),
		CreatedAt:      a.CreatedAt.Time,
		UpdatedAt:      a.UpdatedAt.Time,
	}
}

func (s *Account) Create(ctx context.Context, userID uuid.UUID, req dto.CreateAccountRequest) (*dto.AccountResponse, error) {
	balance := numericFromStringOrZero(req.InitialBalance)

	acct, err := s.queries.CreateAccount(ctx, store.CreateAccountParams{
		UserID:         userID,
		Name:           req.Name,
		Type:           req.Type,
		Currency:       req.Currency,
		InitialBalance: balance,
	})
	if err != nil {
		return nil, err
	}

	return s.toResponse(ctx, acct)
}

func (s *Account) List(ctx context.Context, userID uuid.UUID) ([]dto.AccountResponse, error) {
	accounts, err := s.queries.ListAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := make([]dto.AccountResponse, 0, len(accounts))
	for _, a := range accounts {
		sums, err := s.queries.GetAccountTransactionSums(ctx, a.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, listAccountToResponse(a, sums))
	}
	return result, nil
}

func (s *Account) Get(ctx context.Context, userID, accountID uuid.UUID) (*dto.AccountResponse, error) {
	acct, err := s.queries.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.toResponse(ctx, acct)
}

func (s *Account) Update(ctx context.Context, userID, accountID uuid.UUID, req dto.UpdateAccountRequest) (*dto.AccountResponse, error) {
	balance := numericFromStringOrZero(req.InitialBalance)

	acct, err := s.queries.UpdateAccount(ctx, store.UpdateAccountParams{
		ID:             accountID,
		Name:           req.Name,
		Type:           req.Type,
		InitialBalance: balance,
		UserID:         userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.toResponse(ctx, acct)
}

func (s *Account) Delete(ctx context.Context, userID, accountID uuid.UUID) error {
	return s.queries.DeleteAccount(ctx, store.DeleteAccountParams{ID: accountID, UserID: userID})
}

func listAccountToResponse(a store.ListAccountsRow, sums store.GetAccountTransactionSumsRow) dto.AccountResponse {
	balance := numericAdd(a.InitialBalance, numericSub(sums.TotalIncome, sums.TotalExpense))
	return dto.AccountResponse{
		ID:             a.ID,
		Name:           a.Name,
		Type:           a.Type,
		Currency:       a.Currency,
		InitialBalance: numericToString(a.InitialBalance),
		Balance:        numericToString(balance),
		RecentTxCount:  int(a.RecentTxCount),
		CreatedAt:      a.CreatedAt.Time,
		UpdatedAt:      a.UpdatedAt.Time,
	}
}

func (s *Account) toResponse(ctx context.Context, a store.Account) (*dto.AccountResponse, error) {
	sums, err := s.queries.GetAccountTransactionSums(ctx, a.ID)
	if err != nil {
		return nil, err
	}

	resp := accountToResponse(a, sums)
	return &resp, nil
}
