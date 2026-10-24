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
| Admin-managed cards | `/api/v1/portal-cards`, `/api/v1/admin/portal-cards` |

## Admin-managed portal cards

Administrators build homepage content without code in `/admin/cards`. A card is a
node in a tree (`parent_id = null` is the homepage, maximum depth 5) with a
`kind`:

- `group` — holds more cards.
- `form` — a form built from sections and fields (text, textarea, number, email,
  date, time, select, file, table; optional required flag and "show only when
  select X equals Y" rule). Field names are generated (`f_xxxxxx`) and stay
  stable so stored answers survive label edits.
- `document` — text plus up to 30 downloadable files (≤20 MB each; PDFs can be
  viewed inline).

Cards have a title, description, optional logo (JPG/PNG/WebP ≤5 MB) and a
published flag. Drafts and everything below a draft are visible to admins only.

Employee endpoints (authenticated):

- `GET /api/v1/portal-cards?parent_id=` — visible children (root when omitted)
- `GET /api/v1/portal-cards/{id}` — breadcrumbs, children, form template, content, files
- `GET /api/v1/portal-cards/{id}/logo` — public image (like news/job-description images)
- `GET /api/v1/portal-cards/{id}/files/{file_id}` — download, requires visibility

Admin endpoints (`get_admin_user`): `GET/POST /admin/portal-cards`,
`GET/PUT/DELETE /admin/portal-cards/{id}`, `POST .../reorder`, `POST .../{id}/move`,
`PUT .../{id}/form`, `PUT .../{id}/content`, `POST .../{id}/files`,
`DELETE .../{id}/files/{file_id}`. Create/update use multipart form data.

Custom forms reuse the existing form pipeline: the template is served by
`GET /api/v1/forms/custom-<id>` and answers are posted to `POST /api/v1/submissions`
with the server-side target `department_id=custom`, `section_id=card-<id>`,
`form_id=custom-<id>` (client-supplied department/section are ignored). Submission
data is validated against the stored schema (required, select options, number,
email, conditional visibility; unknown keys are dropped). Form-access rules and
task-duty routing treat custom forms as a «کارت‌های سفارشی» department whose
sections are the card paths, so admins assign access and handlers in the existing
admin screens. A custom form is visible to an employee only when it and all its
ancestors are published and access rules allow it. Deleting a card removes its
descendants, files, and access/duty assignments; historical submissions keep the
`custom-<id>` id.

## Document libraries

Homepage libraries for دستورالعمل، آموزش، فرم‌ها، and مستندات share
`/api/v1/pdf-forms`. The `category` query is one of `guidelines`, `training`,
`forms`, or `documents`.

- `GET /api/v1/pdf-forms?category=` — list for the signed-in user
- `GET /api/v1/pdf-forms/{id}/file` — download; `Content-Type` follows the stored extension
- Admin: `GET/POST /api/v1/admin/pdf-forms` and `PUT/DELETE /api/v1/admin/pdf-forms/{id}`

Each file is at most 20 MB. Allowed types are PDF, Word (`doc`/`docx`), Excel
(`xls`/`xlsx`), PowerPoint (`ppt`/`pptx`), JPG, PNG, WebP, GIF, TXT, CSV, and
ZIP. The server checks the file signature as well as the extension. PDF, text,
and images can be previewed in the browser; Office files and ZIP are download-only.
The multipart field name remains `pdf`.

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

Users may only create or change their own attendance and tasks. Other-day attendance must include both entrance and exit. Tasks must still fall inside a presence window. Admin-only `/api/v1/timesheet/admin/*` routes continue to manage other employees, projects, and reports. The admin report screen exports the open tab (employees, tasks, or attendance) as a UTF-8 CSV of the rows that match the current filters, including rows beyond the visible page.

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
card. Both `GET /api/v1/submissions/{id}` and `GET /api/v1/tasks/{id}` merge
sibling status history, referrals, CC rows, views, and assignee progress so
responses and attachments from every recipient stay visible on the letter
timeline. Task download routes for status-history and referral attachments also
resolve files across the same letter batch.

The letter report pages (`/my-letters?report=internal|external`, used for admin
monitoring and sender follow-up) open the same «جزئیات درخواست» dialog as
«همه درخواست‌ها» (`RequestDetailDialog`, button «جزئیات کامل و گردش کار») for a
letter's primary submission: workflow overview, per-assignee progress, initial
and referred recipients, attachments, conversation (mentions/reminders),
timeline, and refer/re-refer. Only the sender can close, reject, or reopen a
letter (applied to the whole batch); administrators monitor and refer but get
`403` on terminal status changes.

## Task inbox notifications

`GET /api/v1/tasks/notifications` returns unread home-page inbox items for the
signed-in user:

- reminder and deadline rows from `submission_reminders` that are due and newer
  than the user's last task view (reminders appear **only** here; they never
  bump the sidebar badges)
- completed-task rows from `approved` status history on tasks the user can view,
  excluding changes made by the same user

