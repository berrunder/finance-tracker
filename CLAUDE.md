# CLAUDE.md

Guidance for Claude Code working in this repository.

## Repo Structure

Monorepo: Go API in `/backend`, React app in `/frontend`.

## Commands

```sh
# Infrastructure
docker compose up -d db          # Start PostgreSQL
make up                          # Full stack (docker compose up -d --build)
make down                        # docker compose down
make migrate                     # Run DB migrations manually

# Backend
make dev-backend                 # Run API locally
make sqlc                        # Regenerate sqlc code after editing queries/*.sql
cd backend && go test ./...      # Run all tests
cd backend && go test ./internal/service/ -run TestFunctionName  # Single test

# Frontend
make dev-frontend                # Vite dev server (proxies /api to :8080)
cd frontend && npm run build     # Type-check + production build
cd frontend && npm run lint      # ESLint
cd frontend && npm run check:types  # TypeScript check only
cd frontend && npm test          # Run all tests (Vitest)
```

## Environment Variables

Required: `DATABASE_URL` (postgres connection string), `JWT_SECRET` (HMAC key, 32+ chars), `INVITE_CODES` (comma-separated list of valid registration invite codes). Optional: `PORT` (default 8080), `EXCHANGE_RATE_SYNC_MODE` (`"endpoint"` default or `"background"`), `EXCHANGE_RATE_SYNC_TOKEN` (static token for sync endpoint). Production: `IMAGE_REGISTRY` (container registry prefix, e.g. `ghcr.io/username`), `VITE_BASE_PATH` (frontend URL base path, e.g. `/finance/`, default `/`).

## Specifications

Frontend-specific guidance in `frontend/CLAUDE.md`.
Backend-specific guidance in `backend/CLAUDE.md`.

## Code Quality

- When fixing linter or type errors, prefer proper configuration changes (e.g., ESLint rules, tsconfig settings) over inline disables or quick-fix suppressions. Always ask before adding eslint-disable comments.

## Conventions

- API changes must be reflected in [backend/docs/API.md](backend/docs/API.md)
- Backend architecture changes must be reflected in [backend/docs/ARCHITECTURE.md](backend/docs/ARCHITECTURE.md)
- Backend feature changes must be reflected in [backend/README.md](backend/README.md)
- When adding new environment variables, update all of: the `Environment Variables` section in this file, `README.md`, `.env.example`, and `docker-compose.yml`.
- When the user asks for a code review or simplification suggestions, present findings first and wait for user approval before implementing changes. Do not continue fixing iteratively without checking in.
