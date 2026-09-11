# Agent instructions — Jira Form Portal

These instructions apply to every edit in this repository. Detailed role rules live in `.cursor/rules/*.mdc`. Architecture standards live in `docs/08-architecture-standards.md`.

## Project identity

| Area | Stack |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic, PostgreSQL, OOP services/repos |
| Frontend | Next.js App Router (route groups), TypeScript, Tailwind CSS, shadcn/ui (vendored from AMSeify/Shadcn-UI-Kit) |
| Language and direction | Persian-first, RTL |
| Local ports | web `3000`, API `8000` |
| Production entry | Docker Compose; web exposed at `8080` |
| Alias | `@/*` maps to `frontend/src/*` |

## Repository layout

```text
backend/app/
  api/routes/       thin HTTP handlers (DI, authz, schema mapping)
  services/         OOP domain services (business rules, transactions)
  repositories/     OOP query repositories
  models/           SQLAlchemy persistence
  schemas/          Pydantic request/response contracts
  core/             config, security, deps, timezone
backend/alembic/    versioned PostgreSQL schema migrations
backend/tests/      pytest suite

frontend/src/app/
  (auth)/           guest routes (login, change-password)
  (portal)/         authenticated product routes
  (admin)/          admin routes under /admin/*
  _components/      route helpers only
  api/v1/           BFF proxy to BACKEND_URL
frontend/src/features/<domain>/
  index.ts          ONLY public API for other packages
  screens/ components/ api/ hooks/ types/
frontend/src/components/ui/      vendored shadcn kit primitives
frontend/src/components/shared/  cross-domain UI (never feature-private)
frontend/src/components/layout/  shells and chrome
frontend/src/api/, lib/          typed clients and utilities

docs/                 architecture, operation, and migration guidance
.cursor/rules/        scoped agent rules
backend/AGENTS.md     Codex backend-specific instruction layer
frontend/AGENTS.md    Codex frontend-specific instruction layer
```

## Agent instruction map

Cursor uses `.cursor/rules/*.mdc`; see `.cursor/rules/README.md` for the role index. Codex reads this root file and then the closest nested `AGENTS.md`.

If duplicated guidance differs, this root file is the project-level source of truth and the closest scoped file may only refine it for its directory.

## Required workflow

1. Read the touched code, `docs/08-architecture-standards.md`, and relevant `.env.example` files before editing.
2. Preserve `/api/v1` contracts and current public URLs during refactors (route groups must not change URLs).
3. Keep FastAPI routes thin and App Router pages free of business logic.
4. Use only vendored shadcn kit primitives from `components/ui`; no second UI system.
5. Features import other domains only through that domain's `index.ts`, or through `components/shared` / `lib` / `api`.
6. Backend new work uses class-based `Service` + `Repository` with session DI; no new ORM workflows in routes.
7. Document environment, architecture, or user-flow changes in `docs/`.
8. Run the narrowest relevant tests, then TypeScript and production builds.

## Module boundaries

- App Router pages are composition-only and import domains through `frontend/src/features/<domain>/index.ts`.
- Features never import another feature's private screens/components/api files.
- Backend dependencies flow: route → service class → repository class → model.
- Schema changes require Alembic revisions; the SQLite importer remains data-only and idempotent.

## Quality gates

```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd backend && python -m pytest
```

Never commit secrets, generated dependency folders, `.next`, databases, uploads, or local environment files.
