package service

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

func TestParseFullImportAmount(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		decimalSep string
		want       float64
		wantErr    bool
	}{
		{"positive comma decimal", "27473,95", ",", 27473.95, false},
		{"negative comma decimal", "-6600,00", ",", -6600.00, false},
		{"positive dot decimal", "27473.95", ".", 27473.95, false},
		{"negative dot decimal", "-6600.00", ".", -6600.00, false},
		{"thousands dot comma decimal", "1.000,50", ",", 1000.50, false},
		{"thousands comma dot decimal", "1,000.50", ".", 1000.50, false},
		{"large comma decimal", "237500,00", ",", 237500.00, false},
		{"with currency symbol", "₽1000,00", ",", 1000.00, false},
		{"with spaces", " -50000,00 ", ",", -50000.00, false},
		{"empty", "", ",", 0, true},
		{"not a number", "abc", ",", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseFullImportAmount(tt.input, tt.decimalSep)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseFullImportAmount(%q, %q) error = %v, wantErr %v", tt.input, tt.decimalSep, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("parseFullImportAmount(%q, %q) = %v, want %v", tt.input, tt.decimalSep, got, tt.want)
			}
		})
	}
}

func TestParseFullImportDate(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		format   string
		wantDay  int
		wantErr  bool
	}{
		{"dd.MM.yyyy", "19.02.2026", "02.01.2006", 19, false},
		{"yyyy-MM-dd", "2026-02-19", "2006-01-02", 19, false},
		{"dd/MM/yyyy", "19/02/2026", "02/01/2006", 19, false},
		{"MM/dd/yyyy", "02/19/2026", "01/02/2006", 19, false},
		{"invalid", "not-a-date", "02.01.2006", 0, true},
		{"wrong format", "19.02.2026", "2006-01-02", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseFullImportDate(tt.input, tt.format)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseFullImportDate(%q, %q) error = %v, wantErr %v", tt.input, tt.format, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.Time.Day() != tt.wantDay {
				t.Errorf("parseFullImportDate(%q, %q) day = %v, want %v", tt.input, tt.format, got.Time.Day(), tt.wantDay)
			}
		})
	}
}

