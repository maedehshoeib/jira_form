"""Seed repeatable timesheet preview data for one local user.

Run from the repository root:
    .venv/Scripts/python.exe backend/scripts/seed_user_timesheet_mock.py

Set TIMESHEET_DEMO_USERNAME to target another account. Existing records are
preserved and the script only inserts missing mock rows.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
import os
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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


USERNAME = os.environ.get("TIMESHEET_DEMO_USERNAME", "ma.shoeib")
PROJECTS = {
    "PORTAL": "پورتال خدمات سازمانی",
    "DATA": "داشبورد داده و گزارش",
    "OPS": "بهبود فرایندهای داخلی",
    "SUPPORT": "پشتیبانی مشتریان",
}

# Each item represents one of the seven calendar days ending today.
# The varied hours and gaps make both attendance and task layers easy to see.
DAY_TEMPLATES = [
    {
        "attendance": ("08:28", "16:42"),
        "tasks": [
            ("08:45", "10:10", "PORTAL", "بازطراحی صفحه ثبت کارکرد [نمونه]"),
            ("10:25", "11:35", "PORTAL", "پیاده‌سازی کارت‌های خلاصه روزانه [نمونه]"),
            ("12:30", "13:50", "DATA", "بررسی داده‌های گزارش عملکرد [نمونه]"),
            ("14:05", "15:30", "OPS", "مستندسازی فرایند جدید [نمونه]"),
        ],
    },
    {
        "attendance": ("08:40", "17:08"),
        "tasks": [
            ("08:55", "10:20", "SUPPORT", "پیگیری درخواست‌های کاربران [نمونه]"),
            ("10:35", "12:00", "PORTAL", "رفع خطای نمایش تقویم شمسی [نمونه]"),
            ("12:50", "14:05", "DATA", "کنترل کیفیت خروجی گزارش [نمونه]"),
            ("14:20", "16:10", "PORTAL", "تست واکنش‌گرایی داشبورد [نمونه]"),
        ],
    },
    {
        "attendance": ("09:05", "15:55"),
        "tasks": [
            ("09:20", "10:35", "OPS", "جلسه برنامه‌ریزی هفتگی [نمونه]"),
            ("10:50", "12:10", "DATA", "تحلیل شاخص‌های کارکرد [نمونه]"),
            ("13:00", "14:30", "PORTAL", "بهبود تجربه کاربری فرم‌ها [نمونه]"),
        ],
    },
    {
        "attendance": ("08:22", "16:58"),
        "tasks": [
            ("08:35", "10:05", "PORTAL", "توسعه بخش فعالیت‌های روز [نمونه]"),
            ("10:20", "11:40", "SUPPORT", "بررسی بازخورد کاربران [نمونه]"),
            ("12:35", "14:00", "PORTAL", "بهینه‌سازی نمایش موبایل [نمونه]"),
            ("14:15", "16:05", "DATA", "ساخت خروجی گزارش هفتگی [نمونه]"),
        ],
    },
    {
        "attendance": ("08:48", "17:15"),
        "tasks": [
            ("09:00", "10:40", "DATA", "تطبیق اطلاعات حضور و فعالیت [نمونه]"),
            ("10:55", "12:05", "OPS", "هماهنگی با واحد منابع انسانی [نمونه]"),
            ("13:00", "14:25", "PORTAL", "بازبینی دسترس‌پذیری رابط [نمونه]"),
            ("14:40", "16:30", "PORTAL", "رفع موارد نهایی داشبورد [نمونه]"),
        ],
    },
    {
        "attendance": ("09:12", "16:35"),
        "tasks": [
            ("09:25", "10:50", "SUPPORT", "پاسخ‌گویی به درخواست‌های پشتیبانی [نمونه]"),
            ("11:05", "12:15", "OPS", "به‌روزرسانی مستندات داخلی [نمونه]"),
            ("13:10", "14:45", "DATA", "تهیه گزارش مقایسه‌ای [نمونه]"),
            ("15:00", "16:05", "PORTAL", "بازبینی نسخه آماده انتشار [نمونه]"),
        ],
    },
    {
        "attendance": ("08:32", "17:05"),
        "tasks": [
            ("08:50", "10:15", "PORTAL", "تکمیل طراحی صفحه کارکرد [نمونه]"),
            ("10:30", "11:45", "DATA", "بررسی نمودار هفتگی [نمونه]"),
            ("12:40", "14:05", "PORTAL", "تست جریان ثبت فعالیت [نمونه]"),
            ("14:20", "15:40", "SUPPORT", "بررسی و رفع بازخوردها [نمونه]"),
            ("15:50", "16:35", "OPS", "جمع‌بندی و ثبت گزارش روزانه [نمونه]"),
        ],
    },
]


def gregorian_to_jalali(value: date) -> str:
    gy, gm, gd = value.year, value.month, value.day
    month_days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    adjusted_year = gy + 1 if gm > 2 else gy
    days = (
        355666
        + 365 * gy
        + (adjusted_year + 3) // 4
        - (adjusted_year + 99) // 100
        + (adjusted_year + 399) // 400
        + gd
        + month_days[gm - 1]
    )
    jy = -1595 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm, jd = 1 + days // 31, 1 + days % 31
    else:
        jm, jd = 7 + (days - 186) // 30, 1 + (days - 186) % 30
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def duration(start: str, end: str) -> int:
    start_hour, start_minute = map(int, start.split(":"))
    end_hour, end_minute = map(int, end.split(":"))
    return (end_hour * 60 + end_minute) - (start_hour * 60 + start_minute)


def seed() -> dict[str, int | str]:
    init_db()
    db = SessionLocal()
    attendance_created = 0
    tasks_created = 0

    try:
        user = (
            db.query(User)
            .filter(User.username.ilike(USERNAME))
            .one_or_none()
        )
        if user is None:
            raise RuntimeError(f"User {USERNAME!r} was not found.")

        for code, title in PROJECTS.items():
            project = db.get(TimesheetProject, code)
            if project is None:
                db.add(TimesheetProject(code=code, title=title, is_active=True))
            else:
                project.is_active = True
        db.flush()

        first_day = date.today() - timedelta(days=6)
        for offset, template in enumerate(DAY_TEMPLATES):
            gregorian_day = first_day + timedelta(days=offset)
            work_date = gregorian_to_jalali(gregorian_day)
            check_in, check_out = template["attendance"]

            existing_attendance = (
                db.query(TimesheetAttendance)
                .filter(
                    TimesheetAttendance.user_id == user.id,
                    TimesheetAttendance.work_date == work_date,
                    TimesheetAttendance.check_in_time == check_in,
                )
                .first()
            )
            if existing_attendance is None:
                db.add(
                    TimesheetAttendance(
                        user_id=user.id,
                        work_date=work_date,
                        check_in_time=check_in,
                        check_out_time=check_out,
                        created_at=datetime.combine(
                            gregorian_day, datetime.min.time()
                        ),
                    )
                )
                attendance_created += 1

            for start, end, project_code, task_name in template["tasks"]:
                existing_task = (
                    db.query(TimesheetTask)
                    .filter(
                        TimesheetTask.user_id == user.id,
                        TimesheetTask.work_date == work_date,
                        TimesheetTask.start_time == start,
                        TimesheetTask.task_name == task_name,
                    )
                    .first()
                )
                if existing_task is not None:
                    continue
                db.add(
                    TimesheetTask(
                        user_id=user.id,
                        work_date=work_date,
                        project_code=project_code,
                        task_name=task_name,
                        start_time=start,
                        end_time=end,
                        minutes_spent=duration(start, end),
                        created_at=datetime.combine(
                            gregorian_day, datetime.min.time()
                        ),
                    )
                )
                tasks_created += 1

        db.commit()
        return {
            "username": user.username,
            "user_id": user.id,
            "start_date": gregorian_to_jalali(first_day),
            "end_date": gregorian_to_jalali(date.today()),
            "attendance_created": attendance_created,
            "tasks_created": tasks_created,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    result = seed()
    print("User timesheet mock data is ready:")
    for key, value in result.items():
        print(f"  {key}: {value}")
