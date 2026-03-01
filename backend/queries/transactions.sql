-- name: CreateTransaction :one
INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, transfer_id, exchange_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetTransaction :one
SELECT * FROM transactions WHERE id = $1 AND user_id = $2;

-- name: ListTransactions :many
WITH RECURSIVE expanded_categories AS (
    SELECT id FROM categories
    WHERE id = ANY(@category_ids::UUID[])
    UNION
    SELECT c.id FROM categories c
    INNER JOIN expanded_categories ec ON c.parent_id = ec.id
)
SELECT t.id, t.user_id, t.account_id, t.category_id, t.type, t.amount, t.description, t.date, t.transfer_id, t.exchange_rate, t.created_at, t.updated_at FROM transactions t
WHERE t.user_id = @user_id
    AND (cardinality(@account_ids::UUID[]) = 0 OR t.account_id = ANY(@account_ids))
    AND (cardinality(@category_ids::UUID[]) = 0 OR t.category_id IN (SELECT id FROM expanded_categories))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR t.type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR t.date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR t.date <= sqlc.narg('date_to'))
ORDER BY t.date DESC, t.created_at DESC
LIMIT @lim OFFSET @off;

-- name: CountTransactions :one
WITH RECURSIVE expanded_categories AS (
    SELECT id FROM categories
    WHERE id = ANY(@category_ids::UUID[])
    UNION
    SELECT c.id FROM categories c
    INNER JOIN expanded_categories ec ON c.parent_id = ec.id
)
SELECT COUNT(*) FROM transactions t
WHERE t.user_id = @user_id
    AND (cardinality(@account_ids::UUID[]) = 0 OR t.account_id = ANY(@account_ids))
    AND (cardinality(@category_ids::UUID[]) = 0 OR t.category_id IN (SELECT id FROM expanded_categories))
    AND (sqlc.narg('type')::VARCHAR IS NULL OR t.type = sqlc.narg('type'))
    AND (sqlc.narg('date_from')::DATE IS NULL OR t.date >= sqlc.narg('date_from'))
    AND (sqlc.narg('date_to')::DATE IS NULL OR t.date <= sqlc.narg('date_to'));

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
WITH daily AS (
    SELECT
        t.date,
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)::DECIMAL(15,2) AS daily_change
    FROM transactions t
    WHERE t.account_id = @account_id
        AND t.user_id = @user_id
        AND t.date >= @date_from
        AND t.date <= @date_to
    GROUP BY t.date
),
start_balance AS (
    SELECT
        a.initial_balance
        + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)::DECIMAL(15,2) AS balance
    FROM accounts a
    LEFT JOIN transactions t
        ON t.account_id = a.id
        AND t.user_id = a.user_id
        AND t.date < @date_from
    WHERE a.id = @account_id
        AND a.user_id = @user_id
    GROUP BY a.initial_balance
)
SELECT
    d.date,
    (sb.balance + SUM(d.daily_change) OVER (ORDER BY d.date))::DECIMAL(15,2) AS balance
FROM daily d
CROSS JOIN start_balance sb
ORDER BY d.date;

-- name: GetTransactionsByTransferID :many
SELECT * FROM transactions WHERE transfer_id = $1 AND user_id = $2;

-- name: UpdateTransferTransaction :one
UPDATE transactions
SET account_id = $2, amount = $3, description = $4, date = $5, exchange_rate = $6, updated_at = now()
WHERE id = $1 AND user_id = $7
RETURNING *;

-- name: BulkCreateTransactions :copyfrom
INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: BulkCreateTransactionsFull :copyfrom
INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date, transfer_id, exchange_rate)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: DeleteAllUserTransactions :exec
DELETE FROM transactions WHERE user_id = $1;
