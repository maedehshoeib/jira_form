# Production migration: SQLite to PostgreSQL

This guide covers the one-time production cutover from the legacy SQLite databases
(`portal.db`, `contracts.db`) to PostgreSQL on the `refactor` branch.

The importer is **transactional**, **idempotent**, and **safe by default**: it
refuses to overwrite PostgreSQL data that already exists without a completion
marker, and it never deletes the original SQLite files or uploads.

## What happens during migration

On the first run against an **empty** PostgreSQL database:

1. **Alembic** upgrades PostgreSQL to the current schema revision.
2. **SQLite import** (`legacy-portal-sqlite-v1`) copies every recognized table
   from `portal.db` in a single transaction, verifies row counts, and resets
   identity sequences.
3. **Contracts import** (`legacy-contracts-sqlite-v1`) does the same for
   `contracts.db` when that file exists.
4. Completion markers are written to `app_data_migrations`.
5. Normal startup tasks run (department backfill, default banner/project rows, and
   optional user seeding).

Later starts see the markers and **skip** the import.

```text
portal_data volume                postgres_data volume
├── portal.db        ──import──>  PostgreSQL (all app tables)
├── contracts.db     ──import──>  same database
├── uploads/         ──kept───>   still read from volume
└── contracts_uploads/
```

Alembic and the SQLite importer solve different problems:

| Tool | Purpose |
|------|---------|
| Alembic | PostgreSQL **schema** versioning |
| SQLite importer | One-time **data** copy from legacy files |

## Before you start

### 1. Back up everything

Stop the old application first. Then back up at the filesystem level:

- Docker volume `portal_data` (or the host path that holds `portal.db`,
  `contracts.db`, and upload directories)
- Any standalone copy of `backend/data/` if you run outside Docker

**Do not** run `docker compose down -v` on production. That removes volumes.

Keep the SQLite backup until application checks are complete and you are
confident in the new database.

### 2. Confirm the SQLite source is complete

Inspect the files you will migrate **before** starting PostgreSQL import:

```bash
# Example using a temporary sqlite3 container
docker run --rm -v /path/to/portal_data:/data keinos/sqlite3 sh -c '
  ls -lh /data/*.db
  for t in users submissions timesheet_tasks contracts; do
    echo -n "$t: "
    sqlite3 /data/portal.db "SELECT COUNT(*) FROM $t;" 2>/dev/null || \
    sqlite3 /data/contracts.db "SELECT COUNT(*) FROM $t;" 2>/dev/null || echo "n/a"
  done
'
```

Record these counts. You will compare them with PostgreSQL after migration.

A very small `portal.db` (tens of kilobytes, only a few rows) usually means you
are pointing at the wrong volume or an old test database, not production data.

### 3. Preserve the Docker Compose project name

Docker names volumes as `<project>_portal_data`. If the checkout directory
changes, Compose may create a **new empty volume** instead of reusing production
data.

Keep the same project name as the old deployment:

```bash
export COMPOSE_PROJECT_NAME=jira_form   # use your existing project name
```

Or mount the old volume explicitly in `docker-compose.yml`.

### 4. Prepare `.env`

Copy `.env.example` to `.env` and set production values:

```bash
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql+psycopg://portal:<url-encoded-password>@postgres:5432/portal
CONTRACTS_DATABASE_URL=postgresql+psycopg://portal:<url-encoded-password>@postgres:5432/portal

SQLITE_MIGRATION_ENABLED=true
SQLITE_SOURCE_DATABASE_URL=sqlite:////app/data/portal.db
SQLITE_CONTRACTS_SOURCE_DATABASE_URL=sqlite:////app/data/contracts.db
DATABASE_MIGRATIONS_ENABLED=true
```

Both `DATABASE_URL` and `CONTRACTS_DATABASE_URL` intentionally point to the **same**
PostgreSQL database.

**User seeding:** if `portal.db` already contains all production users, set
`USERS_SEED_ENABLED=false` for the first import. Seeding from `users.xlsx` after
import can duplicate or overwrite accounts. Enable seeding only when you
deliberately want to merge spreadsheet users into an empty or partial database.

Replace every default password, `SECRET_KEY`, and API key before going live.

## Migration methods

You can run the import in either of these ways. Use **one** method per environment;
do not run both concurrently.

### Method A — Automatic import on backend startup (default)

This is the standard production path when deploying the full stack:

```bash
export COMPOSE_PROJECT_NAME=jira_form   # if needed
docker compose up --build -d
docker compose logs -f postgres backend
```

The backend waits for PostgreSQL to become healthy, runs Alembic, imports SQLite
data, then starts serving the API. A failed import rolls back the copied rows and
prevents the API from starting.

