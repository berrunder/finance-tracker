# Finance Tracker — Backend

REST API for a small-scale personal finance tracker. Tracks income/expenses across multiple accounts and currencies, generates spending reports, and imports bank statements via CSV.

## Tech

Go 1.24, chi, PostgreSQL 16 (pgx + sqlc), JWT auth (HS256), golang-migrate.

## Prerequisites

- Go 1.24+
- PostgreSQL 16 (or Docker)
- [sqlc](https://sqlc.dev/) (for regenerating DB code)

## Quick Start (Docker Compose)

From the repository root:

```sh
cp .env.example .env   # edit DB_PASSWORD and JWT_SECRET
docker compose up -d   # starts db + backend on :8080
```

## Local Development

### 1. Start PostgreSQL

```sh
docker compose up -d db
```

Or use a local instance — just make sure the connection string matches.

### 2. Set Environment Variables

```sh
export DATABASE_URL="postgres://finance:changeme@localhost:5432/finance_tracker?sslmode=disable"
export JWT_SECRET="your-secret-at-least-32-chars-long"
export PORT=8080
```

### 3. Run the Backend

```sh
cd backend
go run cmd/api/main.go
```

Migrations run automatically on startup. The API is available at `http://localhost:8080/api/v1/`.

## Configuration

All config is via environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_SECRET` | yes | — | HMAC signing key for JWTs |
| `INVITE_CODES` | yes | — | Comma-separated list of valid invite codes for registration |
| `PORT` | no | `8080` | HTTP listen port |

## API Overview

Base path: `/api/v1`

### Auth (public)

```
POST /auth/register    { username, password, display_name, base_currency, invite_code }
POST /auth/login       { username, password }
POST /auth/refresh     { refresh_token }
```

All return `{ access_token, refresh_token, user }`.

### Protected Endpoints (require `Authorization: Bearer <access_token>`)

```
GET|POST         /accounts
GET|PUT|DELETE   /accounts/:id

GET|POST         /categories
PUT|DELETE       /categories/:id

GET|POST         /transactions          ?account_id=&category_id=&type=&date_from=&date_to=&page=&per_page=
POST             /transactions/transfer
GET|PUT|DELETE   /transactions/:id

GET /reports/spending          ?date_from=&date_to=
GET /reports/income-expense    ?date_from=&date_to=
GET /reports/balance-history   ?account_id=&date_from=&date_to=
GET /reports/summary           ?date_from=&date_to=

POST /import/csv               multipart/form-data (file field: "file")
POST /import/csv/confirm       { account_id, mapping, rows }

GET|POST /exchange-rates
```

### Response Format

```json
// Success (list)
{ "data": [...], "pagination": { "page": 1, "per_page": 20, "total": 42 } }

// Success (single)
{ "id": "...", "name": "...", ... }

// Error
{ "error": { "code": "NOT_FOUND", "message": "account not found" } }
```

## Development Commands

From the repo root:

```sh
make dev-backend    # run backend with go run
make sqlc           # regenerate store/ from queries/*.sql
make up             # docker compose up -d --build
make down           # docker compose down
```

## Regenerating DB Code

After editing files in `queries/`:

```sh
cd backend
sqlc generate
```

Generated code goes to `internal/store/` — do not edit those files directly.

## Project Structure

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed patterns and conventions.

```
cmd/api/main.go        entry point, dependency wiring
internal/
  config/              env var config
  server/              HTTP server + route registration
  handler/             HTTP handlers (request parsing, validation, response)
  service/             business logic, type conversions
  store/               sqlc-generated DB access (do not edit)
  middleware/           JWT auth
  dto/                 request/response types
migrations/            SQL migration files
queries/               sqlc SQL definitions
```

## API documentaion

See [API.md](docs/API.md) for API documentation

## Testing

```sh
cd backend
go test ./...
```
