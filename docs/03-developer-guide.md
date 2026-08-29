# Developer guide

## Local development

Start FastAPI:

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
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
- Add `"use client"` only at interactive/browser boundaries.
- Use `@/` imports, shadcn primitives, CSS variables, and logical RTL-safe spacing.
- Keep remote data in typed API functions or React Query hooks.
- Include loading, empty, error, unauthorized, and validation states.

## Verification

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` for frontend changes. Run targeted pytest files first, then the full backend suite for backend changes.
