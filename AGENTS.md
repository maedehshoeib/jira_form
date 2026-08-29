# Agent instructions — Jira Form Portal

These instructions apply to every edit in this repository. Detailed role rules live in `.cursor/rules/*.mdc`.

## Project identity

| Area | Stack |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic, PostgreSQL |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Language and direction | Persian-first, RTL |
| Local ports | web `3000`, API `8000` |
| Production entry | Docker Compose; web exposed at `8080` |
| Alias | `@/*` maps to `frontend/src/*` |

## Repository layout

```text
backend/app/          FastAPI routes, services, models, schemas, core
backend/tests/        pytest suite
frontend/src/app/     Next.js layouts, route boundary, loading and errors
frontend/src/legacy-pages/   legacy screens being migrated feature by feature
frontend/src/components/ui/  shadcn primitives
frontend/src/features/       feature modules
docs/                 architecture, operation, and migration guidance
.cursor/rules/        scoped agent rules
backend/AGENTS.md     Codex backend-specific instruction layer
frontend/AGENTS.md    Codex frontend-specific instruction layer
```

## Agent instruction map

Cursor uses `.cursor/rules/*.mdc`; see `.cursor/rules/README.md` for the role index. Codex reads this root file and then the closest nested `AGENTS.md`, so backend work inherits `backend/AGENTS.md` and frontend work inherits `frontend/AGENTS.md`.

The two systems express the same boundaries. If duplicated guidance differs, this root file is the project-level source of truth and the closest scoped file may only refine it for its directory.

## Required workflow

1. Read the touched code and relevant `.env.example` files before editing.
2. Preserve API shapes and current Persian RTL behavior during refactors.
3. Keep FastAPI routes thin and page components free of business logic.
4. Use shadcn primitives and theme tokens for new UI.
5. Document environment, architecture, or user-flow changes in `docs/`.
6. Run the narrowest relevant tests, then TypeScript and production builds.

## Current frontend migration boundary

`frontend/src/app/[[...slug]]/page.tsx` hosts the legacy React Router tree so every existing URL remains functional. New screens use native App Router routes. Migrate legacy routes incrementally according to `docs/04-nextjs-migration.md`; do not add new routes to `src/App.tsx`.

## Quality gates

```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd backend && pytest
```

Never commit secrets, generated dependency folders, `.next`, databases, uploads, or local environment files.
