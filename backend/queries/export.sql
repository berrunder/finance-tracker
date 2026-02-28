-- name: ExportTransactions :many
SELECT
    t.date,
    a.name AS account_name,
    COALESCE(pc.name, '') AS parent_category_name,
    COALESCE(c.name, '') AS category_name,
    t.type,
    t.amount,
    a.currency,
    t.description,
    t.transfer_id,
    COALESCE(ta.name, '') AS transfer_account_name
FROM transactions t
JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
LEFT JOIN LATERAL (
    SELECT t2.account_id
    FROM transactions t2
    WHERE t2.transfer_id = t.transfer_id
        AND t2.id != t.id
        AND t.transfer_id IS NOT NULL
    LIMIT 1
) t2 ON true
LEFT JOIN accounts ta ON t2.account_id = ta.id
WHERE t.user_id = @user_id
    AND t.date >= @date_from
    AND t.date <= @date_to
ORDER BY t.date, t.created_at;
