# Finance Tracker — High-Level System Design

## Context

New personal finance application for individual/family use (1-5 users), self-hosted. The goal is to track income and expenses across multiple accounts and currencies, generate spending reports, and import bank statements via CSV. This is the high-level architecture document; detailed specs for each component will follow.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go |
| Web Frontend | TypeScript (React) |
| Android App | Kotlin (Jetpack Compose) |
| Database | PostgreSQL 16 |
| Deployment | Docker Compose, self-hosted |

## System Components

```
┌──────────────┐     ┌──────────────┐
│ Web Frontend │     │ Android App  │
│ (Nginx + SPA)│     │  (Kotlin)    │
└──────┬───────┘     └──────┬───────┘
       │  /api proxy        │ direct
       └──────┬─────────────┘
              ▼
       ┌──────────────┐
       │  Go Backend   │
       │  (REST API)   │
       │  port 8080    │
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ PostgreSQL 16 │
       │  port 5432    │
       └──────────────┘
```

- **Web frontend** is served by Nginx as a static SPA. Nginx reverse-proxies `/api/*` to the Go backend (avoids CORS).
- **Android app** connects directly to the backend (user configures server URL).
- **Backend** is the only component that talks to PostgreSQL.
- No message queues, caches, or service mesh — unnecessary at this scale.

## Authentication

- Username/password with bcrypt hashing
- JWT access tokens (15 min expiry) + refresh tokens (7 days)
- HS256 signing with server-side secret
- Clients store refresh token persistently, access token in memory

## Database Schema (Entity Model)

```
users
  id              UUID PK
  username        VARCHAR(50) UNIQUE
  password_hash   VARCHAR(255)
  display_name    VARCHAR(100)
  base_currency   VARCHAR(3) DEFAULT 'USD'   -- for report aggregation
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

currencies
  code            VARCHAR(3) PK              -- 'USD', 'EUR', 'BRL', etc.
  name            VARCHAR(50)
  symbol          VARCHAR(5)

exchange_rates
  id              UUID PK
  from_currency   VARCHAR(3) FK -> currencies.code
  to_currency     VARCHAR(3) FK -> currencies.code
  rate            DECIMAL(18,8)
  date            DATE
  UNIQUE(from_currency, to_currency, date)
  INDEX(from_currency, to_currency, date DESC)

accounts
  id              UUID PK
  user_id         UUID FK -> users.id
  name            VARCHAR(100)
  type            VARCHAR(20) CHECK (bank, cash, credit_card, savings)
  currency        VARCHAR(3) FK -> currencies.code
  initial_balance DECIMAL(15,2) DEFAULT 0
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE(user_id, name)

categories
  id              UUID PK
  user_id         UUID FK -> users.id
  parent_id       UUID FK -> categories.id   -- NULL for top-level categories
  name            VARCHAR(100)
  type            VARCHAR(10) CHECK (income, expense)
  created_at      TIMESTAMPTZ
  UNIQUE(user_id, parent_id, name, type)     -- unique name within same parent
  INDEX(user_id, parent_id)

transactions
  id              UUID PK
  user_id         UUID FK -> users.id
  account_id      UUID FK -> accounts.id
  category_id     UUID FK -> categories.id   -- NULL for transfers
  type            VARCHAR(10) CHECK (income, expense, transfer)
  amount          DECIMAL(15,2)              -- always positive
  description     TEXT
  date            DATE
  transfer_id     UUID NULL                  -- links paired transfer txns
  exchange_rate   DECIMAL(18,8) NULL         -- rate used for cross-currency transfers
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  INDEX(user_id, date)
  INDEX(account_id)
  INDEX(category_id)
```

**Key decisions:**
- **Account balances are computed** (`initial_balance + income - expenses ± transfers`), not stored. Avoids stale data; query cost is negligible at this scale.
- **Transfers** are two linked transactions (expense on source, income on destination) sharing a `transfer_id`. For cross-currency transfers, the `exchange_rate` field records the rate used, and each side stores the amount in its account's currency.
- **Multi-currency:** Each account has a currency. Reports aggregate to the user's `base_currency` using the `exchange_rates` table. Exchange rates can be entered manually or fetched periodically.
- **Hierarchical categories:** Categories have an optional `parent_id` for grouping (e.g., "Food" → "Groceries", "Restaurants"). Only one level of nesting (parent + children). Transactions can be assigned to any category — parent or child. Reports can aggregate by parent category (rolling up all children) or show individual subcategories.
- **Categories are per-user** with defaults seeded on registration (including some default parent/child groups).

## API Design

REST with JSON. Prefix: `/api/v1/`.

### Endpoints

