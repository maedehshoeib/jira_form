# System architecture

## Runtime

```text
Browser -> Next.js web (:3000 / Docker :8080)
             |-- UI and route delivery
             `-- /api/v1/* Route Handler proxy -> FastAPI (:8000)
                                      |-- PostgreSQL
                                      |-- upload volume
                                      `-- Jira integration
```

FastAPI no longer serves a compiled SPA. Next.js and FastAPI are independently buildable containers. Imported frontend images live in `src/assets`; stable public resources belong in `frontend/public`.

PostgreSQL is the authoritative database. The `portal_data` volume still holds
uploads and the two legacy SQLite files. On the first startup against an empty
PostgreSQL volume, FastAPI transactionally imports both SQLite stores and records
completion in `app_data_migrations`; the SQLite files are retained as a rollback
copy.

## Backend layers

`api/router.py` is the API composition root. `api/routes` owns HTTP validation,
authorization, and dependency injection. Domain **service classes** own workflows
and transactions. Domain **repository classes** own reusable query construction.
`models` declares persistence; `schemas` defines stable API contracts. New work
must follow route → service → repository (see calendar as the gold standard).

Alembic owns PostgreSQL schema versions under `backend/alembic`. Application
startup upgrades the schema before the idempotent SQLite-to-PostgreSQL data import.

## Frontend layers

`app` uses Next.js route groups `(auth)`, `(portal)`, and `(admin)` for thin
route compositions and layouts without changing public URLs. `components/ui`
holds vendored shadcn kit primitives from `AMSeify/Shadcn-UI-Kit`.
`components/shared` holds cross-domain UI. `features/<domain>` owns screens,
private components, types, and transport adapters behind a public `index.ts`.
`lib` and `api` contain framework-neutral shared infrastructure; `context`
contains narrowly scoped client providers.

The React Router compatibility tree has been removed. All supported URLs are
native App Router routes.

Deep standards, isolation rules, kit pinning, and migration debt:
[08-architecture-standards.md](08-architecture-standards.md).
