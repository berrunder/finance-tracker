.PHONY: up down migrate sqlc dev-backend dev-frontend prod-build prod-push prod-deploy

COMPOSE_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

up:
	docker compose up -d --build

down:
	docker compose down

prod-build:
	$(COMPOSE_PROD) build

prod-push:
	$(COMPOSE_PROD) push backend frontend

prod-deploy:
	$(COMPOSE_PROD) pull backend frontend
	$(COMPOSE_PROD) up -d

migrate:
	cd backend && go run -tags migrate cmd/migrate/main.go

sqlc:
	cd backend && sqlc generate

dev-backend:
	cd backend && go run cmd/api/main.go

dev-frontend:
	cd frontend && npm run dev
