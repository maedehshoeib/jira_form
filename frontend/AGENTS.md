# Codex frontend instructions

This file extends the repository-root `AGENTS.md` for all work under `frontend/`.

## Read first

Before editing, inspect the route group, provider, feature public `index.ts`, API client, and relevant shadcn primitive. Read `package.json`, `.env.example`, `components.json`, `next.config.ts`, `docs/08-architecture-standards.md`, and installed Next.js documentation for framework-sensitive work.

## Target architecture

```text
src/app/(auth)/          guest route group (login, change-password)
src/app/(portal)/        authenticated product routes
src/app/(admin)/admin/   admin routes
src/app/_components/     route helpers only (ProtectedFeature, RedirectTo)
src/features/<domain>/   screens, private components, api, hooks, types + public index.ts
src/components/ui/       vendored AMSeify/Shadcn-UI-Kit primitives (only UI system)
src/components/shared/   cross-domain UI (date pickers, etc.)
src/components/layout/   shells; must not deep-import feature internals
src/api/, src/lib/       typed clients and framework-neutral utilities
```

### Route groups

- Place new pages under `(auth)`, `(portal)`, or `(admin)` as appropriate.
- Route groups must preserve existing public URLs.
- Prefer group-level layouts for guest vs portal vs admin chrome; keep page modules thin.

### Feature isolation

- Import domains only through `src/features/<domain>/index.ts`.
- Never reach into another feature's `screens/`, `components/`, `api/`, or `hooks/`.
- If two features need the same UI, move it to `components/shared` (or promote a tiny public export).
- Flat one-file domains must become a proper `features/<domain>/` folder or live under `lib` / `components/shared`.
- Until an eslint boundary plugin is added, treat cross-feature private imports as a hard agent rule.

### Abstraction

- Pages: composition and route wiring only.
- Screens: orchestrate hooks/api and compose components.
- Components: presentational units; prefer many small abstracted components over monolithic screens.
- When touching a domain, split oversized screens toward the 300-line file limit.

## UI and RTL

- Use shadcn primitives from `src/components/ui` (vendored from `AMSeify/Shadcn-UI-Kit`) and `cn()` from `src/lib/utils`.
- Never add raw form controls or tables in page/feature code; extend the kit layer when a primitive is missing.
- Sync kit updates deliberately; pin the kit commit in `docs/08-architecture-standards.md`. Do not vendor demo dashboards/apps wholesale.
- Use CSS variables and semantic Tailwind tokens; do not introduce a second component system.
- Preserve Persian copy, `lang="fa"`, `dir="rtl"`, keyboard access, focus visibility, and responsive behavior.
- Use logical alignment and spacing so mixed Persian/Latin content remains correct.
- Add explicit loading, empty, error, validation, unauthorized, and disabled states.
- Use `next/image` for new static images when practical; existing compatibility assets may use `assetUrl()`.

## Data and forms

- Browser REST requests remain relative to `/api/v1`; the App Router handler in `src/app/api/v1/[...path]/route.ts` proxies them to `BACKEND_URL`.
- Never expose credentials through `NEXT_PUBLIC_*`. Only public browser configuration may use that prefix.
- Keep API payloads typed outside visual components (`features/<domain>/api` or `src/api`).
- Use React Query for server state where already established; do not mirror remote data unnecessarily.
- Use React Hook Form and Zod for new or substantially rewritten forms.
- Preserve WebSocket reconnect and unread behavior when changing chat.
- Layout/shell code may consume only a feature's public `index.ts` API (for example chat unread helpers), never private modules.

## Quality gates

Run the narrow check first, then all frontend gates:

```bash
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
- No new cross-feature private imports.
- New environment variables documented.
- Lint, TypeScript, and production build pass.
- User-facing or architectural changes documented under `docs/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
