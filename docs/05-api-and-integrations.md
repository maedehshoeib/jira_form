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
| Job descriptions (شرح وظایف) | `/api/v1/job-descriptions` |

## Calendar

Authenticated users share a team calendar under `/api/v1/calendar`:

- `GET /users` — every active user (including administrators)
- `GET /events` — all calendar events across users
- `POST /events` — create one event per target user; body accepts `user_id`
  and/or `user_ids` (any active user, including admins). Response is a list.
- `PUT /events/{id}` / `DELETE /events/{id}` — allowed for the event owner,
  the creator, or an administrator
- `GET /notifications/unread` / `POST /notifications/read` — assignees are
  notified when someone else schedules time for them
| Portal forms and submissions | `/api/v1` |
| Management letters | `/api/v1` |
| Reports | `/api/v1/reports` |
| Contracts | `/api/v1/contracts` |
| Jira proxy | `/api/v1/jira` |
| Timesheet | `/api/v1/timesheet` |

## Job descriptions (شرح وظایف)

Authenticated users can list and view published job descriptions:

- `GET /api/v1/job-descriptions`
- `GET /api/v1/job-descriptions/{id}`
- `GET /api/v1/job-descriptions/{id}/photo`
- `GET /api/v1/job-descriptions/{id}/attachment`

Only administrators may create, update, or delete records through multipart
`/api/v1/admin/job-descriptions` endpoints. Each record stores organizational
position, organizational unit, unit responsibility, qualification requirements,
an optional photo (JPG/PNG/WebP), and an optional attachment
(PDF/Word/Excel/TXT/ZIP).

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

Multi-recipient sends still persist one submission per person (shared
`letter_batch_id`). Sender-facing list endpoints collapse those copies to one
card, while detail/timeline responses merge sibling status history, referrals,
CC rows, views, and assignee progress so attachments from every recipient stay
visible. Recipient task endpoints continue to show only that person's copy.

## Task inbox notifications

`GET /api/v1/tasks/notifications` returns unread home-page inbox items for the
signed-in user:

- reminder and deadline rows from `submission_reminders` that are due and newer
  than the user's last task view
- completed-task rows from `approved` status history on tasks the user can view,
  excluding changes made by the same user

Opening a task (`GET /api/v1/tasks/{id}`) updates the view timestamp and clears
matching inbox items. The home page shows these messages behind the notification
icon; the sidebar badge next to «وظایف من» shows unread actionable tasks, and
«نامه‌ها» shows unread inform/CC letters via `GET /api/v1/tasks/letters/unseen-count`.
Clicking an inbox message navigates to `/my-tasks?open={submission_id}` (or
`/my-letters?open={id}` for نامه inbox items) and opens the item.

نامه inbox and actionable management letters are shown on `/my-letters` in an
Outlook-style layout (folders / list / reading pane with متن نامه، پیوست‌ها،
گردش کار و پیگیری، یادداشت‌ها). Attachments download via
`GET /api/v1/tasks/{id}/attachment`. Actionable letters keep refer/progress
actions when `can_act` is true. «نامه‌ها» (`/my-letters`) is the only inbox for management letters. Sender and
recipient letter rows are excluded from «درخواست‌های من» and «وظایف من».

### Letter archive (بایگانی)

`PATCH /api/v1/tasks/{id}/archive` with body `{"archived": true|false}` archives
or restores an item in the caller's own inbox only (stored per user on
`submission_views.is_archived`). The caller must be able to view the item;
otherwise the API returns 404. List and detail task responses expose
`is_archived` for the current viewer. Archived letters are hidden from the other
`/my-letters` folders, appear under «بایگانی», and are excluded from
`/tasks/letters/unseen-count`.

### Letter drafts (پیش‌نویس‌ها)

Unsent letters are stored per author in `letter_drafts` and are only visible to
their owner (other users get 404):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/management-letters/drafts` | List the caller's drafts |
| `POST` | `/api/v1/management-letters/drafts` | Create a draft (multipart, same fields as send) |
| `GET` | `/api/v1/management-letters/drafts/{id}` | Load a draft for editing |
| `PUT` | `/api/v1/management-letters/drafts/{id}` | Replace draft fields; new files are appended |
| `DELETE` | `/api/v1/management-letters/drafts/{id}` | Delete the draft and its stored files |
| `POST` | `/api/v1/management-letters/drafts/{id}/send` | Send with full validation, then delete the draft |

Draft endpoints accept the same multipart fields as `POST /management-letters`
plus `remove_attachments` (JSON list of stored attachment indexes to drop).
Saving a draft does not enforce required fields; sending does. If sending fails,
the draft is kept.

### Letters workspace

Everything about letters lives on `/my-letters`; the home page no longer shows
letter cards. Users with send access see «نامه جدید» and «گزارش ارسالی» per
letter type. The compose form opens at `/my-letters?compose={internal|external}`
(drafts add `&draft={id}`) and the sent report at
`/my-letters?report={internal|external}`. The old `/management-workflow/...`
URLs redirect to these, keeping any `draft` parameter.

The sidebar has a «دریافتی» group (inbox folders, drafts, archive) and an
«ارسالی» / «نظارت» group built from
`GET /management-letters/report?letter_type=`. Non-admins call it with
`mine=true` (own sent letters only). Admins omit `mine` so they can monitor
every organizational letter after letters moved out of «درخواست‌های من». Each
recipient row carries `is_read`. Sent sub-folders are computed client-side:
not read by every recipient, awaiting action, past `due_date` while still
pending, completed by all direct recipients, and «جهت اطلاع». The mailbox
list is paginated client-side (20 items per page).

The home page also shows a small welcome bot that greets the signed-in user by
display name. When `birth_date` matches today (Tehran calendar day, same rule as
`is_birthday` on `/api/v1/auth/me`), the bot switches to a birthday message.
