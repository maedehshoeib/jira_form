# Developer guide

## Local development

Start FastAPI:

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Start Next.js in another terminal:

```bash
cd frontend
copy .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. Next.js forwards `/api/*` to `BACKEND_URL`, which defaults to `http://localhost:8000`.

## Frontend conventions

- Use native App Router routes for new pages.
- Import a feature through `src/features/<domain>/index.ts`; treat its other files as private.
- Add `"use client"` only at interactive/browser boundaries.
- Use `@/` imports, shadcn primitives, CSS variables, and logical RTL-safe spacing.
- Page code must use shared controls from `src/components/ui`; do not add raw
  `button`, `input`, `textarea`, `select`, `label`, or `table` elements outside a
  primitive implementation.
- Use semantic tokens such as `background`, `card`, `muted`, `foreground`,
  `border`, `primary`, and `destructive`. Do not hard-code neutral page palettes.
- Tailwind remains only as shadcn/ui's styling engine. UI behavior and visual
  variants belong in reusable shadcn primitives rather than page-local utility
  recipes or a second component library.
- Keep remote data in typed API functions or React Query hooks.
- Include loading, empty, error, unauthorized, and validation states.

## Verification

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` for frontend changes.
Run targeted pytest files first, then `python -m pytest` for backend changes.
For a schema change, create a revision from `backend` with
`python -m alembic revision --autogenerate -m "description"` and inspect the
generated upgrade and downgrade before committing it.

## User appearance preferences

The profile page includes a theme color picker backed by `ThemeContext`. The selected
accent palette is stored in browser local storage under `portal_theme_color` and is
applied through the `data-theme-color` attribute on the root HTML element. Palette
definitions live in `src/index.css` and must continue to define semantic `primary`,
`accent`, and `ring` tokens for both light and dark modes.

Sidebar colors use the separate `sidebar-*` token family and intentionally remain red
for every accent palette.
