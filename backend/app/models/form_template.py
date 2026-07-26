from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DepartmentFormAccess(Base):
    __tablename__ = "department_form_access"
    __table_args__ = (
        UniqueConstraint(
            "department_id",
            "portal_department_id",
            "section_id",
            "form_id",
            name="uq_department_form_access_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), index=True
    )
    portal_department_id: Mapped[str] = mapped_column(String(64))
    section_id: Mapped[str] = mapped_column(String(64), default="")
    form_id: Mapped[str] = mapped_column(String(64))


class UserFormAccess(Base):
    __tablename__ = "user_form_access"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "portal_department_id",
            "section_id",
            "form_id",
            name="uq_user_form_access_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    portal_department_id: Mapped[str] = mapped_column(String(64))
    section_id: Mapped[str] = mapped_column(String(64), default="")
    form_id: Mapped[str] = mapped_column(String(64))
