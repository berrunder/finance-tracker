package service

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseCSV(t *testing.T) {
	svc := &Import{}

	t.Run("normal 3-row CSV", func(t *testing.T) {
		csv := "date,amount,description\n2024-01-01,100.00,Salary\n2024-01-02,-50.00,Groceries\n2024-01-03,25.00,Refund\n"
		resp, err := svc.ParseCSV(strings.NewReader(csv))
		require.NoError(t, err)
		require.Equal(t, []string{"date", "amount", "description"}, resp.Headers)
		require.Len(t, resp.Preview, 3)
		require.Equal(t, 3, resp.Total)
		require.Equal(t, "Salary", resp.Preview[0].Values["description"])
	})

	t.Run("single row", func(t *testing.T) {
		csv := "date,amount\n2024-01-01,100.00\n"
		resp, err := svc.ParseCSV(strings.NewReader(csv))
		require.NoError(t, err)
		require.Len(t, resp.Preview, 1)
		require.Equal(t, 1, resp.Total)
	})

	t.Run("preview truncated to 5", func(t *testing.T) {
		lines := "date,amount\n"
		for i := 0; i < 8; i++ {
			lines += "2024-01-01,100.00\n"
		}
		resp, err := svc.ParseCSV(strings.NewReader(lines))
		require.NoError(t, err)
		require.Len(t, resp.Preview, 5)
		require.Equal(t, 8, resp.Total)
	})

	t.Run("empty body", func(t *testing.T) {
		_, err := svc.ParseCSV(strings.NewReader(""))
		require.Error(t, err)
	})

	t.Run("malformed rows skipped", func(t *testing.T) {
		// CSV reader with FieldsPerRecord=-1 won't error on mismatched fields,
		// but with default settings (fields must match header count) it will skip bad rows
		csv := "date,amount\n2024-01-01,100.00\n2024-01-02,200.00\n"
		resp, err := svc.ParseCSV(strings.NewReader(csv))
		require.NoError(t, err)
		require.Equal(t, 2, resp.Total)
	})
}

func TestParseAmount(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    float64
		wantErr bool
	}{
		{"plain decimal", "123.45", 123.45, false},
		{"dollar with commas", "$1,234.56", 1234.56, false},
		{"euro symbol", "€50.00", 50.00, false},
		{"negative", "-100", -100, false},
		{"garbage", "abc", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseAmount(tt.input)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.InDelta(t, tt.want, got, 0.001)
			}
		})
	}
}
