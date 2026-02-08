package service

import (
	"context"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type exchangeRateStore interface {
	ListExchangeRates(ctx context.Context) ([]store.ExchangeRate, error)
	UpsertExchangeRate(ctx context.Context, arg store.UpsertExchangeRateParams) (store.ExchangeRate, error)
}

type ExchangeRate struct {
	queries exchangeRateStore
}

func NewExchangeRate(queries *store.Queries) *ExchangeRate {
	return &ExchangeRate{queries: queries}
}

func (s *ExchangeRate) List(ctx context.Context) ([]dto.ExchangeRateResponse, error) {
	rates, err := s.queries.ListExchangeRates(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]dto.ExchangeRateResponse, 0, len(rates))
	for _, r := range rates {
		result = append(result, dto.ExchangeRateResponse{
			ID:           r.ID,
			FromCurrency: r.FromCurrency,
			ToCurrency:   r.ToCurrency,
			Rate:         numericToString(r.Rate),
			Date:         dateToString(r.Date),
		})
	}
	return result, nil
}

func (s *ExchangeRate) Create(ctx context.Context, req dto.CreateExchangeRateRequest) (*dto.ExchangeRateResponse, error) {
	date, err := dateFromString(req.Date)
	if err != nil {
		return nil, err
	}

	rate, err := s.queries.UpsertExchangeRate(ctx, store.UpsertExchangeRateParams{
		FromCurrency: req.FromCurrency,
		ToCurrency:   req.ToCurrency,
		Rate:         numericFromString(req.Rate),
		Date:         date,
	})
	if err != nil {
		return nil, err
	}

	return &dto.ExchangeRateResponse{
		ID:           rate.ID,
		FromCurrency: rate.FromCurrency,
		ToCurrency:   rate.ToCurrency,
		Rate:         numericToString(rate.Rate),
		Date:         dateToString(rate.Date),
	}, nil
}
