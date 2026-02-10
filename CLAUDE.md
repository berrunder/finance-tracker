# CLAUDE.md

Guidance for Claude Code working in this repository.

## Repo Structure

Monorepo: Go API in `/backend`, React app in `/frontend` (TBD).

## Commands

```sh
# Infrastructure
docker compose up -d db          # Start PostgreSQL
make up                          # Full stack (docker compose up -d --build)
make down                        # docker compose down

# Backend
make dev-backend                 # Run API locally
make sqlc                        # Regenerate sqlc code after editing queries/*.sql
cd backend && go test ./...      # Run all tests
cd backend && go test ./internal/service/ -run TestFunctionName  # Single test

# Frontend (TBD)
make dev-frontend
```

## Environment Variables

Required: `DATABASE_URL` (postgres connection string), `JWT_SECRET` (HMAC key, 32+ chars), `INVITE_CODES` (comma-separated list of valid registration invite codes). Optional: `PORT` (default 8080).

## Conventions

- API changes must be reflected in [backend/docs/API.md](backend/docs/API.md)
- Architecture changes must be reflected in [backend/docs/Architecture.md](backend/docs/Architecture.md)
- Backend feature changes must be reflected in [backend/README.md](backend/README.md)
