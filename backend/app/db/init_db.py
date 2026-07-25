from pathlib import Path

from sqlalchemy import inspect, text

from app.core.config import settings
from app.db.base import Base
from app.db.contracts_base import ContractsBase
from app.db.contracts_session import contracts_engine
from app.db.seed_users import seed_users
from app.db.session import engine
from app.db.session import SessionLocal
from app.models import admin_session, contract, report, site_banner, submission, user  # noqa: F401
from app.models.site_banner import SiteBanner


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


def _migrate_users_db():
    """Idempotent migration for databases created before local authentication."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    migrations = [
        (
            "password_hash",
            "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT ''",
        ),
        (
            "must_change_password",
            "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT 1",
        ),
        (
            "category",
            "ALTER TABLE users ADD COLUMN category VARCHAR(256) NOT NULL DEFAULT ''",
        ),
        (
            "job_title",
            "ALTER TABLE users ADD COLUMN job_title VARCHAR(512) NOT NULL DEFAULT ''",
        ),
        (
            "extension",
            "ALTER TABLE users ADD COLUMN extension VARCHAR(32) NOT NULL DEFAULT ''",
        ),
        (
            "updated_at",
            "ALTER TABLE users ADD COLUMN updated_at DATETIME",
        ),
        (
            "password_changed_at",
            "ALTER TABLE users ADD COLUMN password_changed_at DATETIME",
        ),
        (
            "is_admin",
            "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0",
        ),
    ]
    with engine.begin() as conn:
        for column_name, ddl in migrations:
            if column_name not in columns:
                conn.execute(text(ddl))


def _migrate_site_banner_db():
    """Add image fields when upgrading from the earlier text-banner version."""
    inspector = inspect(engine)
    if "site_banners" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("site_banners")}
    migrations = [
        (
            "image_path",
            "ALTER TABLE site_banners ADD COLUMN image_path VARCHAR(512) NOT NULL DEFAULT ''",
        ),
        (
            "image_name",
            "ALTER TABLE site_banners ADD COLUMN image_name VARCHAR(256) NOT NULL DEFAULT ''",
        ),
    ]
    with engine.begin() as conn:
        for column_name, ddl in migrations:
            if column_name not in columns:
                conn.execute(text(ddl))


def init_db():
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.CONTRACTS_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _migrate_users_db()
    _migrate_site_banner_db()

    db = SessionLocal()
    try:
        if not db.query(SiteBanner).filter(SiteBanner.id == 1).first():
            db.add(SiteBanner(id=1))
            db.commit()
        seed_users(db)
    finally:
        db.close()

    contracts_db_path = settings.CONTRACTS_DATABASE_URL.replace("sqlite:///", "")
    Path(contracts_db_path).parent.mkdir(parents=True, exist_ok=True)
    ContractsBase.metadata.create_all(bind=contracts_engine)
    _migrate_contracts_db()
