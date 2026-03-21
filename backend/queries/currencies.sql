-- name: ListCurrencies :many
SELECT * FROM currencies ORDER BY code;

-- name: GetCurrency :one
SELECT * FROM currencies WHERE code = $1;

-- name: GetCurrencyBySymbol :one
SELECT * FROM currencies WHERE symbol = $1;

-- name: CreateCurrency :one
INSERT INTO currencies (code, name, symbol) VALUES ($1, $2, $3) RETURNING *;

-- name: UpdateCurrency :one
UPDATE currencies SET name = $2 WHERE code = $1 RETURNING *;
