# Cursor rules index

Cursor loads the `.mdc` files in this directory by frontmatter scope. The rules encode the portal's target architecture: isolated features, vendored shadcn kit UI, Next.js route groups, and OOP FastAPI services/repositories.

| Rule | Scope | Purpose |
|---|---|---|
| `00-portal-universal.mdc` | Always | Naming, boundaries, feature isolation, size limits, forbidden patterns |
| `10-developer-agent.mdc` | Always | Read-first workflow, layer map, handoff checklist |
| `20-backend-agent.mdc` | `backend/**` | OOP FastAPI, SQLAlchemy, Alembic, Pydantic services/repos |
| `30-frontend-agent.mdc` | `frontend/**` | Route groups, feature public APIs, shadcn kit, RTL |
| `40-refactor-agent.mdc` | Refactor work | Behavior-preserving restructuring and domain migration playbook |
| `50-devops-agent.mdc` | Infrastructure files | Docker, environment, persistence, deployment |
| `60-qa-agent.mdc` | Test files | Test strategy and quality gates |
| `70-portal-integrations.mdc` | Integration domains | Jira, reports, chat, uploads, workflows |
| `80-security.mdc` | Always | Auth, secrets, CORS, validation, private data |

`AGENTS.md` is the repository-wide source of truth. Cursor-specific files refine it but must not contradict it. Deep standards live in `docs/08-architecture-standards.md`.

Codex uses the root `AGENTS.md` plus the two nested instruction files at `backend/AGENTS.md` and `frontend/AGENTS.md`.
