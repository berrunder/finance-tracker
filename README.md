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

## Production Deployment

Images are built locally and pushed to a container registry (e.g. GHCR), then pulled on the VPS.

Set `IMAGE_REGISTRY` in your `.env` (e.g. `ghcr.io/your-github-username`), then:

```sh
# Locally — build and push
make prod-build                  # Build images and tag for registry
make prod-push                   # Push backend & frontend to registry

# On VPS — pull and run
make prod-deploy                 # Pull images and start services
```

The `docker-compose.prod.yml` override:
- Sets image names from `IMAGE_REGISTRY` for backend and frontend
- Removes exposed ports from `db` and `backend` (only reachable within the Docker network)
- Binds the frontend to `127.0.0.1:8000` (localhost only, not accessible from the internet)
- Adds `restart: unless-stopped` to all services

Point your host nginx (or another reverse proxy) at `127.0.0.1:8000` with TLS termination. Example nginx site config:

```nginx
server {
    listen 443 ssl http2;
    server_name finance.example.com;

    ssl_certificate     /etc/letsencrypt/live/finance.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/finance.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
```

### Secrets

Copy `.env.example` to `.env` on the server and fill in real values. Generate secrets with:

```sh
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # DB_PASSWORD
```

Restrict file permissions: `chmod 600 .env`. The `.env` file must never be committed to git.

## Environment Variables

Required: `DATABASE_URL` (postgres connection string), `JWT_SECRET` (HMAC key, 32+ chars), `INVITE_CODES` (comma-separated list of valid registration invite codes). Optional: `PORT` (default 8080), `EXCHANGE_RATE_SYNC_MODE` (`"endpoint"` default or `"background"`), `EXCHANGE_RATE_SYNC_TOKEN` (static token for sync endpoint). Production: `IMAGE_REGISTRY` (container registry prefix, e.g. `ghcr.io/username`), `VITE_BASE_PATH` (frontend URL base path, e.g. `/finance/`, default `/`).
