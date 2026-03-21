package service

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

var ErrCurrencyExists = errors.New("currency with this code already exists")

type currencyStore interface {
	ListCurrencies(ctx context.Context) ([]store.Currency, error)
	CreateCurrency(ctx context.Context, arg store.CreateCurrencyParams) (store.Currency, error)
	UpdateCurrency(ctx context.Context, arg store.UpdateCurrencyParams) (store.Currency, error)
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
		result = append(result, currencyToResponse(c))
	}
	return result, nil
}

func (s *Currency) Create(ctx context.Context, req dto.CreateCurrencyRequest) (*dto.CurrencyResponse, error) {
	c, err := s.queries.CreateCurrency(ctx, store.CreateCurrencyParams{
		Code:   req.Code,
		Name:   req.Name,
		Symbol: req.Symbol,
	})
	if err != nil {
		if isDuplicateKey(err) {
			return nil, ErrCurrencyExists
		}
		return nil, err
	}
	resp := currencyToResponse(c)
	return &resp, nil
}

func (s *Currency) Update(ctx context.Context, code string, req dto.UpdateCurrencyRequest) (*dto.CurrencyResponse, error) {
	c, err := s.queries.UpdateCurrency(ctx, store.UpdateCurrencyParams{
		Code: code,
		Name: req.Name,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	resp := currencyToResponse(c)
	return &resp, nil
}

func currencyToResponse(c store.Currency) dto.CurrencyResponse {
	return dto.CurrencyResponse{
		Code:   c.Code,
		Name:   c.Name,
		Symbol: c.Symbol,
	}
}
