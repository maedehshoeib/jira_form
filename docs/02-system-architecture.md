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

`api/routes` performs validation and dependency injection, `services` owns business rules and integrations, `models` owns persistence, and `schemas` defines API contracts.

## Frontend layers

`app` owns routing and layouts, `components/ui` contains shadcn primitives, `features` owns domain modules, `lib` contains shared utilities and clients, and `context` contains narrowly scoped client providers.

During migration, `app/[[...slug]]` is a compatibility boundary for the existing `legacy-pages` screen tree. It is not the target architecture for new work.
