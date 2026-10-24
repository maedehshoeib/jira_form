"""Personal recipient groups for one-click letter and referral targeting."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RecipientGroup(Base):
    """A named set of colleagues owned by one user."""

    __tablename__ = "recipient_groups"
    __table_args__ = (
        UniqueConstraint("owner_id", "name", name="uq_recipient_groups_owner_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RecipientGroupMember(Base):
    """Membership of one active user in a recipient group."""

    __tablename__ = "recipient_group_members"

    group_id: Mapped[int] = mapped_column(
        ForeignKey("recipient_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
