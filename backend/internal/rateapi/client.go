package rateapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	primaryURL  = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@%s/v1/currencies/%s.min.json"
	fallbackURL = "https://%s.currency-api.pages.dev/v1/currencies/%s.min.json"
)

type RatesResponse struct {
	Date  string
	Rates map[string]string // decimal strings, never float
}

type Fetcher interface {
	FetchRates(ctx context.Context, baseCurrency string) (*RatesResponse, error)
}

type Client struct {
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) FetchRates(ctx context.Context, baseCurrency string) (*RatesResponse, error) {
	base := strings.ToLower(baseCurrency)
	date := "latest"

	body, err := c.fetch(ctx, fmt.Sprintf(primaryURL, date, base))
	if err != nil {
		body, err = c.fetch(ctx, fmt.Sprintf(fallbackURL, date, base))
		if err != nil {
			return nil, fmt.Errorf("both primary and fallback failed for %s: %w", baseCurrency, err)
		}
	}

	return parseResponse(body, base)
}

func (c *Client) fetch(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d from %s", resp.StatusCode, url)
	}

	const maxResponseSize = 5 * 1024 * 1024 // 5 MB
	return io.ReadAll(io.LimitReader(resp.Body, maxResponseSize))
}

func parseResponse(body []byte, base string) (*RatesResponse, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var date string
	if d, ok := raw["date"]; ok {
		if err := json.Unmarshal(d, &date); err != nil {
			return nil, fmt.Errorf("failed to parse date: %w", err)
		}
	}

	ratesRaw, ok := raw[base]
	if !ok {
		return nil, fmt.Errorf("no rates found for base currency %q", base)
	}

	var rates map[string]json.Number
	dec := json.NewDecoder(strings.NewReader(string(ratesRaw)))
	dec.UseNumber()
	if err := dec.Decode(&rates); err != nil {
		return nil, fmt.Errorf("failed to parse rates for %q: %w", base, err)
	}

	strRates := make(map[string]string, len(rates))
	for k, v := range rates {
		strRates[k] = v.String()
	}

	return &RatesResponse{Date: date, Rates: strRates}, nil
}
