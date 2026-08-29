# Codex frontend instructions

This file extends the repository-root `AGENTS.md` for all work under `frontend/`.

## Read first

Before editing, inspect the route, provider, feature module, API client, and relevant shadcn primitive. Read `package.json`, `.env.example`, `components.json`, `next.config.ts`, and installed Next.js documentation for framework-sensitive work.

## Target architecture

```text
src/app/             App Router pages, layouts, loading/error boundaries
src/features/        Domain UI, hooks, state, typed transport adapters
src/components/ui/   shadcn primitives
src/components/      Shared composition components
src/api/, src/lib/   Typed clients and framework-neutral utilities
src/legacy-pages/    Temporary compatibility screens only
```

- Add new routes under `src/app`; never add routes to `src/App.tsx`.
- Prefer Server Components. Use `"use client"` only for hooks, events, browser APIs, or client-only libraries.
- Keep page modules focused on routing and data wiring; feature modules own interaction logic.
- Use `next/link` and `next/navigation` in migrated routes.
- Remove a legacy route only after direct navigation, refresh, redirects, and authorization reach parity.

Follow the staged process in `docs/04-nextjs-migration.md`.

## UI and RTL

- Use shadcn primitives from `src/components/ui` and `cn()` from `src/lib/utils`.
- Use CSS variables and semantic Tailwind tokens; do not introduce a second component system.
- Preserve Persian copy, `lang="fa"`, `dir="rtl"`, keyboard access, focus visibility, and responsive behavior.
- Use logical alignment and spacing so mixed Persian/Latin content remains correct.
- Add explicit loading, empty, error, validation, unauthorized, and disabled states.
- Use `next/image` for new static images when practical; existing compatibility assets may use `assetUrl()`.

## Data and forms

- Browser REST requests remain relative to `/api/v1`; server-only routing uses `BACKEND_URL`.
- Never expose credentials through `NEXT_PUBLIC_*`. Only public browser configuration may use that prefix.
- Keep API payloads typed outside visual components.
- Use React Query for server state where already established; do not mirror remote data unnecessarily.
- Use React Hook Form and Zod for new or substantially rewritten forms.
- Preserve WebSocket reconnect and unread behavior when changing chat.

## Quality gates

Run the narrow check first, then all frontend gates:

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev --audit-level=high
```

Treat React compiler findings in legacy screens as migration debt. Do not disable new lint rules globally without documenting why and adding a cleanup path.

## Completion checklist

- Existing URLs and redirects still work.
- Auth/admin boundaries and RTL verified.
- New environment variables documented.
- Lint, TypeScript, and production build pass.
- User-facing or architectural changes documented under `docs/`.
