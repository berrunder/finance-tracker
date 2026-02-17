package service

import (
	"context"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type currencyStore interface {
	ListCurrencies(ctx context.Context) ([]store.Currency, error)
}

type Currency struct {
	queries currencyStore
}

func NewCurrency(queries *store.Queries) *Currency {
	return &Currency{queries: queries}
}

func (s *Currency) List(ctx context.Context) ([]dto.CurrencyResponse, error) {
	currencies, err := s.queries.ListCurrencies(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]dto.CurrencyResponse, 0, len(currencies))
	for _, c := range currencies {
		result = append(result, dto.CurrencyResponse{
			Code:   c.Code,
			Name:   c.Name,
			Symbol: c.Symbol,
		})
	}
	return result, nil
}
