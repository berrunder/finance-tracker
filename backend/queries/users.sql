-- name: CreateUser :one
INSERT INTO users (username, password_hash, display_name, base_currency, invite_code)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: UpdateUser :one
UPDATE users
SET display_name = $2, base_currency = $3, updated_at = now()
WHERE id = $1
RETURNING *;
