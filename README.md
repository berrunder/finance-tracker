# Finance Tracker

Small-scale personal finance tracker made mainly as exercise in agentic coding with Claude Code.

## Structure

Repository contains both backend and frontend for simplicity - Go API in `/backend`, React app in `/frontend`. Architecture and implementation details can be found in readmes and other docs in corresponding folders.

Project uses docker-compose for deploying.

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
