package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type transactionStore interface {
	CreateTransaction(ctx context.Context, arg store.CreateTransactionParams) (store.Transaction, error)
	GetTransaction(ctx context.Context, arg store.GetTransactionParams) (store.Transaction, error)
	ListTransactions(ctx context.Context, arg store.ListTransactionsParams) ([]store.Transaction, error)
	CountTransactions(ctx context.Context, arg store.CountTransactionsParams) (int64, error)
	UpdateTransaction(ctx context.Context, arg store.UpdateTransactionParams) (store.Transaction, error)
	DeleteTransaction(ctx context.Context, arg store.DeleteTransactionParams) error
	DeleteTransactionByTransferID(ctx context.Context, arg store.DeleteTransactionByTransferIDParams) error
	GetAccount(ctx context.Context, arg store.GetAccountParams) (store.Account, error)
	WithTx(tx pgx.Tx) *store.Queries
}

type Transaction struct {
	queries transactionStore
	pool    *pgxpool.Pool
}

func NewTransaction(queries *store.Queries, pool *pgxpool.Pool) *Transaction {
	return &Transaction{queries: queries, pool: pool}
}

func (s *Transaction) Create(ctx context.Context, userID uuid.UUID, req dto.CreateTransactionRequest) (*dto.TransactionResponse, error) {
	date, err := dateFromString(req.Date)
	if err != nil {
		return nil, errors.New("invalid date format, use YYYY-MM-DD")
	}

	txn, err := s.queries.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:      userID,
		AccountID:   req.AccountID,
		CategoryID:  uuidToNullable(req.CategoryID),
		Type:        req.Type,
		Amount:      numericFromString(req.Amount),
		Description: req.Description,
		Date:        date,
	})
	if err != nil {
		return nil, err
	}

	return s.toResponse(ctx, txn), nil
}

func (s *Transaction) CreateTransfer(ctx context.Context, userID uuid.UUID, req dto.CreateTransferRequest) ([]dto.TransactionResponse, error) {
	date, err := dateFromString(req.Date)
	if err != nil {
		return nil, errors.New("invalid date format, use YYYY-MM-DD")
	}

	transferID := uuid.New()
	amount := numericFromString(req.Amount)
	toAmount := numericFromString(req.ToAmount)
	if !toAmount.Valid {
		toAmount = amount
	}
	exchangeRate := numericFromString(req.ExchangeRate)

	description := req.Description
	if description == "" {
		description = "Transfer"
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	q := s.queries.WithTx(tx)

	// Source: expense from source account
	srcTxn, err := q.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:       userID,
		AccountID:    req.FromAccountID,
		Type:         "expense",
		Amount:       amount,
		Description:  description,
		Date:         date,
		TransferID:   pgtype.UUID{Bytes: transferID, Valid: true},
		ExchangeRate: exchangeRate,
	})
	if err != nil {
		return nil, err
	}

	// Destination: income to destination account
	dstTxn, err := q.CreateTransaction(ctx, store.CreateTransactionParams{
		UserID:       userID,
		AccountID:    req.ToAccountID,
		Type:         "income",
		Amount:       toAmount,
		Description:  description,
		Date:         date,
		TransferID:   pgtype.UUID{Bytes: transferID, Valid: true},
		ExchangeRate: exchangeRate,
	})
	if err != nil {
		return nil, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return nil, err
	}

	return []dto.TransactionResponse{
		*s.toResponse(ctx, srcTxn),
		*s.toResponse(ctx, dstTxn),
	}, nil
}

