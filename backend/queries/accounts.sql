-- name: CreateAccount :one
INSERT INTO accounts (user_id, name, type, currency, initial_balance)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetAccount :one
SELECT * FROM accounts WHERE id = $1 AND user_id = $2;

-- name: ListAccounts :many
SELECT * FROM accounts WHERE user_id = $1 ORDER BY name;

-- name: UpdateAccount :one
UPDATE accounts
SET name = $2, type = $3, initial_balance = $4, updated_at = now()
WHERE id = $1 AND user_id = sqlc.arg(user_id)
RETURNING *;

-- name: DeleteAccount :exec
DELETE FROM accounts WHERE id = $1 AND user_id = $2;

-- name: GetAccountByName :one
SELECT * FROM accounts WHERE user_id = $1 AND name = $2;

-- name: GetAccountTransactionSums :one
SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::DECIMAL(15,2) AS total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::DECIMAL(15,2) AS total_expense
FROM transactions
WHERE account_id = $1;

-- name: DeleteAllUserAccounts :exec
DELETE FROM accounts WHERE user_id = $1;
