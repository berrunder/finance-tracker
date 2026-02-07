-- name: ListExchangeRates :many
SELECT * FROM exchange_rates ORDER BY date DESC, from_currency, to_currency;

-- name: GetLatestRate :one
SELECT * FROM exchange_rates
WHERE from_currency = $1 AND to_currency = $2
ORDER BY date DESC
LIMIT 1;

-- name: UpsertExchangeRate :one
INSERT INTO exchange_rates (from_currency, to_currency, rate, date)
VALUES ($1, $2, $3, $4)
ON CONFLICT (from_currency, to_currency, date)
DO UPDATE SET rate = EXCLUDED.rate
RETURNING *;
