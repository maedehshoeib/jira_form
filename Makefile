.PHONY: up down logs init_db init-db dev-backend dev-frontend test lint typecheck build

COMPOSE ?= docker compose
COMPOSE_PROJECT_NAME ?= jira_form

up:
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) $(COMPOSE) up --build -d

down:
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) $(COMPOSE) down

init_db: init-db

init-db:
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) $(COMPOSE) up -d postgres
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) $(COMPOSE) --profile tools run --build --rm init-db

logs:
	COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT_NAME) $(COMPOSE) logs -f web backend

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test:
	cd backend && python -m pytest

lint:
	cd frontend && npm run lint

typecheck:
	cd frontend && npx tsc --noEmit

build:
	cd frontend && npm run build
