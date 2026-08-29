from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, select

from app.db.sqlite_import import import_sqlite_once


class SqliteImportTests(unittest.TestCase):
    def test_import_is_complete_and_idempotent(self):
        with TemporaryDirectory() as directory:
            source_path = Path(directory) / "legacy.db"
            source_url = f"sqlite:///{source_path.as_posix()}"
            source_engine = create_engine(source_url)
            source_metadata = MetaData()
            source_contracts = Table(
                "contracts",
                source_metadata,
                Column("id", Integer, primary_key=True),
                Column("registration_date", String(32)),
                Column("subject", String(128), nullable=False),
            )
            source_metadata.create_all(source_engine)
            with source_engine.begin() as connection:
                connection.execute(
                    source_contracts.insert(),
                    [{"id": 7, "registration_date": "1403/01/02", "subject": "A"}],
                )
            source_engine.dispose()

            target_engine = create_engine("sqlite://")
            target_metadata = MetaData()
            target_contracts = Table(
                "contracts",
                target_metadata,
                Column("id", Integer, primary_key=True),
                Column("start_date", String(32), default=""),
                Column("subject", String(128), nullable=False),
            )
            target_metadata.create_all(target_engine)

            counts = import_sqlite_once(
                source_url=source_url,
                target_engine=target_engine,
                target_metadata=target_metadata,
                migration_name="test-contracts-import",
            )
            self.assertEqual(counts, {"contracts": 1})
            with target_engine.connect() as connection:
                row = connection.execute(select(target_contracts)).mappings().one()
            self.assertEqual(row["id"], 7)
            self.assertEqual(row["start_date"], "1403/01/02")

            repeated = import_sqlite_once(
                source_url=source_url,
                target_engine=target_engine,
                target_metadata=target_metadata,
                migration_name="test-contracts-import",
            )
            self.assertEqual(repeated, {})

    def test_import_refuses_a_populated_destination(self):
        with TemporaryDirectory() as directory:
            source_path = Path(directory) / "legacy.db"
            source_url = f"sqlite:///{source_path.as_posix()}"
            metadata = MetaData()
            users = Table(
                "users",
                metadata,
                Column("id", Integer, primary_key=True),
                Column("username", String(128), nullable=False),
            )
            source_engine = create_engine(source_url)
            metadata.create_all(source_engine)
            with source_engine.begin() as connection:
                connection.execute(users.insert(), {"id": 1, "username": "legacy"})
            source_engine.dispose()

            target_engine = create_engine("sqlite://")
            metadata.create_all(target_engine)
            with target_engine.begin() as connection:
                connection.execute(users.insert(), {"id": 2, "username": "existing"})

            with self.assertRaisesRegex(RuntimeError, "already contains data"):
                import_sqlite_once(
                    source_url=source_url,
                    target_engine=target_engine,
                    target_metadata=metadata,
                    migration_name="test-refusal",
                )


if __name__ == "__main__":
    unittest.main()
