# Jira Form Portal

Persian-first internal service portal for forms, requests, tasks, reports, timesheets, calendars, documents, contracts, management correspondence, administration, and internal chat.

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Backend: FastAPI, SQLAlchemy, Pydantic, SQLite
- Runtime: separate `web` and `backend` containers with Docker Compose

## Quick start with Docker

```bash
copy .env.example .env
docker compose up --build -d
docker compose logs -f web backend
```

Open the web portal at `http://localhost:8080`. FastAPI is available at `http://localhost:8000`, including OpenAPI at `/docs`.

## Local development

Backend:

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. The Next.js server forwards `/api/*` to the FastAPI URL configured by `BACKEND_URL`.

## Verification

```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd backend && pytest
```

## Documentation

Start with [`docs/README.md`](docs/README.md). Repository-wide agent guidance is in [`AGENTS.md`](AGENTS.md), with scoped Cursor rules under [`.cursor/rules`](.cursor/rules).

The frontend is on the Next.js stack now. Existing screens currently run through a documented compatibility boundary while they are migrated route-by-route to native App Router modules; see [`docs/04-nextjs-migration.md`](docs/04-nextjs-migration.md).
