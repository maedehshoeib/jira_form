# Next.js migration plan

## Current milestone

The build system, root layout, providers, metadata, loading/error boundaries, API rewrites, shadcn config, and production container use Next.js. All legacy URLs are preserved by a client compatibility route.

## Incremental route migration

For each route group:

1. Characterize the current route, authorization, API calls, and redirects.
2. Extract feature logic from `src/legacy-pages` into `src/features/<domain>`.
3. Replace React Router links and hooks with `next/link` and `next/navigation`.
4. Create a native `src/app/.../page.tsx` plus loading/error states.
5. Remove the matching route from `src/App.tsx` only after parity verification.

Suggested order: auth/profile, home/departments/forms, requests/tasks, timesheet/calendar/chat, management/contracts/reports, then admin.

## Completion criteria

- No dependency on `react-router-dom`.
- `src/App.tsx`, `src/legacy-pages`, and the catch-all compatibility route are removed.
- Protected layout and admin layout enforce their route groups.
- Direct navigation and refresh work for every documented URL.
- Type check, lint, build, and relevant browser tests pass.
