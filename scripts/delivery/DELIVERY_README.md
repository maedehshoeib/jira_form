# Delivery snapshot

This branch contains the production frontend bundle and the Cython-compiled API. Application source is not in this history.

Put the production `.env` beside this file. Add the absolute path of the employee workbook:

```bash
USERS_SEED_HOST_PATH=/absolute/path/users.xlsx
```

Keep `name` in `docker-compose.yml` equal to the Compose project that already owns `postgres_data` and `portal_data`. Then start:

```bash
docker compose up --build -d
```

Optional database initialization before the API:

```bash
docker compose --profile tools run --rm init-db
```
