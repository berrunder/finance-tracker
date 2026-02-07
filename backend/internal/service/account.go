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

type Account struct {
	queries *store.Queries
}

func NewAccount(queries *store.Queries) *Account {
	return &Account{queries: queries}
}

func (s *Account) Create(ctx context.Context, userID uuid.UUID, req dto.CreateAccountRequest) (*dto.AccountResponse, error) {
	balance := numericFromString(req.InitialBalance)
	if !balance.Valid {
		balance = numericFromString("0")
	}

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
		r, err := s.toResponse(ctx, a)
		if err != nil {
			return nil, err
		}
		result = append(result, *r)
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
	balance := numericFromString(req.InitialBalance)
	if !balance.Valid {
		balance = numericFromString("0")
	}

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

func (s *Account) toResponse(ctx context.Context, a store.Account) (*dto.AccountResponse, error) {
	sums, err := s.queries.GetAccountTransactionSums(ctx, a.ID)
	if err != nil {
		return nil, err
	}

	balance := numericAdd(a.InitialBalance, numericSub(sums.TotalIncome, sums.TotalExpense))

	return &dto.AccountResponse{
		ID:             a.ID,
		Name:           a.Name,
		Type:           a.Type,
		Currency:       a.Currency,
		InitialBalance: numericToString(a.InitialBalance),
		Balance:        numericToString(balance),
		CreatedAt:      a.CreatedAt.Time,
		UpdatedAt:      a.UpdatedAt.Time,
	}, nil
}
