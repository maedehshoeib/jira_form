from pathlib import Path

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import report, submission, user  # noqa: F401


def init_db():
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
