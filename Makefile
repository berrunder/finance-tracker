.PHONY: up down migrate sqlc dev-backend dev-frontend

up:
	docker compose up -d --build

down:
	docker compose down

migrate:
	cd backend && go run -tags migrate cmd/migrate/main.go

sqlc:
	cd backend && sqlc generate

dev-backend:
	cd backend && go run cmd/api/main.go

dev-frontend:
	cd frontend && npm run dev