### Method B — One-shot Docker job (`make init_db`)

Use this when you want to migrate **before** starting the web and API containers,
or when rehearsing the import on a staging server:

```bash
export COMPOSE_PROJECT_NAME=jira_form   # if needed
make init_db
```

This target:

1. Starts PostgreSQL (`docker compose up -d postgres`)
2. Runs the `init-db` Compose service (`scripts/init_db.py`) as a one-shot job
3. Exits when migration completes

Then start the application:

```bash
docker compose up --build -d backend web
```

The `init-db` service uses the same environment variables as the backend. It is
defined under the `tools` Compose profile and does not start with a normal
`docker compose up`.

## Verification

### 1. Check completion markers

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT name, completed_at, details FROM app_data_migrations ORDER BY name;"
```

You should see:

- `legacy-portal-sqlite-v1` with a JSON `details` object listing per-table row
  counts
- `legacy-contracts-sqlite-v1` when `contracts.db` existed (may show
  `{"contracts": 0}` if the file was empty)

### 2. Compare row counts

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT COUNT(*) AS users FROM users;
      SELECT COUNT(*) AS submissions FROM submissions;
      SELECT COUNT(*) AS timesheet_tasks FROM timesheet_tasks;
      SELECT COUNT(*) AS contracts FROM contracts;"
```

Compare these numbers with the SQLite counts you recorded before migration. The
`details` column in `app_data_migrations` should match the SQLite source for
every imported table.

### 3. Application smoke tests

- `GET /api/v1/health` returns `{"status":"ok"}`
- Login with a known production user
- Open **My Requests** (`/my-requests`) and confirm submissions appear
- Confirm file uploads and attachments still resolve (upload paths live in
  `portal_data`, not inside PostgreSQL)
- Test chat, timesheet, and admin dashboards if your deployment uses them

## Post-migration settings

After a successful cutover and verification:

- Keep `DATABASE_MIGRATIONS_ENABLED=true` so Alembic can apply future schema
  changes.
- You may set `SQLITE_MIGRATION_ENABLED=false` once markers exist and you no
  longer need to re-import. Leaving it enabled is also safe; completed imports
  are skipped automatically.
- Re-enable or keep `USERS_SEED_ENABLED=false` according to your user-management
  policy.
- Keep the SQLite files in `portal_data` as a rollback copy until you are fully
  confident in PostgreSQL.

## Failure recovery

### Import failed during startup

The transaction rolls back. PostgreSQL remains empty (or unchanged if a partial
run was prevented). Fix the root cause (missing SQLite file, schema mismatch,
connectivity), then restart the backend or run `make init_db` again.

### Wrong or incomplete SQLite source was imported

Do **not** delete production data casually. To re-import from a corrected SQLite
backup:

1. Stop the backend (and `init-db` if running).
2. Restore or replace `portal.db` / `contracts.db` in `portal_data` from your
   backup.
3. Remove the PostgreSQL data volume **only from a controlled backup workflow**:

   ```bash
   docker compose stop postgres backend
   docker compose rm -f postgres
   docker volume rm <project>_postgres_data
   docker compose up -d postgres
   ```

4. Run `make init_db` or start the backend with `SQLITE_MIGRATION_ENABLED=true`.

Never remove a production volume just to bypass the safety guard.

### PostgreSQL has data but no migration marker

Startup stops with an error instead of merging or overwriting. This protects
against accidental data loss. Restore an empty `postgres_data` volume from a
controlled backup and retry the import.

### `contracts.db` is missing

The contracts import is skipped when the file does not exist. This is expected on
some deployments. Only `portal.db` is required for the main application data.

## Rollback plan

If you must revert before decommissioning SQLite:

1. Stop the `refactor` stack (`docker compose down` without `-v`).
2. Start the previous application version that reads SQLite directly.
3. PostgreSQL and `postgres_data` can remain in place for a later retry; they are
   not used by the old stack.

Uploads in `portal_data` are shared by both stacks, so attachment paths remain
valid as long as you do not delete that volume.

## Quick reference

| Item | Location / command |
|------|-------------------|
| SQLite sources | `portal_data` → `/app/data/portal.db`, `contracts.db` |
| PostgreSQL data | `postgres_data` volume |
| Import script | `scripts/init_db.py` |
| One-shot job | `make init_db` |
| Import markers | `app_data_migrations` table |
| Importer code | `backend/app/db/sqlite_import.py` |
| Schema migrations | `backend/alembic/` |

## Related docs

- [Operations and deployment](06-operations.md) — general Docker and production checks
- [System architecture](02-system-architecture.md) — runtime and persistence overview
