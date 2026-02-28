package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type exportStore interface {
	ExportTransactions(ctx context.Context, arg store.ExportTransactionsParams) ([]store.ExportTransactionsRow, error)
}

type Export struct {
	queries exportStore
}

func NewExport(queries *store.Queries) *Export {
	return &Export{queries: queries}
}

func (s *Export) ExportCSV(ctx context.Context, userID uuid.UUID, dateFrom, dateTo string) ([]byte, error) {
	df, err := dateFromString(dateFrom)
	if err != nil {
		return nil, fmt.Errorf("invalid date_from: %w", err)
	}
	dt, err := dateFromString(dateTo)
	if err != nil {
		return nil, fmt.Errorf("invalid date_to: %w", err)
	}

	rows, err := s.queries.ExportTransactions(ctx, store.ExportTransactionsParams{
		UserID:   userID,
		DateFrom: df,
		DateTo:   dt,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}

	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	w.Comma = ';'

	// Header matching FullImportRow fields
	if err := w.Write([]string{"date", "account", "category", "total", "currency", "description", "transfer"}); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}

	for _, row := range rows {
		// Build category string: "Parent\Child" or just "Parent" or empty
		category := ""
		if row.CategoryName != "" {
			if row.ParentCategoryName != "" {
				category = row.ParentCategoryName + `\` + row.CategoryName
			} else {
				category = row.CategoryName
			}
		}

		// Signed amount: negative for expense, positive for income
		amount := numericToString(row.Amount)
		if row.Type == "expense" {
			amount = "-" + amount
		}

		// Date in dd.MM.yyyy format
		date := row.Date.Time.Format("02.01.2006")

		// Replace semicolons in description field to avoid breaking the delimiter (dirty hack to be compactible with homemoney incorrect CSV export format)
		description := strings.ReplaceAll(row.Description, ";", ".(semi)")

		if err := w.Write([]string{
			date,
			row.AccountName,
			category,
			amount,
			row.Currency,
			description,
			row.TransferAccountName,
		}); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return nil, fmt.Errorf("CSV write error: %w", err)
	}

	return buf.Bytes(), nil
}
