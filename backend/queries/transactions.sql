-- name: CreateTransaction :one
INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, transfer_id, exchange_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetTransaction :one
SELECT * FROM transactions WHERE id = $1 AND user_id = $2;

-- name: ListTransactions :many
SELECT * FROM transactions
WHERE user_id = @user_id
    AND (sqlc.narg('account_id')::UUID IS NULL OR account_id = sqlc.narg('account_id'))
    AND (sqlc.narg('category_id')::UUID IS NULL OR category_id = sqlc.narg('category_id'))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR date <= sqlc.narg('date_to'))
ORDER BY date DESC, created_at DESC
LIMIT @lim OFFSET @off;

-- name: CountTransactions :one
SELECT COUNT(*) FROM transactions
WHERE user_id = @user_id
    AND (sqlc.narg('account_id')::UUID IS NULL OR account_id = sqlc.narg('account_id'))
    AND (sqlc.narg('category_id')::UUID IS NULL OR category_id = sqlc.narg('category_id'))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR date <= sqlc.narg('date_to'));

-- name: UpdateTransaction :one
UPDATE transactions
SET account_id = $2, category_id = $3, type = $4, amount = $5, description = $6, date = $7, updated_at = now()
WHERE id = $1 AND user_id = sqlc.arg(user_id)
RETURNING *;

-- name: DeleteTransaction :exec
DELETE FROM transactions WHERE id = $1 AND user_id = $2;

-- name: DeleteTransactionByTransferID :exec
DELETE FROM transactions WHERE transfer_id = $1 AND user_id = $2;

-- name: SpendingByCategory :many
SELECT
    c.id AS category_id,
    c.name AS category_name,
    c.parent_id,
    COALESCE(SUM(t.amount), 0)::DECIMAL(15,2) AS total
FROM transactions t
JOIN categories c ON t.category_id = c.id
WHERE t.user_id = @user_id
    AND t.type = 'expense'
    AND t.date >= @date_from
    AND t.date <= @date_to
    AND t.transfer_id IS NULL
GROUP BY c.id, c.name, c.parent_id
ORDER BY total DESC;

-- name: MonthlyIncomeExpense :many
SELECT
    date_trunc('month', date)::DATE AS month,
    COALESCE(SUM(CASE WHEN type = 'income' AND transfer_id IS NULL THEN amount ELSE 0 END), 0)::DECIMAL(15,2) AS income,
    COALESCE(SUM(CASE WHEN type = 'expense' AND transfer_id IS NULL THEN amount ELSE 0 END), 0)::DECIMAL(15,2) AS expense
FROM transactions
WHERE user_id = @user_id
    AND date >= @date_from
    AND date <= @date_to
GROUP BY date_trunc('month', date)
ORDER BY month;

-- name: DashboardSummary :one
SELECT
    COALESCE(SUM(CASE WHEN type = 'income' AND transfer_id IS NULL THEN amount ELSE 0 END), 0)::DECIMAL(15,2) AS total_income,
    COALESCE(SUM(CASE WHEN type = 'expense' AND transfer_id IS NULL THEN amount ELSE 0 END), 0)::DECIMAL(15,2) AS total_expense
FROM transactions
WHERE user_id = @user_id
    AND date >= @date_from
    AND date <= @date_to;

-- name: BalanceHistory :many
SELECT
    date,
    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END)::DECIMAL(15,2) AS daily_change
FROM transactions
WHERE account_id = @account_id
    AND date >= @date_from
    AND date <= @date_to
GROUP BY date
ORDER BY date;

-- name: BulkCreateTransactions :copyfrom
INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date)
VALUES ($1, $2, $3, $4, $5, $6, $7);
