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
```

- Add routes under `src/app` as thin composition modules.
- Import domains through `src/features/<domain>/index.ts`; do not reach into another feature's private screen files.
- Prefer Server Components. Use `"use client"` only for hooks, events, browser APIs, or client-only libraries.
- Keep page modules focused on routing and data wiring; feature modules own interaction logic.
- Use `next/link` and `next/navigation` in migrated routes.
- Preserve direct navigation, refresh, redirects, and authorization behavior.

Follow the staged process in `docs/04-nextjs-migration.md`.

## UI and RTL

- Use shadcn primitives from `src/components/ui` and `cn()` from `src/lib/utils`.
- Never add raw form controls or tables in page/feature code; extend the shared
  shadcn layer when a primitive is missing.
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
