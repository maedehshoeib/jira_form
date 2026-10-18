"""Personal mailbox folders for organizing received and sent letters."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LetterFolder(Base):
    """A user-owned folder under دریافتی or ارسالی."""

    __tablename__ = "letter_folders"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "scope",
            "name",
            name="uq_letter_folders_user_scope_name",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(80), default="")
    scope: Mapped[str] = mapped_column(String(16), default="received", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LetterFolderItem(Base):
    """Membership of one received submission or one sent batch in a folder."""

    __tablename__ = "letter_folder_items"
    __table_args__ = (
        UniqueConstraint(
            "folder_id",
            "submission_id",
            name="uq_letter_folder_items_folder_submission",
        ),
        UniqueConstraint(
            "folder_id",
            "batch_id",
            name="uq_letter_folder_items_folder_batch",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    folder_id: Mapped[int] = mapped_column(
        ForeignKey("letter_folders.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    submission_id: Mapped[int | None] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    batch_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
