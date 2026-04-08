package service

import (
	"context"
	"time"

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
	ListAccounts(ctx context.Context, userID uuid.UUID) ([]store.ListAccountsRow, error)
	GetAccountTransactionSums(ctx context.Context, accountID uuid.UUID) (store.GetAccountTransactionSumsRow, error)
	ListTransactionYears(ctx context.Context, userID uuid.UUID) ([]int32, error)
	CashFlowCategoryMonthly(ctx context.Context, arg store.CashFlowCategoryMonthlyParams) ([]store.CashFlowCategoryMonthlyRow, error)
	CashFlowAccountOpeningBalances(ctx context.Context, arg store.CashFlowAccountOpeningBalancesParams) ([]store.CashFlowAccountOpeningBalancesRow, error)
	CashFlowAccountMonthlyChanges(ctx context.Context, arg store.CashFlowAccountMonthlyChangesParams) ([]store.CashFlowAccountMonthlyChangesRow, error)
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
		acctResponses = append(acctResponses, listAccountToResponse(a, sums))
	}

	netIncome := numericSub(summary.TotalIncome, summary.TotalExpense)

	return &dto.SummaryResponse{
		TotalIncome:  numericToString(summary.TotalIncome),
		TotalExpense: numericToString(summary.TotalExpense),
		NetIncome:    numericToString(netIncome),
		Accounts:     acctResponses,
	}, nil
}

func (s *Report) CashFlowYears(ctx context.Context, userID uuid.UUID) ([]int, error) {
	rows, err := s.queries.ListTransactionYears(ctx, userID)
	if err != nil {
		return nil, err
	}
	years := make([]int, 0, len(rows))
	for _, y := range rows {
		years = append(years, int(y))
	}
	return years, nil
}

func (s *Report) CashFlow(ctx context.Context, userID uuid.UUID, year int) (*dto.CashFlowResponse, error) {
	df := pgtype.Date{Time: time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC), Valid: true}
	dt := pgtype.Date{Time: time.Date(year, time.December, 31, 0, 0, 0, 0, time.UTC), Valid: true}

	categoryRows, err := s.queries.CashFlowCategoryMonthly(ctx, store.CashFlowCategoryMonthlyParams{
		UserID:   userID,
		DateFrom: df,
		DateTo:   dt,
	})
	if err != nil {
		return nil, err
	}

	openingRows, err := s.queries.CashFlowAccountOpeningBalances(ctx, store.CashFlowAccountOpeningBalancesParams{
		DateFrom: df,
		UserID:   userID,
	})
	if err != nil {
		return nil, err
	}

	changeRows, err := s.queries.CashFlowAccountMonthlyChanges(ctx, store.CashFlowAccountMonthlyChangesParams{
		UserID:   userID,
		DateFrom: df,
		DateTo:   dt,
	})
	if err != nil {
		return nil, err
	}

	categoryItems := make([]dto.CashFlowCategoryItem, 0, len(categoryRows))
	for _, r := range categoryRows {
		categoryItems = append(categoryItems, dto.CashFlowCategoryItem{
			CategoryID: nullableToUUID(r.CategoryID),
			Type:       r.Type,
			Month:      dateToString(r.Month),
			Currency:   r.Currency,
			Amount:     numericToString(r.Amount),
		})
	}

	openingItems := make([]dto.CashFlowAccountOpening, 0, len(openingRows))
	for _, r := range openingRows {
		openingItems = append(openingItems, dto.CashFlowAccountOpening{
			AccountID:      r.AccountID,
			Currency:       r.Currency,
			OpeningBalance: numericToString(r.OpeningBalance),
		})
	}

	changeItems := make([]dto.CashFlowAccountChange, 0, len(changeRows))
	for _, r := range changeRows {
		changeItems = append(changeItems, dto.CashFlowAccountChange{
			AccountID: r.AccountID,
			Currency:  r.Currency,
			Month:     dateToString(r.Month),
			NetChange: numericToString(r.NetChange),
		})
	}

	return &dto.CashFlowResponse{
		Year:            year,
		CategoryMonthly: categoryItems,
		OpeningBalances: openingItems,
		MonthlyChanges:  changeItems,
	}, nil
}
