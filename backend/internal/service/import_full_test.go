package service

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

func TestParseFullImportAmount(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		decimalSep     string
		wantAbs        string
		wantIsNegative bool
		wantErr        bool
	}{
		{"positive comma decimal", "27473,95", ",", "27473.95", false, false},
		{"negative comma decimal", "-6600,00", ",", "6600.00", true, false},
		{"positive dot decimal", "27473.95", ".", "27473.95", false, false},
		{"negative dot decimal", "-6600.00", ".", "6600.00", true, false},
		{"thousands dot comma decimal", "1.000,50", ",", "1000.50", false, false},
		{"thousands comma dot decimal", "1,000.50", ".", "1000.50", false, false},
		{"large comma decimal", "237500,00", ",", "237500.00", false, false},
		{"with currency symbol", "₽1000,00", ",", "1000.00", false, false},
		{"with spaces", " -50000,00 ", ",", "50000.00", true, false},
		{"very large value dot", "99999999.99", ".", "99999999.99", false, false},
		{"negative european separators", "-1.234.567,89", ",", "1234567.89", true, false},
		{"explicit plus sign", "+50,25", ",", "50.25", false, false},
		{"decimal precision preserved", "0.1", ".", "0.1", false, false},
		{"decimal precision preserved 2", "0.2", ".", "0.2", false, false},
		{"empty", "", ",", "", false, true},
		{"not a number", "abc", ",", "", false, true},
		{"bare sign", "-", ",", "", false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotAbs, gotNeg, err := parseFullImportAmount(tt.input, tt.decimalSep)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseFullImportAmount(%q, %q) error = %v, wantErr %v", tt.input, tt.decimalSep, err, tt.wantErr)
				return
			}
			if tt.wantErr {
				return
			}
			if gotAbs != tt.wantAbs {
				t.Errorf("parseFullImportAmount(%q, %q) abs = %q, want %q", tt.input, tt.decimalSep, gotAbs, tt.wantAbs)
			}
			if gotNeg != tt.wantIsNegative {
				t.Errorf("parseFullImportAmount(%q, %q) isNegative = %v, want %v", tt.input, tt.decimalSep, gotNeg, tt.wantIsNegative)
			}
		})
	}
}

func TestImportAmountSumRoundTrip(t *testing.T) {
	// Classic float trap: 0.1 + 0.2 == 0.30000000000000004 in float64.
	// Phase 5 promises the import path preserves exact decimal arithmetic by
	// parsing strings straight into pgtype.Numeric.
	a, _, err := parseFullImportAmount("0.1", ".")
	if err != nil {
		t.Fatalf("parse 0.1: %v", err)
	}
	b, _, err := parseFullImportAmount("0.2", ".")
	if err != nil {
		t.Fatalf("parse 0.2: %v", err)
	}
	sum := numericAdd(numericFromString(a), numericFromString(b))
	if got := numericToString(sum); got != "0.30" {
		t.Errorf("0.1 + 0.2 through import path = %q, want 0.30", got)
	}
}

func TestComputeTransferRate(t *testing.T) {
	tests := []struct {
		name   string
		src    string
		dst    string
		want   string // numericToString output (2 dp) or "" for invalid
		valid  bool
	}{
		{"simple ratio", "50000", "237500", "4.75", true},
		{"fractional ratio rounds", "3", "10", "3.33", true},
		{"exact one", "100", "100", "1.00", true},
		{"sub-unit ratio", "1000", "1", "0.00", true}, // 0.001 rounded to 2dp by numericToString
		{"precise decimals", "0.3", "0.1", "0.33", true},
		{"zero source yields invalid", "0", "100", "", false},
		{"invalid input yields invalid", "abc", "100", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := computeTransferRate(tt.src, tt.dst)
			if got.Valid != tt.valid {
				t.Fatalf("valid = %v, want %v", got.Valid, tt.valid)
			}
			if !tt.valid {
				return
			}
			if s := numericToString(got); s != tt.want {
				t.Errorf("rate(%q/%q) = %q, want %q", tt.dst, tt.src, s, tt.want)
			}
		})
	}
}

func TestComputeTransferRatePrecision(t *testing.T) {
	// DivRound(_, 8) should preserve 8 decimal places internally, even though
	// numericToString truncates to 2 for display.
	got := computeTransferRate("3", "1")
	if !got.Valid {
		t.Fatalf("expected valid rate")
	}
	f := numericToBigFloat(got).Text('f', 8)
	if f != "0.33333333" {
		t.Errorf("1/3 rate = %s, want 0.33333333", f)
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
			{rowNumber: 1, account: "A", transfer: "B", absAmountStr: "1000", isNegative: true, date: dateForTest(2026, 2, 20)},
			{rowNumber: 2, account: "B", transfer: "A", absAmountStr: "1000", isNegative: false, date: dateForTest(2026, 2, 20)},
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
			{rowNumber: 1, account: "RUB Acct", transfer: "AMD Acct", absAmountStr: "50000", isNegative: true, date: dateForTest(2026, 2, 10)},
			{rowNumber: 2, account: "AMD Acct", transfer: "RUB Acct", absAmountStr: "237500", isNegative: false, date: dateForTest(2026, 2, 10)},
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
			{rowNumber: 1, account: "A", transfer: "B", absAmountStr: "1000", isNegative: true, date: dateForTest(2026, 2, 20)},
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
			{rowNumber: 1, account: "A", transfer: "B", absAmountStr: "1000", isNegative: true, date: dateForTest(2026, 2, 20)},
			{rowNumber: 2, account: "B", transfer: "A", absAmountStr: "1000", isNegative: true, date: dateForTest(2026, 2, 20)},
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
			{rowNumber: 1, account: "A", transfer: "B", absAmountStr: "1000", isNegative: true, date: dateForTest(2026, 2, 20)},
			{rowNumber: 2, account: "B", transfer: "A", absAmountStr: "1000", isNegative: false, date: dateForTest(2026, 2, 21)},
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
		account:      "Test",
		category:     "Food\\Home",
		absAmountStr: "100.50",
		isNegative:   true,
		currency:     "RUB",
		description:  "desc",
		transfer:     "",
		date:         dateForTest(2026, 2, 19),
	}
	d := parsedRowToDTO(row)
	if d.Account != "Test" {
		t.Errorf("account = %q, want Test", d.Account)
	}
	if d.Category != "Food\\Home" {
		t.Errorf("category = %q, want Food\\Home", d.Category)
	}
	if d.Total != "-100.50" {
		t.Errorf("total = %q, want -100.50", d.Total)
	}
}

func dateForTest(year, month, day int) pgtype.Date {
	return pgtype.Date{
		Time:  time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC),
		Valid: true,
	}
}
