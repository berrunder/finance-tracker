package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/sanches/finance-tracker-cc/backend/internal/rateapi"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type exchangeRateSyncStore interface {
	ListDistinctAccountCurrencies(ctx context.Context) ([]string, error)
	ListCurrencies(ctx context.Context) ([]store.Currency, error)
	UpsertExchangeRate(ctx context.Context, arg store.UpsertExchangeRateParams) (store.ExchangeRate, error)
}

type ExchangeRateSync struct {
	queries exchangeRateSyncStore
	fetcher rateapi.Fetcher
}

func NewExchangeRateSync(queries *store.Queries, fetcher rateapi.Fetcher) *ExchangeRateSync {
	return &ExchangeRateSync{queries: queries, fetcher: fetcher}
}

func (s *ExchangeRateSync) Sync(ctx context.Context) error {
	accountCurrencies, err := s.queries.ListDistinctAccountCurrencies(ctx)
	if err != nil {
		return fmt.Errorf("list account currencies: %w", err)
	}
	if len(accountCurrencies) == 0 {
		slog.Info("exchange rate sync: no account currencies found, skipping")
		return nil
	}

	allCurrencies, err := s.queries.ListCurrencies(ctx)
	if err != nil {
		return fmt.Errorf("list currencies: %w", err)
	}

	known := make(map[string]bool, len(allCurrencies))
	for _, c := range allCurrencies {
		known[strings.ToUpper(c.Code)] = true
	}

	// Filter account currencies to only those in the currencies table.
	var bases []string
	for _, code := range accountCurrencies {
		if known[strings.ToUpper(code)] {
			bases = append(bases, code)
		}
	}

	today, err := dateFromString(time.Now().UTC().Format("2006-01-02"))
	if err != nil {
		return fmt.Errorf("parse today's date: %w", err)
	}

	var errs []error
	totalUpserted := 0

	for _, base := range bases {
		resp, err := s.fetcher.FetchRates(ctx, base)
		if err != nil {
			slog.Warn("exchange rate sync: fetch failed", "base", base, "error", err)
			errs = append(errs, fmt.Errorf("fetch %s: %w", base, err))
			continue
		}

		upserted := 0
		for target, rate := range resp.Rates {
			targetUpper := strings.ToUpper(target)
			if targetUpper == strings.ToUpper(base) {
				continue
			}
			if !known[targetUpper] {
				continue
			}

			_, err := s.queries.UpsertExchangeRate(ctx, store.UpsertExchangeRateParams{
				FromCurrency: strings.ToUpper(base),
				ToCurrency:   targetUpper,
				Rate:         numericFromString(rate),
				Date:         today,
			})
			if err != nil {
				slog.Warn("exchange rate sync: upsert failed", "from", base, "to", target, "error", err)
				errs = append(errs, fmt.Errorf("upsert %s->%s: %w", base, target, err))
				continue
			}
			upserted++
		}

		slog.Info("exchange rate sync: done", "base", base, "upserted", upserted)
		totalUpserted += upserted
	}

	slog.Info("exchange rate sync: complete", "total_upserted", totalUpserted, "errors", len(errs))
	return errors.Join(errs...)
}
