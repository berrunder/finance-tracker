package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type Report struct {
	queries *store.Queries
}

func NewReport(queries *store.Queries) *Report {
	return &Report{queries: queries}
}

func (s *Report) Spending(ctx context.Context, userID uuid.UUID, dateFrom, dateTo string) ([]dto.SpendingByCategoryItem, error) {
	df, err := dateFromString(dateFrom)
	if err != nil {
		return nil, err
	}
	dt, err := dateFromString(dateTo)
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
	df, err := dateFromString(dateFrom)
	if err != nil {
		return nil, err
	}
	dt, err := dateFromString(dateTo)
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
	df, err := dateFromString(dateFrom)
	if err != nil {
		return nil, err
	}
	dt, err := dateFromString(dateTo)
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
	df, err := dateFromString(dateFrom)
	if err != nil {
		return nil, err
	}
	dt, err := dateFromString(dateTo)
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
		balance := numericAdd(a.InitialBalance, numericSub(sums.TotalIncome, sums.TotalExpense))
		acctResponses = append(acctResponses, dto.AccountResponse{
			ID:             a.ID,
			Name:           a.Name,
			Type:           a.Type,
			Currency:       a.Currency,
			InitialBalance: numericToString(a.InitialBalance),
			Balance:        numericToString(balance),
			CreatedAt:      a.CreatedAt.Time,
			UpdatedAt:      a.UpdatedAt.Time,
		})
	}

	netIncome := numericSub(summary.TotalIncome, summary.TotalExpense)

	return &dto.SummaryResponse{
		TotalIncome:  numericToString(summary.TotalIncome),
		TotalExpense: numericToString(summary.TotalExpense),
		NetIncome:    numericToString(netIncome),
		Accounts:     acctResponses,
	}, nil
}

// Unused import suppression for pgtype
var _ pgtype.Date
