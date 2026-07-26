from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SiteBanner(Base):
    __tablename__ = "site_banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    is_active: Mapped[bool] = mapped_column(default=False)
    image_path: Mapped[str] = mapped_column(String(512), default="")
    image_name: Mapped[str] = mapped_column(String(256), default="")
    interval_seconds: Mapped[int] = mapped_column(Integer, default=5)
    # Kept for compatibility with databases created by the earlier text-banner version.
    title: Mapped[str] = mapped_column(String(160), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    link_label: Mapped[str] = mapped_column(String(80), default="")
    link_url: Mapped[str] = mapped_column(String(512), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class SiteBannerImage(Base):
    __tablename__ = "site_banner_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    banner_id: Mapped[int] = mapped_column(
        ForeignKey("site_banners.id"), default=1, index=True
    )
    image_path: Mapped[str] = mapped_column(String(512))
    image_name: Mapped[str] = mapped_column(String(256), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
