# API and integration map

The browser uses relative `/api/v1` URLs. Next.js forwards them through
`src/app/api/v1/[...path]/route.ts` to `BACKEND_URL`, preserving GET, POST, PUT,
PATCH, DELETE, HEAD, and OPTIONS. A `next.config.ts` rewrite remains as fallback
for other `/api` paths.

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

Every signed-in user can manage their own timesheet:

- Live clock: `POST /api/v1/timesheet/attendance/check-in` and `.../check-out`
- Manual entrance/exit: `POST /api/v1/timesheet/attendance/entries`, `POST /api/v1/timesheet/attendance/entries/{id}`, `POST /api/v1/timesheet/attendance/entries/{id}/delete`
- Tasks: `POST /api/v1/timesheet/tasks`, `POST /api/v1/timesheet/tasks/entries/{id}`, `POST /api/v1/timesheet/tasks/entries/{id}/delete`

Users may only create or change their own attendance and tasks. Other-day attendance must include both entrance and exit. Tasks must still fall inside a presence window. Admin-only `/api/v1/timesheet/admin/*` routes continue to manage other employees, projects, and reports.

WebSocket clients use `NEXT_PUBLIC_WS_BASE_URL` when configured. The local fallback connects to port `8000` on the current hostname. Production should provide a TLS WebSocket origin or reverse-proxy `/api/v1/chat/ws` to FastAPI.

## Request referral attachments

The `GET /api/v1/tasks/colleagues` endpoint returns every active user except
the caller, including users with administrator access. This shared directory
is used for request referrals, CC recipients, and comment mentions.

Both `POST /api/v1/tasks/{submission_id}/refer` and
`POST /api/v1/submissions/{submission_id}/refer` accept multipart uploads.
Send each file as a repeated `attachments` field; the legacy singular
`attachment` field remains supported. Referral responses expose the ordered
`attachment_names` list and retain `attachment_name` as the first file for
older clients. Download a file by passing its zero-based `index` to the
referral attachment endpoint.

## Request status ownership

For ordinary requests, status ownership is split by role:

- Receivers use `PATCH /api/v1/tasks/{submission_id}/status` only to submit an `in_progress` status, a progress percentage from 0 through 99, notes, and optional attachments. Progress is stored independently for each receiver; one receiver's update never overwrites another receiver's value.
- The original sender uses `PATCH /api/v1/submissions/{submission_id}/status` to record the final result as `approved` (finished) or `rejected` (not finished), and may use `submitted` to reopen the request.
- The backend enforces this ownership; hiding controls in the UI is not the authorization boundary.

Task and submission responses expose `assignee_progress`, containing the latest
percentage and update time for every initial or referred assignee. Task
responses also expose `viewer_progress_percent`, which is the signed-in
receiver's editable value. The existing `progress_percent` field remains in
the response for backward compatibility with older clients.

Meeting-room reservations retain their separate chained approver workflow.

## Management-letter delivery

`POST /api/v1/management-letters` accepts two JSON-encoded multipart fields:
`recipient_ids` for direct recipients and `cc_recipient_ids` for copied
recipients. The same person cannot appear in both lists, but either list may be
empty when the other contains at least one recipient.

Each direct recipient receives an actionable task and any applicable deadline
reminders. Each CC recipient receives a read-only announcement: it appears in
their task/announcement feed and unread count, but it is excluded from pending
task counts and cannot be progressed or referred. Letter reports expose each
recipient''s `delivery_type` as `direct` or `cc`.

## Task inbox notifications

`GET /api/v1/tasks/notifications` returns unread home-page inbox items for the
signed-in user:

- reminder and deadline rows from `submission_reminders` that are due and newer
  than the user's last task view
- completed-task rows from `approved` status history on tasks the user can view,
  excluding changes made by the same user

Opening a task (`GET /api/v1/tasks/{id}`) updates the view timestamp and clears
matching inbox items. The home page shows these messages behind the notification
icon; the sidebar badge next to «وظایف من» no longer displays the unread count.
Clicking an inbox message navigates to `/my-tasks?open={submission_id}` and
opens the task card.
