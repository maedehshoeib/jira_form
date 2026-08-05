from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), default="")
    must_change_password: Mapped[bool] = mapped_column(default=True)
    display_name: Mapped[str] = mapped_column(String(256), default="")
    email: Mapped[str] = mapped_column(String(256), default="")
    category: Mapped[str] = mapped_column(String(256), default="")
    department: Mapped[str] = mapped_column(String(128), default="")
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    form_access_configured: Mapped[bool] = mapped_column(default=False)
    is_letter_recipient: Mapped[bool] = mapped_column(default=False, index=True)
    job_title: Mapped[str] = mapped_column(String(512), default="")
    extension: Mapped[str] = mapped_column(String(32), default="")
    avatar_url: Mapped[str] = mapped_column(String(512), default="")
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    is_admin: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
