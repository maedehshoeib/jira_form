# Next.js migration record

## Completed milestone

The build system, root layout, providers, metadata, loading/error boundaries, API
rewrites, shadcn config, and production container use Next.js. Every supported
URL now has a native App Router page. React Router, `src/App.tsx`,
`src/legacy-pages`, and the catch-all compatibility route were removed.

## Ongoing feature extraction

For each route group:

1. Characterize the current route, authorization, API calls, and redirects.
2. Keep domain behavior in `src/features/<domain>` and export its public surface from `index.ts`.
3. Keep App Router pages limited to protection, redirects, and feature composition.
4. Extract large screens into typed components, hooks, API adapters, constants, and utilities.
5. Verify direct navigation, refresh, redirects, and authorization after each extraction.

## Completed route criteria

- No dependency on `react-router-dom`.
- `src/App.tsx`, `src/legacy-pages`, and the catch-all compatibility route are removed.
- Protected layout and admin layout enforce their route groups.
- Direct navigation and refresh work for every documented URL.
- Type check, lint, build, and relevant browser tests pass.
