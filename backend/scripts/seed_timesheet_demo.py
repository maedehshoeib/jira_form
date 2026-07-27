"""Seed a realistic, repeatable timesheet dataset for the admin dashboard.

Run from the repository root:
    .venv/Scripts/python.exe backend/scripts/seed_timesheet_demo.py

The script only inserts missing demo records. It never deletes or changes
existing employee timesheets.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
import os
from pathlib import Path
import random
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep local seeding aligned with `cd backend && uvicorn ...` regardless of the
# directory from which this script is invoked. Explicit environment settings
# still take precedence for Docker or another database.
os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{(BACKEND_DIR / 'data' / 'portal.db').as_posix()}",
)
os.environ.setdefault(
    "CONTRACTS_DATABASE_URL",
    f"sqlite:///{(BACKEND_DIR / 'data' / 'contracts.db').as_posix()}",
)
os.environ.setdefault("UPLOAD_DIR", str(BACKEND_DIR / "data" / "uploads"))
os.environ.setdefault(
    "CONTRACTS_UPLOAD_DIR",
    str(BACKEND_DIR / "data" / "contracts_uploads"),
)

from app.db.init_db import init_db  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.timesheet import (  # noqa: E402
    TimesheetAttendance,
    TimesheetProject,
    TimesheetTask,
)
from app.models.user import User  # noqa: E402


PROJECTS = {
    "PORTAL": "پورتال خدمات سازمانی",
    "MOBILE": "اپلیکیشن موبایل",
    "SUPPORT": "پشتیبانی مشتریان",
    "DATA": "داشبورد داده و گزارش",
    "OPS": "بهبود فرایندهای داخلی",
}

TASKS = {
    "PORTAL": [
        "تحلیل و بهبود تجربه کاربری [نمونه]",
        "پیاده‌سازی قابلیت جدید پورتال [نمونه]",
        "بررسی و رفع خطای گزارش‌شده [نمونه]",
    ],
    "MOBILE": [
        "بازبینی سناریوهای نسخه موبایل [نمونه]",
        "تست فرایند ورود و احراز هویت [نمونه]",
        "هماهنگی انتشار نسخه جدید [نمونه]",
    ],
    "SUPPORT": [
        "پیگیری درخواست‌های مشتریان [نمونه]",
        "تحلیل موارد پرتکرار مرکز تماس [نمونه]",
        "به‌روزرسانی راهنمای پاسخ‌گویی [نمونه]",
    ],
    "DATA": [
        "پاک‌سازی و کنترل کیفیت داده‌ها [نمونه]",
        "طراحی شاخص‌های گزارش مدیریتی [نمونه]",
        "بهینه‌سازی گزارش عملکرد [نمونه]",
    ],
    "OPS": [
        "مستندسازی فرایند داخلی [نمونه]",
        "جلسه هماهنگی بین واحدی [نمونه]",
        "بررسی اقدام‌های برنامه هفتگی [نمونه]",
    ],
}

SLOTS = [
    ("08:45", "10:15"),
    ("10:30", "11:45"),
    ("12:45", "14:15"),
    ("14:30", "15:45"),
    ("16:00", "16:40"),
]


def gregorian_to_jalali(value: date) -> str:
    """Convert a Gregorian date to YYYY/MM/DD in the Jalali calendar."""
    gy, gm, gd = value.year, value.month, value.day
    gregorian_days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

    adjusted_year = gy + 1 if gm > 2 else gy
    days = (
        355666
        + 365 * gy
        + (adjusted_year + 3) // 4
        - (adjusted_year + 99) // 100
        + (adjusted_year + 399) // 400
        + gd
        + gregorian_days[gm - 1]
    )

    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + days // 31
        jd = 1 + days % 31
    else:
        jm = 7 + (days - 186) // 30
        jd = 1 + (days - 186) % 30
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def minutes(value: str) -> int:
    hour, minute = (int(part) for part in value.split(":"))
    return hour * 60 + minute


def pick_employees(users: list[User]) -> list[User]:
    """Choose up to four people from each of the four largest departments."""
    counts = Counter(user.department.strip() for user in users if user.department.strip())
    departments = [name for name, _ in counts.most_common(4)]
    grouped: dict[str, list[User]] = defaultdict(list)
    for user in users:
        if user.department.strip() in departments:
            grouped[user.department.strip()].append(user)
    return [user for department in departments for user in grouped[department][:4]]


def seed(*, initialize_database: bool = True) -> dict[str, int | str]:
    """Insert missing admin-dashboard demo rows.

    ``initialize_database`` is disabled when this is called from ``init_db``
    itself, preventing startup from recursively initializing the database.
    """
    if initialize_database:
        init_db()
    rng = random.Random(14050505)
    db = SessionLocal()
    created_attendance = 0
    created_tasks = 0

    try:
        employees = pick_employees(
            db.query(User)
            .filter(User.is_active.is_(True), User.is_admin.is_(False))
            .order_by(User.id)
            .all()
        )
        if not employees:
            raise RuntimeError("No active employees were found. Run the user seed first.")

        for code, title in PROJECTS.items():
            project = db.get(TimesheetProject, code)
            if project is None:
                db.add(TimesheetProject(code=code, title=title, is_active=True))
            else:
                project.title = title
                project.is_active = True
        db.flush()

        today = date.today()
        workdays = [
            today - timedelta(days=offset)
            for offset in range(29, -1, -1)
            if (today - timedelta(days=offset)).weekday() not in (3, 4)
        ]

        for employee_index, employee in enumerate(employees):
            preferred_projects = list(PROJECTS)[employee_index % len(PROJECTS):] + list(PROJECTS)[:employee_index % len(PROJECTS)]
            for day_index, workday in enumerate(workdays):
                # Occasional leave/absence makes the zero-record state meaningful.
                if rng.random() < 0.09:
                    continue

                work_date = gregorian_to_jalali(workday)
                check_in_minute = rng.choice([5, 12, 18, 25, 35, 45])
                check_in = f"08:{check_in_minute:02d}"
                is_open_today = workday == today and employee_index in (0, 5)
                check_out = None if is_open_today else rng.choice(["16:35", "16:50", "17:05", "17:20"])

                existing_attendance = (
                    db.query(TimesheetAttendance)
                    .filter(
                        TimesheetAttendance.user_id == employee.id,
                        TimesheetAttendance.work_date == work_date,
                        TimesheetAttendance.check_in_time == check_in,
                    )
                    .first()
                )
                if existing_attendance is None:
                    db.add(
                        TimesheetAttendance(
                            user_id=employee.id,
                            work_date=work_date,
                            check_in_time=check_in,
                            check_out_time=check_out,
                            created_at=datetime.combine(workday, datetime.min.time()),
                        )
                    )
                    created_attendance += 1

                slot_count = rng.choice([3, 3, 4, 4, 5])
                for slot_index, (start_time, end_time) in enumerate(SLOTS[:slot_count]):
                    project_code = preferred_projects[(day_index + slot_index) % 3]
                    task_name = rng.choice(TASKS[project_code])
                    existing_task = (
                        db.query(TimesheetTask)
                        .filter(
                            TimesheetTask.user_id == employee.id,
                            TimesheetTask.work_date == work_date,
                            TimesheetTask.start_time == start_time,
                            TimesheetTask.task_name == task_name,
                        )
                        .first()
                    )
                    if existing_task is not None:
                        continue
                    db.add(
                        TimesheetTask(
                            user_id=employee.id,
                            work_date=work_date,
                            project_code=project_code,
                            task_name=task_name,
                            start_time=start_time,
                            end_time=end_time,
                            minutes_spent=minutes(end_time) - minutes(start_time),
                            created_at=datetime.combine(workday, datetime.min.time()),
                        )
                    )
                    created_tasks += 1

        db.commit()
        return {
            "employees": len(employees),
            "departments": len({employee.department for employee in employees}),
            "workdays": len(workdays),
            "attendance_created": created_attendance,
            "tasks_created": created_tasks,
            "start_date": gregorian_to_jalali(workdays[0]),
            "end_date": gregorian_to_jalali(workdays[-1]),
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    result = seed()
    print("Timesheet demo data is ready:")
    for key, value in result.items():
        print(f"  {key}: {value}")
