from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    status_note: Mapped[str] = mapped_column(String(512), default="")
    status_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status_updated_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ManagementLetterNumberCounter(Base):
    """Durable per-letter-type sequence used for system letter numbers."""

    __tablename__ = "management_letter_number_counters"

    letter_type: Mapped[str] = mapped_column(String(16), primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer, nullable=False)


class SubmissionInitialAssignee(Base):
    """Immutable snapshot of the users a request was initially routed to."""

    __tablename__ = "submission_initial_assignees"
    __table_args__ = (
        UniqueConstraint(
            "submission_id",
            "user_id",
            name="uq_submission_initial_assignee_user",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SubmissionReferral(Base):
    __tablename__ = "submission_referrals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    from_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    to_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    note: Mapped[str] = mapped_column(String(512), default="")
    attachment_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SubmissionView(Base):
    """Per-user read state for a task.

    A submission can be visible to more than one duty owner or referral recipient,
    so read state cannot safely live on the submission itself.
    """

    __tablename__ = "submission_views"
    __table_args__ = (
        UniqueConstraint(
            "submission_id",
            "user_id",
            name="uq_submission_view_user",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    first_viewed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_viewed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SubmissionStatusHistory(Base):
    """Immutable audit records for status and progress updates."""

    __tablename__ = "submission_status_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )
    changed_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[str] = mapped_column(String(32), default="submitted")
    to_status: Mapped[str] = mapped_column(String(32), default="submitted")
    from_progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    to_progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(String(512), default="")
    attachment_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
