from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TimesheetAttendance(Base):
    __tablename__ = "timesheet_attendance"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    work_date: Mapped[str] = mapped_column(String(16), index=True)
    check_in_time: Mapped[str] = mapped_column(String(5))
    check_out_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class TimesheetProject(Base):
    __tablename__ = "timesheet_projects"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    title: Mapped[str] = mapped_column(String(250), default="")
    start_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    end_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TimesheetSubproject(Base):
    __tablename__ = "timesheet_subprojects"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    project_code: Mapped[str] = mapped_column(
        ForeignKey("timesheet_projects.code", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(250), default="")
    start_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    end_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TimesheetProjectUser(Base):
    __tablename__ = "timesheet_project_users"

    project_code: Mapped[str] = mapped_column(
        ForeignKey("timesheet_projects.code", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )


class TimesheetSubprojectUser(Base):
    __tablename__ = "timesheet_subproject_users"

    subproject_code: Mapped[str] = mapped_column(
        ForeignKey("timesheet_subprojects.code", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )


class TimesheetTask(Base):
    __tablename__ = "timesheet_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    work_date: Mapped[str] = mapped_column(String(16), index=True)
    project_code: Mapped[str] = mapped_column(
        ForeignKey("timesheet_projects.code"), index=True
    )
    subproject_code: Mapped[str | None] = mapped_column(
        ForeignKey("timesheet_subprojects.code"),
        nullable=True,
        index=True,
    )
    task_name: Mapped[str] = mapped_column(String(250))
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))
    minutes_spent: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
