#!/usr/bin/env python3
"""Initialize PostgreSQL and import legacy SQLite data."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from sqlalchemy import text

REPO_ROOT = Path(__file__).resolve().parents[1]
for candidate in (Path("/app"), REPO_ROOT / "backend"):
    if candidate.is_dir() and str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _log_migration_markers() -> None:
    from app.db.session import engine

    with engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT name, completed_at, details "
                "FROM app_data_migrations ORDER BY name"
            )
        ).fetchall()
        if not rows:
            logger.info("No SQLite import markers recorded (source files may be absent).")
            return
        for name, completed_at, details in rows:
            logger.info("Import marker %s at %s: %s", name, completed_at, details)


def main() -> int:
    from app.db.init_db import init_db

    logger.info("Starting database initialization")
    init_db()
    _log_migration_markers()
    logger.info("Database initialization completed successfully")
    print("Database initialization completed successfully.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
