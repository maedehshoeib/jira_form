# Operations and deployment

## Docker

```bash
docker compose up --build -d
docker compose logs -f web backend
docker compose down
```

The web UI is exposed on `8080`, the API on `8000`, and SQLite/uploads persist in `portal_data`.

## Required production checks

- Replace every default password, API key, and `SECRET_KEY`.
- Set explicit allowed origins and the public WebSocket URL.
- Back up the `portal_data` volume before schema or seed changes.
- Confirm `/api/v1/health`, login, file upload, and chat connectivity.
- Build both containers from a clean checkout.

Do not bake `.env` files, database files, uploads, or `users.xlsx` credentials into a public image registry.
