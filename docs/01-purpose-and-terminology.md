# Purpose and terminology

The Jira Form Portal is an internal, Persian-first service portal for employee requests, task workflows, reports, timesheets, calendars, documents, contracts, management letters, and internal chat.

## Terms

| Term | Meaning |
|---|---|
| Department | Organizational unit that owns or can access forms |
| Form template | Dynamic definition used to render a request form |
| Submission | A user's persisted form request |
| Task | Workflow work assigned to a user or administrator |
| Management letter | Internal or external correspondence workflow |
| Portal API | FastAPI endpoints under `/api/v1` |
| Web app | Next.js application that renders UI and forwards API requests |

The refactor must preserve existing URLs, authorization rules, RTL presentation, and API contracts unless a change is explicitly approved.
