# Operations and deployment

## Docker

```bash
docker compose up --build -d
docker compose logs -f postgres backend web
docker compose down
```

The web UI is exposed on `8080`, the API on `8000`, and PostgreSQL on `5432`.
PostgreSQL data persists in `postgres_data`; uploads and legacy SQLite files stay
in `portal_data`.

## First production migration from SQLite

See **[Production SQLite migration](07-production-sqlite-migration.md)** for the
full cutover checklist, verification steps, failure recovery, and rollback plan.

Summary for the first production start:

1. Stop the old application and make a filesystem-level backup of the existing
   `portal_data` volume. Confirm it contains `portal.db`, `contracts.db`, and the
   upload directories. Do not use `docker compose down -v`.
2. Keep the same Compose project name so Docker reuses the existing
   `portal_data` volume. If the checkout directory changed, set
   `COMPOSE_PROJECT_NAME` to the old project name or mount the old volume
   explicitly.
3. Copy `.env.example` to `.env`. Set a strong `POSTGRES_PASSWORD`, then put the
   same URL-encoded password in `DATABASE_URL` and `CONTRACTS_DATABASE_URL`.
   Both URLs intentionally point to the same PostgreSQL database.
4. Leave `SQLITE_MIGRATION_ENABLED=true` and keep both source URLs set to the
   files under `/app/data` for the first startup.
5. Start the stack and watch the backend log, or run the one-shot job first:

   ```bash
   make init_db                        # optional: migrate before starting API/web
   docker compose up --build -d
   docker compose logs -f postgres backend
   ```

The backend upgrades PostgreSQL to the current Alembic revision, locks the import so only one
container can run it, copies all recognized tables in a single transaction,
resets identity sequences, verifies every copied row count, and only then writes
the `legacy-portal-sqlite-v1` and `legacy-contracts-sqlite-v1` markers. A failure
rolls back the imported rows and prevents the API from starting. Existing files
and uploads are never deleted.

After startup, verify the markers and compare important counts with the backup:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT name, completed_at, details FROM app_data_migrations ORDER BY name;"
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS submissions FROM submissions; SELECT COUNT(*) AS contracts FROM contracts;"
```

The importer is idempotent: later starts see the completion markers and do not
copy again. Keep the SQLite backup until application-level checks are complete.
If PostgreSQL already contains application rows but has no marker, startup stops
instead of merging or overwriting data. Restore an empty `postgres_data` volume
from a controlled backup before retrying; never remove a production volume just
to bypass this guard.

`DATABASE_MIGRATIONS_ENABLED=true` must remain enabled in production. The
Alembic schema upgrade runs before SQLite rows are copied. Schema versioning and
the SQLite importer solve different problems: Alembic changes structure; the
importer preserves legacy data.

## Required production checks

- Replace every default password, API key, and `SECRET_KEY`.
- Set explicit allowed origins and the public WebSocket URL.
- Back up both `portal_data` and `postgres_data` before schema or seed changes.
- Confirm `/api/v1/health`, login, file upload, and chat connectivity.
- Build both containers from a clean checkout.

Do not bake `.env` files, database files, uploads, or `users.xlsx` credentials into a public image registry.
