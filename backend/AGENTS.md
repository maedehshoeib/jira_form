# Codex backend instructions

This file extends the repository-root `AGENTS.md` for all work under `backend/`.

## Read first

Before editing, inspect the touched route, its schema, service, model, and relevant tests. Read `requirements.txt`, the root `.env.example`, and `app/core/config.py` before changing dependencies or configuration.

## Architecture

The required flow is:

```text
FastAPI route -> service -> SQLAlchemy model/session
              -> Pydantic request/response schema
```

- Routes own HTTP validation, dependency injection, authorization, and response mapping.
- Services own business rules, transaction orchestration, workflow state, and external HTTP.
- Models own persistence declarations only.
- Schemas define stable request and response contracts.
- Extract a repository only when query complexity or duplication justifies it; do not add abstraction by default.

Keep route handlers at most 60 lines, service functions at most 80 lines, and modules at most 300 lines. Split by domain responsibility when limits are exceeded.

## API and persistence

- Preserve the `/api/v1` prefix, response fields, status codes, and authorization behavior unless explicitly approved.
- Use dependency-provided sessions and parameterized SQLAlchemy queries.
- Make transaction ownership obvious; avoid commits scattered across helpers.
- Database changes require an idempotent migration strategy compatible with existing SQLite data.
- Never edit or delete user databases, uploads, or seed sources during tests.
- Dates and times follow `app/core/timezone.py` and the existing Jalali/Gregorian boundaries.

## Auth, files, and integrations

- Use existing auth/admin dependencies; UI checks are never sufficient authorization.
- Hash passwords through existing security helpers and never log credentials or bearer tokens.
- Validate upload size, extension, MIME, ownership, and normalized paths.
- Put Jira and other outbound HTTP in services using `httpx` with explicit timeouts.
- Retry only bounded, idempotent operations. Do not silently retry submissions or workflow writes.
- Sanitize upstream errors before returning them to clients.

## Tests and commands

Add or update tests for behavior changes, especially authorization, validation, workflow transitions, timezone edges, duplicate requests, and partial integration failures.

```powershell
cd backend
python -m pytest tests/test_relevant_domain.py -q
python -m pytest
python -c "import app.main"
```

If a required test dependency is missing, report it explicitly; do not claim the suite passed.

## Completion checklist

- API contract preserved or documented.
- Authorization verified server-side.
- New configuration documented in `.env.example`.
- Relevant tests and import smoke check run.
- Integration changes reflected in `docs/05-api-and-integrations.md`.
