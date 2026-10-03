from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organizational_position: Mapped[str] = mapped_column(String(256))
    organizational_unit: Mapped[str] = mapped_column(String(256), index=True)
    unit_responsibility: Mapped[str] = mapped_column(Text, default="")
    qualification_requirements: Mapped[str] = mapped_column(Text, default="")
    photo_path: Mapped[str] = mapped_column(String(512), default="")
    photo_name: Mapped[str] = mapped_column(String(256), default="")
    attachment_path: Mapped[str] = mapped_column(String(512), default="")
    attachment_name: Mapped[str] = mapped_column(String(256), default="")
    attachment_size: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
