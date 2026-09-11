# Codex backend instructions

This file extends the repository-root `AGENTS.md` for all work under `backend/`.

## Read first

Before editing, inspect the touched route, schema, service class, repository class, model, and relevant tests. Read `requirements.txt`, the root `.env.example`, `app/core/config.py`, and `docs/08-architecture-standards.md` before changing dependencies or configuration.

## Architecture (OOP)

The required flow is:

```text
FastAPI route -> DomainService (class) -> DomainRepository (class) -> SQLAlchemy model/session
              -> Pydantic request/response schema
```

- Routes own HTTP validation, dependency injection, authorization, and response mapping. They must not grow new ORM query/workflow logic.
- Services are classes constructed with a `Session` (and collaborators). They own business rules, transaction orchestration, workflow state, and external HTTP.
- Repositories are classes that own reusable query construction; models own declarations only.
- Schemas define stable request and response contracts.
- Prefer `Depends` factories that return service instances (`get_calendar_service`, etc.).
- Shared bases live in `app/services/base.py` and `app/repositories/base.py`.
- Gold-standard reference domain: **calendar** (`CalendarService` + `CalendarRepository`). Migrate other domains to the same pattern when touched.

Keep route handlers at most 60 lines, service methods at most 80 lines, and modules at most 300 lines. Split by domain responsibility when limits are exceeded.

## Stack

- FastAPI for HTTP
- Pydantic / pydantic-settings for boundaries and config
- SQLAlchemy 2.x mapped models + parameterized Session queries
- Alembic for PostgreSQL schema migrations
- PostgreSQL as the authoritative database

## API and persistence

- Preserve the `/api/v1` prefix, response fields, status codes, and authorization behavior unless explicitly approved.
- Use dependency-provided sessions and parameterized SQLAlchemy queries.
- Make transaction ownership obvious inside the service; avoid commits scattered across helpers.
- Database schema changes require an Alembic revision compatible with PostgreSQL and the existing SQLite data importer.
- Never edit or delete user databases, uploads, or seed sources during tests.
- Dates and times follow `app/core/timezone.py` and the existing Jalali/Gregorian boundaries.

## Auth, files, and integrations

- Use existing auth/admin dependencies; UI checks are never sufficient authorization.
- Hash passwords through existing security helpers and never log credentials or bearer tokens.
- Validate upload size, extension, MIME, ownership, and normalized paths.
- Put Jira and other outbound HTTP in service classes using `httpx` with explicit timeouts.
- Retry only bounded, idempotent operations. Do not silently retry submissions or workflow writes.
- Sanitize upstream errors before returning them to clients.

## Migration debt

Fat route modules (`timesheet`, `portal`, `admin`, `chat`, and others) still contain ORM workflows. Do not expand that pattern. When changing those domains, extract toward service + repository classes. Track remaining migrations in `docs/08-architecture-standards.md`.

## Tests and commands

Add or update tests for behavior changes, especially authorization, validation, workflow transitions, timezone edges, duplicate requests, and partial integration failures.

```bash
cd backend
python -m pytest tests/test_relevant_domain.py -q
python -m pytest
python -c "import app.main"
```

If a required test dependency is missing, report it explicitly; do not claim the suite passed.

## Completion checklist

- API contract preserved or documented.
- Authorization verified server-side.
- New work uses service + repository classes (or documents why not).
- New configuration documented in `.env.example`.
- Relevant tests and import smoke check run.
- Integration changes reflected in `docs/05-api-and-integrations.md`.