**Auth (public)**
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
```

**Accounts**
```
GET    /accounts                     -- list with computed balances
POST   /accounts
GET    /accounts/:id
PUT    /accounts/:id
DELETE /accounts/:id
```

**Categories**
```
GET    /categories                    -- returns tree structure (parents with nested children)
POST   /categories                    -- create category (with optional parent_id)
PUT    /categories/:id
DELETE /categories/:id                -- block if has children or transactions
```

**Transactions**
```
GET    /transactions                 -- filterable by account, category, type, date range; paginated
POST   /transactions
POST   /transactions/transfer        -- creates linked pair
GET    /transactions/:id
PUT    /transactions/:id
DELETE /transactions/:id
```

**Import**
```
POST   /import/csv                   -- upload CSV, returns parsed preview
POST   /import/csv/confirm           -- confirm import after column mapping
```

**Reports**
```
GET    /reports/spending             -- by category for a date range (?group_by=parent to roll up subcategories)
GET    /reports/income-expense       -- monthly income vs expense
GET    /reports/balance-history      -- account balance over time
GET    /reports/summary              -- dashboard totals
```

**Exchange Rates**
```
GET    /exchange-rates               -- list rates
POST   /exchange-rates               -- add/update a rate
```

### Conventions
- Pagination: `{ "data": [...], "pagination": { "page", "per_page", "total" } }`
- Errors: `{ "error": { "code", "message", "details" } }`
- Monetary amounts returned with their currency code

## Backend Architecture (Go)

### Libraries
| Concern | Library |
|---|---|
| Router | chi |
| DB access | sqlc (code gen from SQL) |
| DB driver | pgx |
| Migrations | golang-migrate |
| JWT | golang-jwt |
| Password | bcrypt (x/crypto) |
| Config | envconfig |
| Validation | go-playground/validator |
| CSV | stdlib encoding/csv |
| Logging | stdlib log/slog |
| Testing | stdlib + testify |

### Structure (`backend/`)
```
cmd/api/main.go              -- entry point, wiring
internal/
  config/config.go           -- env var config struct
  server/server.go           -- HTTP server, graceful shutdown
  server/routes.go           -- route registration
  handler/                   -- HTTP handlers (auth, account, transaction, category, report, import)
  service/                   -- business logic
  store/                     -- sqlc-generated code
  middleware/                 -- JWT auth, logging
  dto/                       -- request/response types
migrations/                  -- SQL up/down files
queries/                     -- sqlc SQL definitions
sqlc.yaml
Dockerfile
go.mod
```

Three-layer architecture: handler → service → store. Dependencies wired manually in `main.go`.

## Web Frontend Architecture (TypeScript)

### Libraries
| Concern | Library |
|---|---|
| Framework | React + Vite |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Forms | React Hook Form + zod |
| UI | shadcn/ui (Radix + Tailwind) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Dates | date-fns |
| CSV preview | PapaParse |

### Structure (`frontend/`)
```
src/
  api/                       -- API client + per-resource call modules
  hooks/                     -- TanStack Query hooks, auth hook
  pages/                     -- login, register, dashboard, transactions, accounts, reports, import, settings
  components/                -- ui/ (shadcn), layout/, domain components
  lib/                       -- utils, validators (zod schemas)
  types/                     -- TypeScript types matching API DTOs
Dockerfile                   -- multi-stage: node build → nginx serve
nginx.conf                   -- SPA fallback + /api proxy
```

State: TanStack Query for server data, React Context for auth, local state for UI.

## Android App Architecture (Kotlin)

### Libraries
| Concern | Library |
|---|---|
| UI | Jetpack Compose (Material 3) |
| Navigation | Compose Navigation |
| Network | Retrofit + OkHttp + kotlinx.serialization |
| Local cache | Room |
| DI | Hilt |
| Async | Coroutines + Flow |
| Charts | Vico |

### Structure (`android/app/src/main/`)
```
di/                          -- Hilt modules
data/
  remote/                    -- Retrofit interface, auth interceptor, DTOs
  local/                     -- Room DB, DAOs, entities
  repository/                -- repositories (auth, account, transaction, category, report)
ui/
  navigation/NavGraph.kt
  screens/                   -- login, dashboard, transactions, accounts, reports (Screen + ViewModel per screen)
  components/                -- shared composables
  theme/                     -- Material 3 theme
```

MVVM pattern. Single Activity. Room as lightweight cache only (server is source of truth). Server URL configured in settings, stored in DataStore.

## Docker Compose

```yaml
services:
  db:       postgres:16-alpine  (volume: pgdata, healthcheck)
  backend:  ./backend           (depends on db, env: DATABASE_URL, JWT_SECRET)
  frontend: ./frontend          (depends on backend, ports: 80, 443)
```

`.env` file (git-ignored) holds `DB_PASSWORD` and `JWT_SECRET`.

## Repository Root Layout

```
finance-tracker-cc/
  .env.example
  .gitignore
  docker-compose.yml
  Makefile                   -- up, down, migrate, sqlc, dev-backend, dev-frontend
  backend/
  frontend/
  android/
```

## Implementation Phases

1. **Foundation** — Go project scaffold, initial DB migration, auth endpoints, Docker Compose with PostgreSQL
2. **Core CRUD** — Account, category, transaction handlers with filtering/pagination
3. **Web frontend (basic)** — React scaffold, auth pages, dashboard, transaction list/forms
4. **Reports & import** — Report endpoints + charts, CSV import backend + frontend
5. **Polish** — Error handling, loading/empty states, dark mode
6. **Android app** — Scaffold, auth, dashboard, transactions, reports

## Verification

- Backend: `curl` or httpie against API endpoints; `go test ./...` for unit tests
- Frontend: `npm run dev` with Vite dev server proxying to backend
- Full stack: `docker compose up`, navigate to `http://localhost`, test all flows
- Android: Run against the Docker-hosted backend from emulator/device
