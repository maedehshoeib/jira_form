# API and integration map

The browser uses relative `/api/v1` URLs. In Next.js these requests are rewritten server-side to `BACKEND_URL`.

| Domain | Prefix |
|---|---|
| Authentication | `/api/v1/auth` |
| Administration | `/api/v1/admin` |
| Chat and WebSocket | `/api/v1/chat` |
| Calendar | `/api/v1/calendar` |
| Portal forms and submissions | `/api/v1` |
| Management letters | `/api/v1` |
| Reports | `/api/v1/reports` |
| Contracts | `/api/v1/contracts` |
| Jira proxy | `/api/v1/jira` |
| Timesheet | `/api/v1/timesheet` |

WebSocket clients use `NEXT_PUBLIC_WS_BASE_URL` when configured. The local fallback connects to port `8000` on the current hostname. Production should provide a TLS WebSocket origin or reverse-proxy `/api/v1/chat/ws` to FastAPI.
## Request referral attachments

Both `POST /api/v1/tasks/{submission_id}/refer` and
`POST /api/v1/submissions/{submission_id}/refer` accept multipart uploads.
Send each file as a repeated `attachments` field; the legacy singular
`attachment` field remains supported. Referral responses expose the ordered
`attachment_names` list and retain `attachment_name` as the first file for
older clients. Download a file by passing its zero-based `index` to the
referral attachment endpoint.
