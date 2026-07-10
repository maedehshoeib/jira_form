from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    form_id: Mapped[str] = mapped_column(String(64), index=True)
    department_id: Mapped[str] = mapped_column(String(64), default="")
    section_id: Mapped[str] = mapped_column(String(64), default="")
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    subject: Mapped[str] = mapped_column(String(512), default="")
    data: Mapped[str] = mapped_column(Text, default="{}")
    attachment_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="submitted")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
