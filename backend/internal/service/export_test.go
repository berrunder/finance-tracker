package service

import (
	"context"
	"encoding/csv"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

func TestSanitizeCSVField(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty", "", ""},
		{"plain text", "hello", "hello"},
		{"equals formula", "=1+1", "'=1+1"},
		{"plus formula", "+1+1", "'+1+1"},
		{"minus text", "-foo", "'-foo"},
		{"at sign", "@SUM(A1)", "'@SUM(A1)"},
		{"tab prefix", "\tcmd", "'\tcmd"},
		{"cr prefix", "\rcmd", "'\rcmd"},
		{"cmd injection", "=1+1+cmd|' /C calc'!A1", "'=1+1+cmd|' /C calc'!A1"},
		{"negative number", "-123.45", "'-123.45"},
		{"normal number", "123.45", "123.45"},
		{"dash in middle", "foo-bar", "foo-bar"},
		{"equals in middle", "foo=bar", "foo=bar"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeCSVField(tt.input)
			require.Equal(t, tt.want, got)
		})
	}
}

type mockExportStore struct {
	exportTransactionsFn func(ctx context.Context, arg store.ExportTransactionsParams) ([]store.ExportTransactionsRow, error)
}

func (m *mockExportStore) ExportTransactions(ctx context.Context, arg store.ExportTransactionsParams) ([]store.ExportTransactionsRow, error) {
	return m.exportTransactionsFn(ctx, arg)
}

func TestExportCSV_SanitizesFormulaInjection(t *testing.T) {
	date, _ := time.Parse("2006-01-02", "2024-01-15")
	svc := &Export{queries: &mockExportStore{
		exportTransactionsFn: func(_ context.Context, _ store.ExportTransactionsParams) ([]store.ExportTransactionsRow, error) {
			return []store.ExportTransactionsRow{
				{
					Date:                pgtype.Date{Time: date, Valid: true},
					AccountName:         "=1+1",
					ParentCategoryName:  "",
					CategoryName:        "+SUM(A1)",
					Type:                "expense",
					Amount:              numericFromString("100.50"),
					Currency:            "USD",
					Description:         "=1+1+cmd|' /C calc'!A1",
					TransferAccountName: "@evil",
				},
			}, nil
		},
	}}

	data, err := svc.ExportCSV(context.Background(), uuid.New(), "2024-01-01", "2024-12-31")
	require.NoError(t, err)

	r := csv.NewReader(strings.NewReader(string(data)))
	r.Comma = ';'

	records, err := r.ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2) // header + 1 row

	row := records[1]
	// account (index 1)
	require.Equal(t, "'=1+1", row[1], "account name should be sanitized")
	// category (index 2)
	require.Equal(t, "'+SUM(A1)", row[2], "category should be sanitized")
	// amount (index 3) — NOT sanitized, stays as-is with leading minus
	require.Equal(t, "-100.50", row[3], "amount should not be sanitized")
	// description (index 5)
	require.True(t, strings.HasPrefix(row[5], "'"), "description with formula should start with apostrophe")
	// transfer account (index 6)
	require.Equal(t, "'@evil", row[6], "transfer account should be sanitized")
}
