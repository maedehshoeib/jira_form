"""Programmatic Alembic entry point used by application startup."""

from pathlib import Path

from sqlalchemy.engine import Engine


def upgrade_database(database_engine: Engine) -> None:
    # Imports stay local so unit tests that only exercise SQLite helpers do not
    # require the migration CLI to be initialized.
    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    with database_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
