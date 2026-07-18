from pathlib import Path

from sqlalchemy import inspect, text

from app.core.config import settings
from app.db.base import Base
from app.db.contracts_base import ContractsBase
from app.db.contracts_session import contracts_engine
from app.db.session import engine
from app.models import contract, report, submission, user  # noqa: F401


def _migrate_contracts_db():
    inspector = inspect(contracts_engine)
    if "contracts" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("contracts")}

    with contracts_engine.begin() as conn:
        if "registration_date" in columns:
            conn.execute(
                text(
                    """
                    CREATE TABLE contracts_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        row_number INTEGER NOT NULL UNIQUE,
                        start_date VARCHAR(32) DEFAULT '',
                        end_date VARCHAR(32) DEFAULT '',
                        subject VARCHAR(512) NOT NULL,
                        contract_party VARCHAR(256) DEFAULT '',
                        contract_type VARCHAR(64) NOT NULL,
                        contract_number VARCHAR(128) NOT NULL,
                        attachment_path VARCHAR(512),
                        attachment_name VARCHAR(256),
                        created_by_id INTEGER NOT NULL,
                        created_by_name VARCHAR(128) DEFAULT '',
                        created_at DATETIME
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO contracts_new (
                        id, row_number, start_date, end_date, subject, contract_party,
                        contract_type, contract_number, attachment_path, attachment_name,
                        created_by_id, created_by_name, created_at
                    )
                    SELECT
                        id,
                        row_number,
                        COALESCE(NULLIF(start_date, ''), registration_date, ''),
                        COALESCE(end_date, ''),
                        subject,
                        COALESCE(contract_party, ''),
                        contract_type,
                        contract_number,
                        attachment_path,
                        attachment_name,
                        created_by_id,
                        created_by_name,
                        created_at
                    FROM contracts
                    """
                )
            )
            conn.execute(text("DROP TABLE contracts"))
            conn.execute(text("ALTER TABLE contracts_new RENAME TO contracts"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_contracts_row_number "
                    "ON contracts (row_number)"
                )
            )
            return

        migrations = [
            ("start_date", "ALTER TABLE contracts ADD COLUMN start_date VARCHAR(32) DEFAULT ''"),
            ("end_date", "ALTER TABLE contracts ADD COLUMN end_date VARCHAR(32) DEFAULT ''"),
            ("contract_party", "ALTER TABLE contracts ADD COLUMN contract_party VARCHAR(256) DEFAULT ''"),
        ]
        for column_name, ddl in migrations:
            if column_name not in columns:
                conn.execute(text(ddl))


def init_db():
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.CONTRACTS_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)

    contracts_db_path = settings.CONTRACTS_DATABASE_URL.replace("sqlite:///", "")
    Path(contracts_db_path).parent.mkdir(parents=True, exist_ok=True)
    ContractsBase.metadata.create_all(bind=contracts_engine)
    _migrate_contracts_db()