func TestConvertDateFormat(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"dd.MM.yyyy", "02.01.2006"},
		{"yyyy-MM-dd", "2006-01-02"},
		{"dd/MM/yyyy", "02/01/2006"},
		{"MM/dd/yyyy", "01/02/2006"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := convertDateFormat(tt.input)
			if got != tt.want {
				t.Errorf("convertDateFormat(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestResolveCurrency(t *testing.T) {
	currencies := []store.Currency{
		{Code: "RUB", Name: "Russian Ruble", Symbol: "₽"},
		{Code: "AMD", Name: "Armenian Dram", Symbol: "դր."},
		{Code: "USD", Name: "US Dollar", Symbol: "$"},
	}

	tests := []struct {
		name    string
		raw     string
		mapping map[string]string
		want    string
		wantErr bool
	}{
		{"code match", "RUB", nil, "RUB", false},
		{"code case insensitive", "rub", nil, "RUB", false},
		{"symbol match", "դր.", nil, "AMD", false},
		{"mapping override", "руб", map[string]string{"руб": "RUB"}, "RUB", false},
		{"unknown", "XYZ", nil, "", true},
		{"empty", "", nil, "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := resolveCurrency(tt.raw, tt.mapping, currencies)
			if (err != nil) != tt.wantErr {
				t.Errorf("resolveCurrency(%q) error = %v, wantErr %v", tt.raw, err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("resolveCurrency(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestPairTransfers(t *testing.T) {
	t.Run("same currency pair", func(t *testing.T) {
		candidates := []parsedRow{
			{rowNumber: 1, account: "A", transfer: "B", amount: -1000, date: dateForTest(2026, 2, 20)},
			{rowNumber: 2, account: "B", transfer: "A", amount: 1000, date: dateForTest(2026, 2, 20)},
		}
		pairs, failures := pairTransfers(candidates)
		if len(pairs) != 1 {
			t.Fatalf("expected 1 pair, got %d", len(pairs))
		}
		if len(failures) != 0 {
			t.Fatalf("expected 0 failures, got %d", len(failures))
		}
		if pairs[0].source.account != "A" {
			t.Errorf("source should be A (negative amount), got %s", pairs[0].source.account)
		}
		if pairs[0].dest.account != "B" {
			t.Errorf("dest should be B (positive amount), got %s", pairs[0].dest.account)
		}
	})

	t.Run("multi-currency pair", func(t *testing.T) {
		candidates := []parsedRow{
			{rowNumber: 1, account: "RUB Acct", transfer: "AMD Acct", amount: -50000, date: dateForTest(2026, 2, 10)},
			{rowNumber: 2, account: "AMD Acct", transfer: "RUB Acct", amount: 237500, date: dateForTest(2026, 2, 10)},
		}
		pairs, failures := pairTransfers(candidates)
		if len(pairs) != 1 {
			t.Fatalf("expected 1 pair, got %d", len(pairs))
		}
		if len(failures) != 0 {
			t.Fatalf("expected 0 failures, got %d", len(failures))
		}
	})

	t.Run("unpaired row", func(t *testing.T) {
		candidates := []parsedRow{
			{rowNumber: 1, account: "A", transfer: "B", amount: -1000, date: dateForTest(2026, 2, 20)},
		}
		pairs, failures := pairTransfers(candidates)
		if len(pairs) != 0 {
			t.Fatalf("expected 0 pairs, got %d", len(pairs))
		}
		if len(failures) != 1 {
			t.Fatalf("expected 1 failure, got %d", len(failures))
		}
		if failures[0].Error != "transfer pair not found" {
			t.Errorf("expected 'transfer pair not found', got %q", failures[0].Error)
		}
	})

	t.Run("same sign error", func(t *testing.T) {
		candidates := []parsedRow{
			{rowNumber: 1, account: "A", transfer: "B", amount: -1000, date: dateForTest(2026, 2, 20)},
			{rowNumber: 2, account: "B", transfer: "A", amount: -1000, date: dateForTest(2026, 2, 20)},
		}
		pairs, failures := pairTransfers(candidates)
		if len(pairs) != 0 {
			t.Fatalf("expected 0 pairs, got %d", len(pairs))
		}
		if len(failures) != 2 {
			t.Fatalf("expected 2 failures, got %d", len(failures))
		}
	})

	t.Run("date mismatch no pair", func(t *testing.T) {
		candidates := []parsedRow{
			{rowNumber: 1, account: "A", transfer: "B", amount: -1000, date: dateForTest(2026, 2, 20)},
			{rowNumber: 2, account: "B", transfer: "A", amount: 1000, date: dateForTest(2026, 2, 21)},
		}
		pairs, failures := pairTransfers(candidates)
		if len(pairs) != 0 {
			t.Fatalf("expected 0 pairs, got %d", len(pairs))
		}
		if len(failures) != 2 {
			t.Fatalf("expected 2 failures, got %d", len(failures))
		}
	})
}

func TestParsedRowToDTO(t *testing.T) {
	row := &parsedRow{
		account:     "Test",
		category:    "Food\\Home",
		amount:      -100.50,
		currency:    "RUB",
		description: "desc",
		transfer:    "",
		date:        dateForTest(2026, 2, 19),
	}
	d := parsedRowToDTO(row)
	if d.Account != "Test" {
		t.Errorf("account = %q, want Test", d.Account)
	}
	if d.Category != "Food\\Home" {
		t.Errorf("category = %q, want Food\\Home", d.Category)
	}
}

func dateForTest(year, month, day int) pgtype.Date {
	return pgtype.Date{
		Time:  time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC),
		Valid: true,
	}
}
