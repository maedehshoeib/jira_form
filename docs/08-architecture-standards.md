# Architecture standards

This document is the OCD target architecture for Jira Form Portal. Agent rules in `AGENTS.md` and `.cursor/rules/` must stay consistent with it.

## Goals

1. Feature and domain changes must not break unrelated features.
2. UI is fully component-based with clear abstraction layers.
3. Backend is FastAPI + Pydantic + SQLAlchemy + Alembic + PostgreSQL with OOP services and repositories.
4. Frontend uses Next.js App Router route groups and vendored shadcn kit primitives only.

## Frontend

### Route groups

```text
src/app/(auth)/          # /login, /change-password
src/app/(portal)/        # product routes (URLs unchanged)
src/app/(admin)/admin/   # /admin/*
```

Route groups never appear in the URL.

### Feature package

```text
features/<domain>/
  index.ts       # public API only
  screens/
  components/    # private
  api/
  hooks/
  types/
```

Illegal: `features/a` importing `features/b/screens|components|api|hooks`.
Legal: import from `features/b` (public `index.ts`), `components/shared`, `components/ui`, `lib`, `api`.

### UI kit pin

- Source: private repo `AMSeify/Shadcn-UI-Kit` (access via `gh` as an authorized account).
- Vendored into `frontend/src/components/ui`.
- Do not vendor kit demo dashboards/apps wholesale.
- Kit commit pin: see "Kit sync log" below; update when re-syncing.

### Shared UI

Cross-domain widgets (for example Jalali date/time pickers) live in `components/shared`, not under a single feature.

## Backend

```text
Route (thin) → DomainService (class) → DomainRepository (class) → Model
            → Pydantic schemas
```

- Bases: `app/services/base.py`, `app/repositories/base.py`
- Gold-standard domain: **calendar**
- Alembic owns schema; SQLite importer remains data-only and idempotent

## Migration debt (deferred)

| Area | Status |
|---|---|
| Fat screens (`MyTasksPage`, `MyRequestsPage`, admin dashboard, letters, chat) | Split when domain is touched; bulk rewrite deferred |
| Fat routes (`timesheet`, `portal`, `admin`, `chat`, auth) | Extract to OOP service/repo when touched; calendar done as template |
| Kit theme customizer / demo dashboards | Not imported |
| ESLint feature-boundary plugin | Documented as agent rule until added |

## Kit sync log

| Date | Kit ref | Notes |
|---|---|---|
| 2026-09-11 | `AMSeify/Shadcn-UI-Kit@b3509140cc03675834409fe9e4af2f5d4c69e6db` | Vendored `components/ui` primitives; kept portal `native-select`; button sizes retain `xs` / `icon-xs`. Adapted Tailwind v4 kit class syntax (`w-(--token)`, `--spacing(...)`) to Tailwind 3-compatible `var()` arbitrary values. Deferred until npm registry reachable: `chart`, `carousel`, `command`, `drawer`, `sonner`, `input-otp`, `calendar`, `resizable` (need recharts/cmdk/vaul/etc.). |

## Verification

```bash
cd frontend && npm run lint && npx tsc --noEmit && npm run build
cd backend && python -m pytest
```