Opening a task (`GET /api/v1/tasks/{id}`) updates the view timestamp and clears
matching inbox items. The home page shows these messages behind the notification
icon; the sidebar badge next to «وظایف من» counts only unread (never opened)
actionable tasks, and «نامه‌ها» counts only unread inform/CC letters via
`GET /api/v1/tasks/letters/unseen-count`. Reminders do not change these numbers.
Clicking an inbox message navigates to `/my-tasks?open={submission_id}` (or
`/my-letters?open={id}` for نامه inbox items) and opens the item.

Inform-only and CC/رونوشت letters are shown on `/my-letters` in an
Outlook-style layout (folders / list / reading pane with متن نامه، پیوست‌ها،
گردش کار و پیگیری، یادداشت‌ها). Letters marked `needs_action=دارد` also appear
in «وظایف من» (`/my-tasks`) as normal actionable tasks (pending badge, progress,
refer). Attachments download via `GET /api/v1/tasks/{id}/attachment`. Actionable
letters keep refer/progress actions when `can_act` is true. For the sender, a
letter with `needs_action=دارد` also appears in «درخواست‌های من»
(`/my-requests`), mirroring the recipient's «وظایف من»; inform-only letters
(`needs_action=ندارد(جهت اطلاع)`) stay only in «نامه‌ها». CC rows stay out of
«وظایف من».

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
recipient row carries `is_read` and `progress_percent`. Sent sub-folders are
computed client-side: not read by every recipient, awaiting action, past
`due_date` while still pending, completed by all direct recipients, and
«جهت اطلاع». The mailbox list is paginated client-side (10 items per page).

Receivers still submit progress (0–99) and referrals from the inbox reading
pane (desktop and mobile) via `PATCH /tasks/{id}/status`. Senders monitor
recipient progress in ارسالی and can close the letter at any time (no progress
threshold, same as «درخواست‌های من») with `PATCH /submissions/{id}/status`
(`approved` / `rejected`, or `submitted` to reopen), per recipient copy or for
all open direct recipients at once. In «درخواست‌های من» a multi-recipient letter
is one row; its status PATCH accepts `apply_to_letter_batch: true`, which
applies the change to every direct copy of the batch (CC copies are untouched).
A letter closed as `approved` appears in the
recipient's «وظایف من» → «انجام‌شده» tab, in the «انجام‌شده» folder of
`/my-letters`, and in the sender's «انجام‌شده» sent folder. Inform-only letters
stay read-only for both sides.

Letters behave like tasks for the sender too: from a sent letter's recipient
row the sender can re-refer (ارجاع مجدد) that copy to other colleagues through
`POST /submissions/{id}/refer` (allowed for the submitter, repeat referrals
allowed, blocked while the copy is closed until it is reopened), and can use the
conversation and send reminders (`/submissions/{id}/conversation|comments|reminders`).
Admins monitor every letter (`/my-letters` → «نظارت», or «گزارش ارسالی» →
«جزئیات و گردش کار») with the same detail a task shows: letter text and
attachments, the full workflow timeline with referral/progress/final-answer
attachments, per-recipient progress, CC list and the conversation. Admins can
join the conversation (including @mentions), send reminders and refer / re-refer
a letter copy through `/submissions/{id}/refer`; closing, rejecting and
reopening remain sender-only, exactly as for tasks.

Which letters reach «وظایف من» is derived at read time (`needs_action` is not
`ندارد(جهت اطلاع)` and the copy is not a CC), so letters sent before this
behaviour was introduced follow the same rule.

### Personal letter folders

Users can create personal folders under دریافتی or ارسالی and add letters to
them without removing the letter from the system folders:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/management-letters/folders?scope=` | List the caller's folders (`received` / `sent`) |
| `POST` | `/api/v1/management-letters/folders` | Create `{name, scope}` |
| `PATCH` | `/api/v1/management-letters/folders/{id}` | Rename |
| `DELETE` | `/api/v1/management-letters/folders/{id}` | Delete folder (membership only) |
| `POST` | `/api/v1/management-letters/folders/{id}/items` | Add `{submission_id}` or `{batch_id}` |
| `DELETE` | `/api/v1/management-letters/folders/{id}/items/{item_id}` | Remove membership |

Folders are owner-only. Received membership requires task view access; sent
membership requires owning the batch (or admin monitor access).

### Recipient groups

Each signed-in user can save personal groups of colleagues (for example
«مدیران») and apply a group with one click wherever a letter is sent or a
request or letter is referred or re-referred. The click selects every group
member who is a valid target on that screen. Clicking the same group again
clears those people. Groups are visible only to their owner and do not change
who is allowed to receive a letter or referral.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/recipient-groups` | List the caller's groups and members |
| `POST` | `/api/v1/recipient-groups` | Create `{name, member_ids}` |
| `PUT` | `/api/v1/recipient-groups/{id}` | Replace the name and members |
| `DELETE` | `/api/v1/recipient-groups/{id}` | Delete the caller's group |

Member ids must be active users. Names are unique per owner, at most 80
characters, with at most 30 groups and 100 members each. Another user's group
returns 404.

The home page also shows a small welcome bot that greets the signed-in user by
display name. When `birth_date` matches today (Tehran calendar day, same rule as
`is_birthday` on `/api/v1/auth/me`), the bot switches to a birthday message.
