-- name: CreateCategory :one
INSERT INTO categories (user_id, parent_id, name, type)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListCategories :many
SELECT * FROM categories WHERE user_id = $1 ORDER BY type, name;

-- name: GetCategory :one
SELECT * FROM categories WHERE id = $1 AND user_id = $2;

-- name: UpdateCategory :one
UPDATE categories
SET name = $2, parent_id = $3
WHERE id = $1 AND user_id = sqlc.arg(user_id)
RETURNING *;

-- name: DeleteCategory :exec
DELETE FROM categories WHERE id = $1 AND user_id = $2;

-- name: HasChildCategories :one
SELECT EXISTS(SELECT 1 FROM categories WHERE parent_id = $1) AS has_children;

-- name: HasCategoryTransactions :one
SELECT EXISTS(SELECT 1 FROM transactions WHERE category_id = $1) AS has_transactions;

-- name: GetCategoryByNameAndType :one
SELECT * FROM categories WHERE user_id = $1 AND name = $2 AND type = $3 AND parent_id IS NULL;

-- name: GetSubcategoryByNameAndType :one
SELECT * FROM categories WHERE user_id = $1 AND name = $2 AND type = $3 AND parent_id = $4;

-- name: CreateDefaultCategories :exec
INSERT INTO categories (user_id, name, type) VALUES
    (@user_id, 'Salary', 'income'),
    (@user_id, 'Freelance', 'income'),
    (@user_id, 'Investments', 'income'),
    (@user_id, 'Other Income', 'income'),
    (@user_id, 'Food', 'expense'),
    (@user_id, 'Transport', 'expense'),
    (@user_id, 'Housing', 'expense'),
    (@user_id, 'Utilities', 'expense'),
    (@user_id, 'Healthcare', 'expense'),
    (@user_id, 'Entertainment', 'expense'),
    (@user_id, 'Shopping', 'expense'),
    (@user_id, 'Education', 'expense'),
    (@user_id, 'Other Expense', 'expense');
