package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type importFullStore interface {
	GetAccountByName(ctx context.Context, arg store.GetAccountByNameParams) (store.Account, error)
	CreateAccount(ctx context.Context, arg store.CreateAccountParams) (store.Account, error)
	ListCurrencies(ctx context.Context) ([]store.Currency, error)
	CreateCurrency(ctx context.Context, arg store.CreateCurrencyParams) (store.Currency, error)
	GetCategoryByNameAndType(ctx context.Context, arg store.GetCategoryByNameAndTypeParams) (store.Category, error)
	GetSubcategoryByNameAndType(ctx context.Context, arg store.GetSubcategoryByNameAndTypeParams) (store.Category, error)
	CreateCategory(ctx context.Context, arg store.CreateCategoryParams) (store.Category, error)
	BulkCreateTransactionsFull(ctx context.Context, arg []store.BulkCreateTransactionsFullParams) (int64, error)
}

type ImportFull struct {
	queries importFullStore
	pool    *pgxpool.Pool
}

func NewImportFull(queries *store.Queries, pool *pgxpool.Pool) *ImportFull {
	return &ImportFull{queries: queries, pool: pool}
}

// parsedRow holds a fully parsed CSV row ready for DB insertion.
type parsedRow struct {
	rowNumber   int
	date        pgtype.Date
	account     string
	category    string // raw "Parent\Child" or empty
	amount      float64
	absAmount   pgtype.Numeric
	currency    string // resolved currency code
	description string
	transfer    string // target account name, empty for non-transfers
	txnType     string // "income" or "expense"
}

// transferPair holds two matched transfer rows.
type transferPair struct {
	source *parsedRow
	dest   *parsedRow
}

type transactionInsertRow struct {
	rowNumber int
	data      dto.FullImportRow
	param     store.BulkCreateTransactionsFullParams
}

