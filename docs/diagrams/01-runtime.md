# Runtime diagram

```mermaid
flowchart LR
  B[Browser] --> W[Next.js web]
  W -->|rewrite /api/*| A[FastAPI]
  B -->|WebSocket| A
  A --> D[(PostgreSQL)]
  A --> U[(Uploads volume)]
  A --> J[Jira]
```
