# Cursor rules index

Cursor loads the `.mdc` files in this directory by frontmatter scope. The rules mirror the role-oriented structure of the reference repository while staying specific to Jira Form Portal.

| Rule | Scope | Purpose |
|---|---|---|
| `00-portal-universal.mdc` | Always | Naming, boundaries, size limits, forbidden patterns |
| `10-developer-agent.mdc` | Always | Read-first workflow and handoff checklist |
| `20-backend-agent.mdc` | `backend/**` | FastAPI, SQLAlchemy, schemas, services |
| `30-frontend-agent.mdc` | `frontend/**` | Next.js App Router, shadcn/ui, RTL |
| `40-refactor-agent.mdc` | Refactor work | Behavior-preserving restructuring and route migration |
| `50-devops-agent.mdc` | Infrastructure files | Docker, environment, persistence, deployment |
| `60-qa-agent.mdc` | Test files | Test strategy and quality gates |
| `70-portal-integrations.mdc` | Integration domains | Jira, reports, chat, uploads, workflows |
| `80-security.mdc` | Always | Auth, secrets, CORS, validation, private data |

`AGENTS.md` is the repository-wide source of truth. Cursor-specific files refine it but must not contradict it.

Codex uses the root `AGENTS.md` plus the two nested instruction files at `backend/AGENTS.md` and `frontend/AGENTS.md`.
