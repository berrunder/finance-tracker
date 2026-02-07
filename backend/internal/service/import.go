package service

import (
	"context"
	"encoding/csv"
	"errors"
	"io"
	"math"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type Import struct {
	queries *store.Queries
}

func NewImport(queries *store.Queries) *Import {
	return &Import{queries: queries}
}

func (s *Import) ParseCSV(r io.Reader) (*dto.CSVUploadResponse, error) {
	reader := csv.NewReader(r)
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return nil, errors.New("failed to read CSV headers")
	}

	var rows []dto.CSVPreviewRow
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		values := make(map[string]string, len(headers))
		for i, h := range headers {
			if i < len(record) {
				values[h] = strings.TrimSpace(record[i])
			}
		}
		rows = append(rows, dto.CSVPreviewRow{Values: values})
	}

	// Return first 5 rows as preview
	previewCount := len(rows)
	if previewCount > 5 {
		previewCount = 5
	}

	return &dto.CSVUploadResponse{
		Headers: headers,
		Preview: rows[:previewCount],
		Total:   len(rows),
	}, nil
}

func (s *Import) ConfirmImport(ctx context.Context, userID uuid.UUID, req dto.CSVConfirmRequest) (int, error) {
	var params []store.BulkCreateTransactionsParams

	for _, row := range req.Rows {
		dateStr := row.Values[req.Mapping.Date]
		amountStr := row.Values[req.Mapping.Amount]
		description := ""
		if req.Mapping.Description != "" {
			description = row.Values[req.Mapping.Description]
		}

		date, err := dateFromString(dateStr)
		if err != nil {
			continue
		}

		amountFloat, err := parseAmount(amountStr)
		if err != nil {
			continue
		}

		txnType := "expense"
		if req.Mapping.Type != "" {
			mappedType := strings.ToLower(row.Values[req.Mapping.Type])
			if mappedType == "income" || mappedType == "credit" {
				txnType = "income"
			}
		} else if amountFloat > 0 {
			txnType = "income"
		}

		absAmount := math.Abs(amountFloat)
		amount := numericFromString(strconv.FormatFloat(absAmount, 'f', 2, 64))

		params = append(params, store.BulkCreateTransactionsParams{
			UserID:      userID,
			AccountID:   req.AccountID,
			Type:        txnType,
			Amount:      amount,
			Description: description,
			Date:        date,
			CategoryID:  pgtype.UUID{Valid: false},
		})
	}

	if len(params) == 0 {
		return 0, errors.New("no valid transactions found in CSV")
	}

	count, err := s.queries.BulkCreateTransactions(ctx, params)
	if err != nil {
		return 0, err
	}

	return int(count), nil
}

func parseAmount(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, " ", "")
	// Remove currency symbols
	s = strings.TrimLeft(s, "$€£R¥₽")
	s = strings.TrimSpace(s)
	return strconv.ParseFloat(s, 64)
}
