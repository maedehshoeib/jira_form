from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PortalCard(Base):
    """An admin-managed card on the home page or inside another card.

    ``kind`` decides what opening the card does:

    * ``group``    – shows its child cards
    * ``form``     – shows a form built from ``form_schema`` (JSON)
    * ``document`` – shows ``content`` text plus downloadable files
    """

    __tablename__ = "portal_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("portal_cards.id", ondelete="CASCADE"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), default="group")
    title: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(String(512), default="")
    logo_path: Mapped[str] = mapped_column(String(512), default="")
    logo_name: Mapped[str] = mapped_column(String(256), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    form_schema: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # The ORM cascade removes whole subtrees in dependency order on any database,
    # including SQLite where ``ON DELETE CASCADE`` is not enforced by default.
    children: Mapped[list["PortalCard"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped["PortalCard | None"] = relationship(
        back_populates="children", remote_side=[id]
    )
    files: Mapped[list["PortalCardFile"]] = relationship(
        back_populates="card",
        cascade="all, delete-orphan",
        order_by="PortalCardFile.sort_order, PortalCardFile.id",
    )


class PortalCardFile(Base):
    """A downloadable file attached to a document card."""

    __tablename__ = "portal_card_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("portal_cards.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(256), default="")
    file_path: Mapped[str] = mapped_column(String(512))
    file_name: Mapped[str] = mapped_column(String(256), default="")
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    card: Mapped[PortalCard] = relationship(back_populates="files")