func (s *Transaction) List(ctx context.Context, userID uuid.UUID, params ListTransactionsParams) (*dto.PaginatedResponse, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PerPage < 1 || params.PerPage > 100 {
		params.PerPage = 20
	}

	offset := int32((params.Page - 1) * params.PerPage)

	var accountID pgtype.UUID
	if params.AccountID != nil {
		accountID = pgtype.UUID{Bytes: *params.AccountID, Valid: true}
	}
	var categoryID pgtype.UUID
	if params.CategoryID != nil {
		categoryID = pgtype.UUID{Bytes: *params.CategoryID, Valid: true}
	}
	var txnType pgtype.Text
	if params.Type != "" {
		txnType = pgtype.Text{String: params.Type, Valid: true}
	}
	var dateFrom, dateTo pgtype.Date
	if params.DateFrom != "" {
		d, err := dateFromString(params.DateFrom)
		if err == nil {
			dateFrom = d
		}
	}
	if params.DateTo != "" {
		d, err := dateFromString(params.DateTo)
		if err == nil {
			dateTo = d
		}
	}

	storeParams := store.ListTransactionsParams{
		UserID:     userID,
		AccountID:  accountID,
		CategoryID: categoryID,
		Type:       txnType,
		DateFrom:   dateFrom,
		DateTo:     dateTo,
		Off:        offset,
		Lim:        int32(params.PerPage),
	}

	txns, err := s.queries.ListTransactions(ctx, storeParams)
	if err != nil {
		return nil, err
	}

	total, err := s.queries.CountTransactions(ctx, store.CountTransactionsParams{
		UserID:     userID,
		AccountID:  accountID,
		CategoryID: categoryID,
		Type:       txnType,
		DateFrom:   dateFrom,
		DateTo:     dateTo,
	})
	if err != nil {
		return nil, err
	}

	result := make([]dto.TransactionResponse, 0, len(txns))
	for _, t := range txns {
		result = append(result, *s.toResponse(ctx, t))
	}

	return &dto.PaginatedResponse{
		Data: result,
		Pagination: dto.Pagination{
			Page:    params.Page,
			PerPage: params.PerPage,
			Total:   total,
		},
	}, nil
}

func (s *Transaction) Get(ctx context.Context, userID, txnID uuid.UUID) (*dto.TransactionResponse, error) {
	txn, err := s.queries.GetTransaction(ctx, store.GetTransactionParams{ID: txnID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.toResponse(ctx, txn), nil
}

func (s *Transaction) Update(ctx context.Context, userID, txnID uuid.UUID, req dto.UpdateTransactionRequest) (*dto.TransactionResponse, error) {
	date, err := dateFromString(req.Date)
	if err != nil {
		return nil, errors.New("invalid date format, use YYYY-MM-DD")
	}

	txn, err := s.queries.UpdateTransaction(ctx, store.UpdateTransactionParams{
		ID:          txnID,
		AccountID:   req.AccountID,
		CategoryID:  uuidToNullable(req.CategoryID),
		Type:        req.Type,
		Amount:      numericFromString(req.Amount),
		Description: req.Description,
		Date:        date,
		UserID:      userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.toResponse(ctx, txn), nil
}

func (s *Transaction) Delete(ctx context.Context, userID, txnID uuid.UUID) error {
	// If this is a transfer, delete the linked transaction too
	txn, err := s.queries.GetTransaction(ctx, store.GetTransactionParams{ID: txnID, UserID: userID})
	if err != nil {
		return err
	}

	if txn.TransferID.Valid {
		if err := s.queries.DeleteTransactionByTransferID(ctx, store.DeleteTransactionByTransferIDParams{
			TransferID: txn.TransferID,
			UserID:     userID,
		}); err != nil {
			return err
		}
	}

	return s.queries.DeleteTransaction(ctx, store.DeleteTransactionParams{ID: txnID, UserID: userID})
}

func (s *Transaction) toResponse(ctx context.Context, t store.Transaction) *dto.TransactionResponse {
	// Look up currency from account
	currency := ""
	acct, err := s.queries.GetAccount(ctx, store.GetAccountParams{ID: t.AccountID, UserID: t.UserID})
	if err == nil {
		currency = acct.Currency
	}

	resp := &dto.TransactionResponse{
		ID:          t.ID,
		AccountID:   t.AccountID,
		CategoryID:  nullableToUUID(t.CategoryID),
		Type:        t.Type,
		Amount:      numericToString(t.Amount),
		Currency:    currency,
		Description: t.Description,
		Date:        dateToString(t.Date),
		TransferID:  nullableToUUID(t.TransferID),
		CreatedAt:   t.CreatedAt.Time,
		UpdatedAt:   t.UpdatedAt.Time,
	}

	if t.ExchangeRate.Valid {
		rate := numericToString(t.ExchangeRate)
		resp.ExchangeRate = &rate
	}

	return resp
}

type ListTransactionsParams struct {
	AccountID  *uuid.UUID
	CategoryID *uuid.UUID
	Type       string
	DateFrom   string
	DateTo     string
	Page       int
	PerPage    int
}
