from pathlib import Path
import shutil

from sqlalchemy import inspect, text

from app.core.config import settings
from app.db.base import Base
from app.db.contracts_base import ContractsBase
from app.db.contracts_session import contracts_engine
from app.db.seed_users import seed_users
from app.db.session import engine
from app.db.session import SessionLocal
from app.models import (  # noqa: F401
    admin_session,
    chat,
    contract,
    department,
    form_template,  # FormDutyAssignment + form access tables
    pdf_form,
    report,
    site_banner,
    site_news,
    submission,
    timesheet,
    user,
)
from app.models.department import Department
from app.models.user import User
from app.models.site_banner import SiteBanner, SiteBannerImage
from app.models.pdf_form import PdfForm


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
        (
            "department_id",
            "ALTER TABLE users ADD COLUMN department_id INTEGER",
        ),
        (
            "form_access_configured",
            "ALTER TABLE users ADD COLUMN form_access_configured BOOLEAN NOT NULL DEFAULT 0",
        ),
        (
            "avatar_url",
            "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NOT NULL DEFAULT ''",
        ),
    ]
    with engine.begin() as conn:
        for column_name, ddl in migrations:
            if column_name not in columns:
                conn.execute(text(ddl))


def _seed_departments_from_users():
    """Preserve existing free-text departments while upgrading."""
    db = SessionLocal()
    try:
        existing = {item.name: item for item in db.query(Department).all()}
        existing_by_id = {item.id: item for item in existing.values()}
        users = db.query(User).all()
        # A managed assignment is authoritative, including after a department rename.
        for user_item in users:
            if user_item.is_admin:
                # System administrator identities are not organizational employees.
                user_item.department_id = None
                continue
            managed = existing_by_id.get(user_item.department_id)
            if managed:
                user_item.department = managed.name
        names = {
            user_item.department.strip()
            for user_item in users
            if not user_item.is_admin
            and user_item.department_id is None
            and user_item.department
            and user_item.department.strip()
        }
        for name in sorted(names):
            if name not in existing:
                item = Department(name=name)
                db.add(item)
                db.flush()
                existing[name] = item
        for user_item in users:
            if user_item.is_admin or user_item.department_id is not None:
                continue
            name = (user_item.department or "").strip()
            if name in existing:
                user_item.department_id = existing[name].id
        db.commit()
    finally:
        db.close()


def _migrate_site_banner_db():
    """Upgrade older single-image banner databases without losing their image."""
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
        (
            "interval_seconds",
            "ALTER TABLE site_banners ADD COLUMN interval_seconds INTEGER NOT NULL DEFAULT 5",
        ),
    ]
    with engine.begin() as conn:
        for column_name, ddl in migrations:
            if column_name not in columns:
                conn.execute(text(ddl))


def _seed_pdf_forms():
    """Add the bundled meeting-request PDF to new and existing installations."""
    source_path = Path(__file__).resolve().parent.parent / "assets" / "forms" / "meeting-request.pdf"
    if not source_path.is_file():
        return

    forms_dir = (Path(settings.UPLOAD_DIR) / "forms").resolve()
    forms_dir.mkdir(parents=True, exist_ok=True)
    destination = forms_dir / "meeting-request.pdf"
    if not destination.is_file():
        shutil.copy2(source_path, destination)

    db = SessionLocal()
    try:
        existing = (
            db.query(PdfForm)
            .filter(PdfForm.file_name == "فرم درخواست جلسات.pdf")
            .first()
        )
        if not existing:
            db.add(
                PdfForm(
                    title="فرم درخواست جلسات",
                    description="فرم ثبت و هماهنگی درخواست جلسه",
                    file_path=str(destination),
                    file_name="فرم درخواست جلسات.pdf",
                    file_size=destination.stat().st_size,
                    uploaded_by="system",
                )
            )
            db.commit()
    finally:
        db.close()


def init_db():
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.CONTRACTS_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    pdf_forms_table_existed = "pdf_forms" in inspect(engine).get_table_names()
    Base.metadata.create_all(bind=engine)
    _migrate_users_db()
    # New tables can reference columns added by the idempotent migration above.
    Base.metadata.create_all(bind=engine)
    _migrate_site_banner_db()

    db = SessionLocal()
    try:
        if not db.query(SiteBanner).filter(SiteBanner.id == 1).first():
            db.add(SiteBanner(id=1))
            db.commit()
        banner = db.query(SiteBanner).filter(SiteBanner.id == 1).first()
        if (
            banner
            and banner.image_path
            and not db.query(SiteBannerImage)
            .filter(SiteBannerImage.banner_id == banner.id)
            .first()
        ):
            db.add(
                SiteBannerImage(
                    banner_id=banner.id,
                    image_path=banner.image_path,
                    image_name=banner.image_name,
                    sort_order=0,
                )
            )
            db.commit()
        from app.models.timesheet import TimesheetProject

        if not db.get(TimesheetProject, "GENERAL"):
            db.add(TimesheetProject(code="GENERAL", title="عمومی"))
            db.commit()
        seed_users(db)
    finally:
        db.close()
    _seed_departments_from_users()
    if settings.TIMESHEET_SEED_ENABLED:
        # These seeders preserve existing rows and only create missing demo
        # data. Run them after employees are available, on every server start.
        from scripts.seed_timesheet_demo import seed as seed_timesheet_demo
        from scripts.seed_user_timesheet_mock import seed as seed_user_timesheet

        seed_timesheet_demo(initialize_database=False)
        seed_user_timesheet(initialize_database=False)
    if not pdf_forms_table_existed:
        _seed_pdf_forms()

    contracts_db_path = settings.CONTRACTS_DATABASE_URL.replace("sqlite:///", "")
    Path(contracts_db_path).parent.mkdir(parents=True, exist_ok=True)
    ContractsBase.metadata.create_all(bind=contracts_engine)
    _migrate_contracts_db()
