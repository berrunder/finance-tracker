package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type reportStore interface {
	SpendingByCategory(ctx context.Context, arg store.SpendingByCategoryParams) ([]store.SpendingByCategoryRow, error)
	MonthlyIncomeExpense(ctx context.Context, arg store.MonthlyIncomeExpenseParams) ([]store.MonthlyIncomeExpenseRow, error)
	BalanceHistory(ctx context.Context, arg store.BalanceHistoryParams) ([]store.BalanceHistoryRow, error)
	DashboardSummary(ctx context.Context, arg store.DashboardSummaryParams) (store.DashboardSummaryRow, error)
	ListAccounts(ctx context.Context, userID uuid.UUID) ([]store.Account, error)
	GetAccountTransactionSums(ctx context.Context, accountID uuid.UUID) (store.GetAccountTransactionSumsRow, error)
}

type Report struct {
	queries reportStore
}

func NewReport(queries *store.Queries) *Report {
	return &Report{queries: queries}
}

func parseDateRange(dateFrom, dateTo string) (pgtype.Date, pgtype.Date, error) {
	df, err := dateFromString(dateFrom)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, err
	}
	dt, err := dateFromString(dateTo)
	if err != nil {
		return pgtype.Date{}, pgtype.Date{}, err
	}
	return df, dt, nil
}

func (s *Report) Spending(ctx context.Context, userID uuid.UUID, dateFrom, dateTo string) ([]dto.SpendingByCategoryItem, error) {
	df, dt, err := parseDateRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	rows, err := s.queries.SpendingByCategory(ctx, store.SpendingByCategoryParams{
		UserID:   userID,
		DateFrom: df,
		DateTo:   dt,
	})
	if err != nil {
		return nil, err
	}

	result := make([]dto.SpendingByCategoryItem, 0, len(rows))
	for _, r := range rows {
		result = append(result, dto.SpendingByCategoryItem{
			CategoryID:   r.CategoryID,
			CategoryName: r.CategoryName,
			ParentID:     nullableToUUID(r.ParentID),
			Total:        numericToString(r.Total),
		})
	}
	return result, nil
}

func (s *Report) IncomeExpense(ctx context.Context, userID uuid.UUID, dateFrom, dateTo string) ([]dto.MonthlyIncomeExpenseItem, error) {
	df, dt, err := parseDateRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	rows, err := s.queries.MonthlyIncomeExpense(ctx, store.MonthlyIncomeExpenseParams{
		UserID:   userID,
		DateFrom: df,
		DateTo:   dt,
	})
	if err != nil {
		return nil, err
	}

	result := make([]dto.MonthlyIncomeExpenseItem, 0, len(rows))
	for _, r := range rows {
		result = append(result, dto.MonthlyIncomeExpenseItem{
			Month:   dateToString(r.Month),
			Income:  numericToString(r.Income),
			Expense: numericToString(r.Expense),
		})
	}
	return result, nil
}

func (s *Report) BalanceHistory(ctx context.Context, userID, accountID uuid.UUID, dateFrom, dateTo string) ([]dto.BalanceHistoryItem, error) {
	df, dt, err := parseDateRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	rows, err := s.queries.BalanceHistory(ctx, store.BalanceHistoryParams{
		AccountID: accountID,
		UserID:    userID,
		DateFrom:  df,
		DateTo:    dt,
	})
	if err != nil {
		return nil, err
	}

	result := make([]dto.BalanceHistoryItem, 0, len(rows))
	for _, r := range rows {
		result = append(result, dto.BalanceHistoryItem{
			Date:    dateToString(r.Date),
			Balance: numericToString(r.Balance),
		})
	}
	return result, nil
}

func (s *Report) Summary(ctx context.Context, userID uuid.UUID, dateFrom, dateTo string) (*dto.SummaryResponse, error) {
	df, dt, err := parseDateRange(dateFrom, dateTo)
	if err != nil {
		return nil, err
	}

	summary, err := s.queries.DashboardSummary(ctx, store.DashboardSummaryParams{
		UserID:   userID,
		DateFrom: df,
		DateTo:   dt,
	})
	if err != nil {
		return nil, err
	}

	accounts, err := s.queries.ListAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}

	acctResponses := make([]dto.AccountResponse, 0, len(accounts))
	for _, a := range accounts {
		sums, err := s.queries.GetAccountTransactionSums(ctx, a.ID)
		if err != nil {
			continue
		}
		acctResponses = append(acctResponses, accountToResponse(a, sums))
	}

	netIncome := numericSub(summary.TotalIncome, summary.TotalExpense)

	return &dto.SummaryResponse{
		TotalIncome:  numericToString(summary.TotalIncome),
		TotalExpense: numericToString(summary.TotalExpense),
		NetIncome:    numericToString(netIncome),
		Accounts:     acctResponses,
	}, nil
}
