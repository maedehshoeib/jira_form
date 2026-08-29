.PHONY: up down logs dev-backend dev-frontend test lint typecheck build

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f web backend

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