func (s *ImportFull) Import(ctx context.Context, userID uuid.UUID, req dto.FullImportRequest) (*dto.FullImportResponse, error) {
	// Load all currencies for resolution
	allCurrencies, err := s.queries.ListCurrencies(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list currencies: %w", err)
	}

	// Start a transaction for all create operations
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()
	q := store.New(tx)

	resp := &dto.FullImportResponse{}

	// Step 1: Create new currencies
	for _, nc := range req.NewCurrencies {
		_, createErr := q.CreateCurrency(ctx, store.CreateCurrencyParams{
			Code:   nc.Code,
			Name:   nc.Name,
			Symbol: nc.Symbol,
		})
		if createErr != nil {
			return nil, fmt.Errorf("failed to create currency %s: %w", nc.Code, createErr)
		}
		resp.CurrenciesCreated = append(resp.CurrenciesCreated, nc.Code)
		allCurrencies = append(allCurrencies, store.Currency{Code: nc.Code, Name: nc.Name, Symbol: nc.Symbol})
	}

	// Step 2: Parse all rows
	goDateFormat := convertDateFormat(req.DateFormat)
	var validRows []parsedRow
	for i, row := range req.Rows {
		parsed, parseErr := s.parseRow(i+1, row, goDateFormat, req.DecimalSeparator, req.CurrencyMapping, allCurrencies)
		if parseErr != nil {
			resp.FailedRows = append(resp.FailedRows, dto.FailedRow{
				RowNumber: i + 1,
				Data:      row,
				Error:     parseErr.Error(),
			})
			continue
		}
		validRows = append(validRows, *parsed)
	}

	// Step 3: Separate regular rows from transfer candidates, pair transfers
	var regularRows []parsedRow
	var transferCandidates []parsedRow
	for _, row := range validRows {
		if row.transfer != "" {
			transferCandidates = append(transferCandidates, row)
		} else {
			regularRows = append(regularRows, row)
		}
	}

	pairs, unpairedErrors := pairTransfers(transferCandidates)
	resp.FailedRows = append(resp.FailedRows, unpairedErrors...)

	// Collect all rows that will be imported (regular + paired transfers) for account resolution
	allParsedRows := make([]parsedRow, 0, len(regularRows)+(len(pairs)*2))
	allParsedRows = append(allParsedRows, regularRows...)
	for _, pair := range pairs {
		allParsedRows = append(allParsedRows, *pair.source, *pair.dest)
	}

	// Step 4: Resolve accounts (lookup existing or create new)
	accountCache := make(map[string]store.Account)
	for _, row := range allParsedRows {
		acctNames := []string{row.account}
		if row.transfer != "" {
			acctNames = append(acctNames, row.transfer)
		}
		for _, name := range acctNames {
			if _, ok := accountCache[name]; ok {
				continue
			}
			acct, lookupErr := q.GetAccountByName(ctx, store.GetAccountByNameParams{
				UserID: userID,
				Name:   name,
			})
			if lookupErr == nil {
				accountCache[name] = acct
				continue
			}
			if !errors.Is(lookupErr, pgx.ErrNoRows) {
				return nil, fmt.Errorf("failed to lookup account %s: %w", name, lookupErr)
			}
			currency := findCurrencyForAccount(name, allParsedRows)
			newAcct, createErr := q.CreateAccount(ctx, store.CreateAccountParams{
				UserID:         userID,
				Name:           name,
				Type:           "bank",
				Currency:       currency,
				InitialBalance: numericFromString("0"),
			})
			if createErr != nil {
				return nil, fmt.Errorf("failed to create account %s: %w", name, createErr)
			}
			accountCache[name] = newAcct
			resp.AccountsCreated = append(resp.AccountsCreated, name)
		}
	}

	// Validate account-currency consistency, filtering out mismatched rows
	regularRows = filterByCurrency(regularRows, accountCache, resp)
	// For transfers, validate both legs; fail the entire pair if either leg mismatches
	var validPairs []transferPair
	for _, pair := range pairs {
		sourceAcct := accountCache[pair.source.account]
		destAcct := accountCache[pair.dest.account]
		if sourceAcct.Currency != pair.source.currency {
			resp.FailedRows = append(resp.FailedRows, dto.FailedRow{
				RowNumber: pair.source.rowNumber,
				Data:      parsedRowToDTO(pair.source),
				Error:     fmt.Sprintf("currency mismatch: account %q has currency %s but row has %s", pair.source.account, sourceAcct.Currency, pair.source.currency),
			})
			continue
		}
		if destAcct.Currency != pair.dest.currency {
			resp.FailedRows = append(resp.FailedRows, dto.FailedRow{
				RowNumber: pair.dest.rowNumber,
				Data:      parsedRowToDTO(pair.dest),
				Error:     fmt.Sprintf("currency mismatch: account %q has currency %s but row has %s", pair.dest.account, destAcct.Currency, pair.dest.currency),
			})
			continue
		}
		validPairs = append(validPairs, pair)
	}
	pairs = validPairs

	// Step 5: Resolve categories
	categoryCache := make(map[string]uuid.UUID) // "category_string|type" -> ID
	for i := range regularRows {
		row := &regularRows[i]
		if row.category == "" {
			continue
		}
		cacheKey := row.category + "|" + row.txnType
		if _, ok := categoryCache[cacheKey]; ok {
			continue
		}
		catID, createdNames, catErr := s.resolveCategory(ctx, q, userID, row.category, row.txnType)
		if catErr != nil {
			return nil, fmt.Errorf("failed to resolve category %q: %w", row.category, catErr)
		}
		categoryCache[cacheKey] = catID
		resp.CategoriesCreated = append(resp.CategoriesCreated, createdNames...)
	}

	// Step 6: Build transaction params with original row context
	var allRows []transactionInsertRow

	// Regular transactions
	for _, row := range regularRows {
		catID := pgtype.UUID{Valid: false}
		if row.category != "" {
			cacheKey := row.category + "|" + row.txnType
			if id, ok := categoryCache[cacheKey]; ok {
				catID = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		allRows = append(allRows, transactionInsertRow{
			rowNumber: row.rowNumber,
			data:      parsedRowToDTO(&row),
			param: store.BulkCreateTransactionsFullParams{
				UserID:       userID,
				AccountID:    accountCache[row.account].ID,
				CategoryID:   catID,
				Type:         row.txnType,
				Amount:       row.absAmount,
				Description:  row.description,
				Date:         row.date,
				TransferID:   pgtype.UUID{Valid: false},
				ExchangeRate: pgtype.Numeric{Valid: false},
			},
		})
	}

	// Transfer transactions
	for _, pair := range pairs {
		transferID := uuid.New()
		tidPG := pgtype.UUID{Bytes: transferID, Valid: true}

		// Compute exchange rate for cross-currency transfers
		exchangeRate := pgtype.Numeric{Valid: false}
		sourceAcct := accountCache[pair.source.account]
		destAcct := accountCache[pair.dest.account]
		if sourceAcct.Currency != destAcct.Currency {
			rate := math.Abs(pair.dest.amount) / math.Abs(pair.source.amount)
			exchangeRate = numericFromString(strconv.FormatFloat(rate, 'f', 8, 64))
		}

		// Source leg (expense)
		allRows = append(allRows, transactionInsertRow{
			rowNumber: pair.source.rowNumber,
			data:      parsedRowToDTO(pair.source),
			param: store.BulkCreateTransactionsFullParams{
				UserID:       userID,
				AccountID:    sourceAcct.ID,
				CategoryID:   pgtype.UUID{Valid: false},
				Type:         "expense",
				Amount:       pair.source.absAmount,
				Description:  pair.source.description,
				Date:         pair.source.date,
				TransferID:   tidPG,
				ExchangeRate: exchangeRate,
			},
		})

		// Dest leg (income)
		allRows = append(allRows, transactionInsertRow{
			rowNumber: pair.dest.rowNumber,
			data:      parsedRowToDTO(pair.dest),
			param: store.BulkCreateTransactionsFullParams{
				UserID:       userID,
				AccountID:    destAcct.ID,
				CategoryID:   pgtype.UUID{Valid: false},
				Type:         "income",
				Amount:       pair.dest.absAmount,
				Description:  pair.dest.description,
				Date:         pair.dest.date,
				TransferID:   tidPG,
				ExchangeRate: exchangeRate,
			},
		})
	}

	// Step 7: Batch insert
	slog.Info("import: starting batch insert", "total_rows", len(allRows), "regular", len(regularRows), "transfer_pairs", len(pairs))
	const batchSize = 1000
	for i := 0; i < len(allRows); i += batchSize {
		batchRows := allRows[i:min(i+batchSize, len(allRows))]
		params := make([]store.BulkCreateTransactionsFullParams, len(batchRows))
		for j, row := range batchRows {
			params[j] = row.param
		}
		count, batchErr := q.BulkCreateTransactionsFull(ctx, params)
		if batchErr != nil {
			slog.Error("import: batch insert failed",
				"error", batchErr,
				"batch_offset", i,
				"batch_size", len(batchRows),
			)
			// Log first few rows from the failed batch for debugging
			for j, row := range batchRows {
				if j >= 3 {
					break
				}
				slog.Error("import: sample failed row",
					"row_number", row.rowNumber,
					"account_id", row.param.AccountID,
					"category_id", row.param.CategoryID,
					"type", row.param.Type,
					"amount", row.param.Amount,
					"date", row.param.Date,
					"transfer_id", row.param.TransferID,
					"exchange_rate", row.param.ExchangeRate,
				)
			}
			return nil, fmt.Errorf("batch insert failed at offset %d: %w", i, batchErr)
		}
		resp.Imported += int(count)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	committed = true

	return resp, nil
}

func (s *ImportFull) parseRow(
	rowNum int,
	row dto.FullImportRow,
	goDateFormat string,
	decimalSep string,
	currencyMapping map[string]string,
	currencies []store.Currency,
) (*parsedRow, error) {
	// Validate required fields
	if strings.TrimSpace(row.Date) == "" {
		return nil, fmt.Errorf("missing date")
	}
	if strings.TrimSpace(row.Account) == "" {
		return nil, fmt.Errorf("missing account")
	}
	if strings.TrimSpace(row.Total) == "" {
		return nil, fmt.Errorf("missing amount")
	}
	if strings.TrimSpace(row.Currency) == "" {
		return nil, fmt.Errorf("missing currency")
	}

	// Parse date
	date, err := parseFullImportDate(row.Date, goDateFormat)
	if err != nil {
		return nil, fmt.Errorf("invalid date %q: %w", row.Date, err)
	}

	// Parse amount
	amount, err := parseFullImportAmount(row.Total, decimalSep)
	if err != nil {
		return nil, fmt.Errorf("invalid amount %q: %w", row.Total, err)
	}

	// Resolve currency
	currCode, err := resolveCurrency(strings.TrimSpace(row.Currency), currencyMapping, currencies)
	if err != nil {
		return nil, fmt.Errorf("unresolved currency %q: %w", row.Currency, err)
	}

	// Determine type from amount sign
	txnType := "expense"
	if amount > 0 {
		txnType = "income"
	}

	absAmount := math.Abs(amount)
	absAmountNum := numericFromString(strconv.FormatFloat(absAmount, 'f', 2, 64))

	return &parsedRow{
		rowNumber:   rowNum,
		date:        date,
		account:     strings.TrimSpace(row.Account),
		category:    strings.TrimSpace(row.Category),
		amount:      amount,
		absAmount:   absAmountNum,
		currency:    currCode,
		description: strings.TrimSpace(row.Description),
		transfer:    strings.TrimSpace(row.Transfer),
		txnType:     txnType,
	}, nil
}

func parseFullImportDate(s string, goFormat string) (pgtype.Date, error) {
	s = strings.TrimSpace(s)
	t, err := time.Parse(goFormat, s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func parseFullImportAmount(s string, decimalSep string) (float64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty amount")
	}

	// Remove currency symbols and spaces
	s = strings.Map(func(r rune) rune {
		switch r {
		case '$', '€', '£', '¥', '₽', ' ':
			return -1
		}
		return r
	}, s)

	if decimalSep == "," {
		// European: dot is thousands, comma is decimal
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	} else {
		// US: comma is thousands, dot is decimal
		s = strings.ReplaceAll(s, ",", "")
	}

	return strconv.ParseFloat(s, 64)
}

func resolveCurrency(raw string, mapping map[string]string, currencies []store.Currency) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("empty currency")
	}

	// Check mapping first (user overrides)
	if mapped, ok := mapping[raw]; ok {
		return mapped, nil
	}

	// Try code match (case-insensitive)
	for _, c := range currencies {
		if strings.EqualFold(c.Code, raw) {
			return c.Code, nil
		}
	}

	// Try symbol match
	for _, c := range currencies {
		if c.Symbol == raw {
			return c.Code, nil
		}
	}

	return "", fmt.Errorf("no matching currency found")
}

func convertDateFormat(format string) string {
	// Convert frontend date format tokens to Go time format
	r := strings.NewReplacer(
		"yyyy", "2006",
		"MM", "01",
		"dd", "02",
	)
	return r.Replace(format)
}

func (s *ImportFull) resolveCategory(
	ctx context.Context,
	q *store.Queries,
	userID uuid.UUID,
	categoryStr string,
	txnType string,
) (uuid.UUID, []string, error) {
	parts := strings.SplitN(categoryStr, "\\", 2)
	parentName := strings.TrimSpace(parts[0])
	var created []string

	// Look up or create parent
	parent, err := q.GetCategoryByNameAndType(ctx, store.GetCategoryByNameAndTypeParams{
		UserID: userID,
		Name:   parentName,
		Type:   txnType,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		parent, err = q.CreateCategory(ctx, store.CreateCategoryParams{
			UserID:   userID,
			ParentID: pgtype.UUID{Valid: false},
			Name:     parentName,
			Type:     txnType,
		})
		if err != nil {
			return uuid.Nil, nil, fmt.Errorf("failed to create category %q: %w", parentName, err)
		}
		created = append(created, parentName)
	} else if err != nil {
		return uuid.Nil, nil, fmt.Errorf("failed to lookup category %q: %w", parentName, err)
	}

	// If no subcategory part, return parent
	childName := ""
	if len(parts) == 2 {
		childName = strings.TrimSpace(parts[1])
	}
	if childName == "" {
		return parent.ID, created, nil
	}

	// Look up or create subcategory
	parentPGID := pgtype.UUID{Bytes: parent.ID, Valid: true}
	child, err := q.GetSubcategoryByNameAndType(ctx, store.GetSubcategoryByNameAndTypeParams{
		UserID:   userID,
		Name:     childName,
		Type:     txnType,
		ParentID: parentPGID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		child, err = q.CreateCategory(ctx, store.CreateCategoryParams{
			UserID:   userID,
			ParentID: parentPGID,
			Name:     childName,
			Type:     txnType,
		})
		if err != nil {
			return uuid.Nil, nil, fmt.Errorf("failed to create subcategory %q: %w", childName, err)
		}
		created = append(created, parentName+" > "+childName)
	} else if err != nil {
		return uuid.Nil, nil, fmt.Errorf("failed to lookup subcategory %q: %w", childName, err)
	}

	return child.ID, created, nil
}

func pairTransfers(candidates []parsedRow) ([]transferPair, []dto.FailedRow) {
	matched := make([]bool, len(candidates))
	var pairs []transferPair
	var failures []dto.FailedRow

	for i := range candidates {
		if matched[i] {
			continue
		}
		a := &candidates[i]
		found := false
		for j := i + 1; j < len(candidates); j++ {
			if matched[j] {
				continue
			}
			b := &candidates[j]
			if !a.date.Time.Equal(b.date.Time) || a.account != b.transfer || a.transfer != b.account {
				continue
			}
			matched[i] = true
			matched[j] = true
			found = true

			// Both amounts must have opposite signs
			if (a.amount < 0) == (b.amount < 0) {
				failures = append(failures,
					dto.FailedRow{RowNumber: a.rowNumber, Data: parsedRowToDTO(a), Error: "transfer pair has same sign amounts"},
					dto.FailedRow{RowNumber: b.rowNumber, Data: parsedRowToDTO(b), Error: "transfer pair has same sign amounts"},
				)
				break
			}

			// Source is the negative (expense) side, dest is the positive (income) side
			source, dest := a, b
			if b.amount < 0 {
				source, dest = b, a
			}
			pairs = append(pairs, transferPair{source: source, dest: dest})
			break
		}
		if !found {
			failures = append(failures, dto.FailedRow{
				RowNumber: a.rowNumber,
				Data:      parsedRowToDTO(a),
				Error:     "transfer pair not found",
			})
		}
	}

	return pairs, failures
}

func findCurrencyForAccount(accountName string, rows []parsedRow) string {
	for _, row := range rows {
		if row.account == accountName {
			return row.currency
		}
	}
	return ""
}

func filterByCurrency(rows []parsedRow, accountCache map[string]store.Account, resp *dto.FullImportResponse) []parsedRow {
	valid := make([]parsedRow, 0, len(rows))
	for _, row := range rows {
		acct := accountCache[row.account]
		if acct.Currency != row.currency {
			resp.FailedRows = append(resp.FailedRows, dto.FailedRow{
				RowNumber: row.rowNumber,
				Data:      parsedRowToDTO(&row),
				Error:     fmt.Sprintf("currency mismatch: account %q has currency %s but row has %s", row.account, acct.Currency, row.currency),
			})
			continue
		}
		valid = append(valid, row)
	}
	return valid
}

func parsedRowToDTO(row *parsedRow) dto.FullImportRow {
	return dto.FullImportRow{
		Date:        row.date.Time.Format("02.01.2006"),
		Account:     row.account,
		Category:    row.category,
		Total:       strconv.FormatFloat(row.amount, 'f', 2, 64),
		Currency:    row.currency,
		Description: row.description,
		Transfer:    row.transfer,
	}
}
