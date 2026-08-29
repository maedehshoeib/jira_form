"""One-time, transactional import from the legacy SQLite databases."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Column,
    DateTime,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    inspect,
    select,
    text,
)
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.sql.schema import MetaData as SchemaMetaData

logger = logging.getLogger(__name__)

_migration_metadata = MetaData()
_migration_log = Table(
    "app_data_migrations",
    _migration_metadata,
    Column("name", String(128), primary_key=True),
    Column("completed_at", DateTime, nullable=False),
    Column("details", Text, nullable=False, default="{}"),
)


def _sqlite_file_exists(database_url: str) -> bool:
    url = make_url(database_url)
    if not url.drivername.startswith("sqlite"):
        raise ValueError("Legacy migration source must be a SQLite URL.")
    if not url.database or url.database == ":memory:":
        return True
    return Path(url.database).is_file()


def _destination_has_data(connection, metadata: SchemaMetaData) -> list[str]:
    populated = []
    for table in metadata.sorted_tables:
        if connection.scalar(select(func.count()).select_from(table)):
            populated.append(table.name)
    return populated


def _compatibility_values(table_name: str, row: dict, source_columns: set[str]) -> None:
    """Reproduce important values introduced by the old SQLite migrations."""
    if table_name == "contracts" and "start_date" not in source_columns:
        row["start_date"] = row.pop("registration_date", "") or ""
    if table_name == "submissions" and "progress_percent" not in source_columns:
        row["progress_percent"] = 100 if row.get("status") == "approved" else 0
    if table_name == "pdf_forms" and "category" not in source_columns:
        row["category"] = "forms"


def _copy_table(source_engine: Engine, connection, target_table: Table) -> int:
    source_metadata = MetaData()
    source_table = Table(target_table.name, source_metadata, autoload_with=source_engine)
    source_columns = set(source_table.c.keys())
    selected_names = [name for name in target_table.c.keys() if name in source_columns]
    if target_table.name == "contracts" and "registration_date" in source_columns:
        selected_names.append("registration_date")

    statement = select(*(source_table.c[name] for name in selected_names))
    primary_keys = [source_table.c[name] for name in source_table.primary_key.columns.keys()]
    if primary_keys:
        statement = statement.order_by(*primary_keys)

    copied = 0
    with source_engine.connect() as source_connection:
        result = source_connection.execute(statement).mappings()
        while rows := result.fetchmany(1000):
            values = []
            for source_row in rows:
                row = dict(source_row)
                _compatibility_values(target_table.name, row, source_columns)
                values.append(row)
            connection.execute(target_table.insert(), values)
            copied += len(values)
    return copied


def _reset_postgres_sequences(connection, metadata: SchemaMetaData) -> None:
    for table in metadata.sorted_tables:
        for column in table.primary_key.columns:
            sequence_name = connection.scalar(
                text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                {"table_name": table.name, "column_name": column.name},
            )
            if not sequence_name:
                continue
            maximum = connection.scalar(select(func.max(column)))
            if maximum is not None:
                connection.execute(
                    text(
                        "SELECT setval(CAST(:sequence_name AS regclass), "
                        ":maximum, true)"
                    ),
                    {"sequence_name": sequence_name, "maximum": maximum},
                )


def import_sqlite_once(
    *,
    source_url: str,
    target_engine: Engine,
    target_metadata: SchemaMetaData,
    migration_name: str,
) -> dict[str, int]:
    """Import a SQLite database once, or fail safely if the target has data."""
    if not _sqlite_file_exists(source_url):
        logger.info("SQLite source for %s does not exist; skipping import", migration_name)
        return {}

    source_engine = create_engine(source_url, connect_args={"check_same_thread": False})
    try:
        source_tables = set(inspect(source_engine).get_table_names())
        tables = [table for table in target_metadata.sorted_tables if table.name in source_tables]
        if not tables:
            logger.info("SQLite source for %s has no known tables; skipping", migration_name)
            return {}

        _migration_metadata.create_all(target_engine)
        with target_engine.begin() as connection:
            if target_engine.dialect.name == "postgresql":
                connection.execute(
                    text("SELECT pg_advisory_xact_lock(hashtext(:migration_name))"),
                    {"migration_name": migration_name},
                )

            completed = connection.scalar(
                select(_migration_log.c.name).where(
                    _migration_log.c.name == migration_name
                )
            )
            if completed:
                logger.info("SQLite import %s was already completed", migration_name)
                return {}

            populated = _destination_has_data(connection, target_metadata)
            if populated:
                names = ", ".join(populated)
                raise RuntimeError(
                    f"Refusing SQLite import {migration_name}: PostgreSQL already "
                    f"contains data in: {names}. Restore an empty PostgreSQL volume "
                    "or disable SQLITE_MIGRATION_ENABLED after verifying the data."
                )

            if target_engine.dialect.name == "postgresql":
                # Docker's POSTGRES_USER owns this database. Disabling FK triggers only
                # inside this transaction permits self-referential legacy rows.
                connection.execute(text("SET LOCAL session_replication_role = replica"))

            counts = {table.name: _copy_table(source_engine, connection, table) for table in tables}

            for table in tables:
                target_count = connection.scalar(select(func.count()).select_from(table))
                if target_count != counts[table.name]:
                    raise RuntimeError(
                        f"Row-count verification failed for {table.name}: "
                        f"source={counts[table.name]}, target={target_count}"
                    )

            if target_engine.dialect.name == "postgresql":
                _reset_postgres_sequences(connection, target_metadata)

            connection.execute(
                _migration_log.insert().values(
                    name=migration_name,
                    completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    details=json.dumps(counts, sort_keys=True),
                )
            )
            logger.info("Completed SQLite import %s: %s", migration_name, counts)
            return counts
    finally:
        source_engine.dispose()
