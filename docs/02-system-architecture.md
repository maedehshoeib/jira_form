# System architecture

## Runtime

```text
Browser -> Next.js web (:3000 / Docker :8080)
             |-- UI and route delivery
             `-- /api/* rewrite -> FastAPI (:8000)
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
authorization, and dependency injection; `services` owns workflows and
transactions; `repositories` owns reusable query construction; `models` declares
persistence; and `schemas` defines stable API contracts.

Alembic owns PostgreSQL schema versions under `backend/alembic`. Application
startup upgrades the schema before the idempotent SQLite-to-PostgreSQL data import.

## Frontend layers

`app` contains thin native route compositions and layouts, `components/ui`
contains shadcn primitives, and `features/<domain>` owns screens, components,
types, constants, utilities, and transport adapters. Every feature exposes a
public `index.ts`; cross-domain consumers should use that public API. `lib` and
`api` contain framework-neutral shared infrastructure, while `context` contains
narrowly scoped client providers.

The React Router compatibility tree has been removed. All supported URLs are
native App Router routes.
