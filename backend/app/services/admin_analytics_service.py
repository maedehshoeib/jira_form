"""Aggregated admin analytics for forms and timesheet data."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from functools import lru_cache
from typing import DefaultDict

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.jalali import (
    gregorian_to_jalali,
    jalali_range_to_datetimes,
    jalali_today,
    normalize_digits,
)
from app.models.admin_session import AdminSession
from app.models.submission import Submission
from app.models.timesheet import (
    TimesheetAttendance,
    TimesheetProject,
    TimesheetSubproject,
    TimesheetTask,
)
from app.models.user import User
from app.schemas.admin import (
    AnalyticsOverview,
    AnalyticsResponse,
    ChartItem,
    DailyFormPoint,
    DailyTimesheetPoint,
    DashboardRecentRequest,
    DepartmentAnalyticsRow,
    EmployeeAnalyticsRow,
    FormsAnalytics,
    ProjectAnalyticsRow,
    SubprojectAnalyticsRow,
)
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES


@lru_cache(maxsize=1)
def _timesheet_timezone():
    try:
        return ZoneInfo(settings.TIMESHEET_TIMEZONE)
    except ZoneInfoNotFoundError:
        from datetime import timezone

        return timezone(timedelta(hours=3, minutes=30))


def _local_now_time() -> str:
    return datetime.now(_timesheet_timezone()).strftime("%H:%M")


def _minutes(value: str) -> int:
    hour, minute = (int(part) for part in value.split(":"))
    return hour * 60 + minute


def _attendance_minutes(
    check_in: str | None,
    check_out: str | None,
    work_date: str,
    today_jalali: str,
    now_time: str,
) -> int:
    if not check_in:
        return 0
    if check_out:
        end = check_out
    elif work_date == today_jalali:
        end = now_time
    else:
        return 0
    duration = _minutes(end) - _minutes(check_in)
    return max(duration, 0)


def _portal_department_title(department_id: str) -> str:
    if not department_id:
        return "بدون واحد پرتال"
    for department in DEPARTMENTS:
        if department.id == department_id:
            return department.title
    return department_id


def _form_title(form_id: str) -> str:
    template = FORM_TEMPLATES.get(form_id)
    if template:
        return template.title
    return form_id or "فرم نامشخص"


def _org_department(user: User | None) -> str:
    if not user:
        return "بدون واحد"
    return (user.department or "").strip() or "بدون واحد"


def build_analytics(
    db: Session,
    *,
    admin: User,
    start_date: str,
    end_date: str,
) -> AnalyticsResponse:
    start = normalize_digits(start_date)
    end = normalize_digits(end_date)
    if start > end:
        raise ValueError("تاریخ شروع باید قبل از تاریخ پایان باشد.")

    form_start, form_end = jalali_range_to_datetimes(start, end)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_jalali = jalali_today()
    now_time = _local_now_time()

    users = (
        db.query(User)
        .filter(User.is_admin.is_(False))
        .order_by(User.display_name, User.username)
        .all()
    )
    total_users = len(users)
    active_users = sum(1 for user in users if user.is_active)

    attendance_rows = (
        db.query(TimesheetAttendance, User)
        .join(User, User.id == TimesheetAttendance.user_id)
        .filter(
            TimesheetAttendance.work_date >= start,
            TimesheetAttendance.work_date <= end,
            User.is_admin.is_(False),
        )
        .all()
    )
    task_rows = (
        db.query(TimesheetTask, User)
        .join(User, User.id == TimesheetTask.user_id)
        .filter(
            TimesheetTask.work_date >= start,
            TimesheetTask.work_date <= end,
            User.is_admin.is_(False),
        )
        .all()
    )
    projects = {
        item.code: item.title or item.code
        for item in db.query(TimesheetProject).all()
    }
    subprojects = {
        item.code: item
        for item in db.query(TimesheetSubproject).all()
    }

    submissions_in_range = (
        db.query(Submission, User)
        .outerjoin(User, User.id == Submission.user_id)
        .filter(
            Submission.created_at >= form_start,
            Submission.created_at < form_end,
        )
        .all()
    )
    all_time_requests = db.query(Submission).count()
    requests_today = (
        db.query(Submission).filter(Submission.created_at >= today_start).count()
    )
    active_admin_devices = (
        db.query(AdminSession.device_id)
        .filter(AdminSession.user_id == admin.id, AdminSession.is_active.is_(True))
        .distinct()
        .count()
    )

    employee_attendance: DefaultDict[int, int] = defaultdict(int)
    employee_task_minutes: DefaultDict[int, int] = defaultdict(int)
    employee_task_count: DefaultDict[int, int] = defaultdict(int)
    employee_active_days: DefaultDict[int, set[str]] = defaultdict(set)
    employee_form_count: DefaultDict[int, int] = defaultdict(int)
    open_check_ins = 0

    daily_attendance: DefaultDict[str, int] = defaultdict(int)
    daily_tasks: DefaultDict[str, int] = defaultdict(int)

    project_minutes: DefaultDict[str, int] = defaultdict(int)
    project_tasks: DefaultDict[str, int] = defaultdict(int)
    project_employees: DefaultDict[str, set[int]] = defaultdict(set)
    subproject_minutes: DefaultDict[str, int] = defaultdict(int)
    subproject_tasks: DefaultDict[str, int] = defaultdict(int)
    subproject_employees: DefaultDict[str, set[int]] = defaultdict(set)

    for attendance, user in attendance_rows:
        minutes = _attendance_minutes(
            attendance.check_in_time,
            attendance.check_out_time,
            attendance.work_date,
            today_jalali,
            now_time,
        )
        employee_attendance[user.id] += minutes
        employee_active_days[user.id].add(attendance.work_date)
        daily_attendance[attendance.work_date] += minutes
        if attendance.check_out_time is None:
            open_check_ins += 1

    for task, user in task_rows:
        employee_task_minutes[user.id] += task.minutes_spent
        employee_task_count[user.id] += 1
        employee_active_days[user.id].add(task.work_date)
        daily_tasks[task.work_date] += task.minutes_spent
        project_minutes[task.project_code] += task.minutes_spent
        project_tasks[task.project_code] += 1
        project_employees[task.project_code].add(user.id)
        if task.subproject_code:
            subproject_minutes[task.subproject_code] += task.minutes_spent
            subproject_tasks[task.subproject_code] += 1
            subproject_employees[task.subproject_code].add(user.id)

    for submission, user in submissions_in_range:
        if user:
            employee_form_count[user.id] += 1

    total_attendance = sum(employee_attendance.values())
    total_task_minutes = sum(employee_task_minutes.values())
    active_employee_ids = {
        user_id
        for user_id in set(employee_attendance) | set(employee_task_minutes)
        if employee_attendance[user_id] or employee_task_minutes[user_id]
    }

    employees: list[EmployeeAnalyticsRow] = []
    for user in users:
        attendance = employee_attendance[user.id]
        tracked = employee_task_minutes[user.id]
        form_count = employee_form_count[user.id]
        if not attendance and not tracked and not form_count:
            # Still include employees with zero activity so the directory is complete
            # when admins want to see who has no timesheet/forms in range.
            pass
        employees.append(
            EmployeeAnalyticsRow(
                employee_id=str(user.id),
                username=user.username,
                full_name=user.display_name or user.username,
                department=_org_department(user),
                job_title=user.job_title or "",
                attendance_minutes=attendance,
                task_minutes=tracked,
                untracked_minutes=max(attendance - tracked, 0),
                efficiency_percent=(
                    round(tracked / attendance * 100, 2) if attendance else 0.0
                ),
                task_count=employee_task_count[user.id],
                active_days=len(employee_active_days[user.id]),
                form_count=form_count,
            )
        )
    employees.sort(key=lambda row: (row.task_minutes, row.form_count), reverse=True)

    project_rows = [
        ProjectAnalyticsRow(
            code=code,
            title=projects.get(code, code),
            minutes=project_minutes[code],
            task_count=project_tasks[code],
            employee_count=len(project_employees[code]),
            subprojects=sorted(
                [
                    SubprojectAnalyticsRow(
                        code=sub.code,
                        title=sub.title or sub.code,
                        minutes=subproject_minutes[sub.code],
                        task_count=subproject_tasks[sub.code],
                        employee_count=len(subproject_employees[sub.code]),
                    )
                    for sub in subprojects.values()
                    if sub.project_code == code and sub.code in subproject_minutes
                ],
                key=lambda row: row.minutes,
                reverse=True,
            ),
        )
        for code in project_minutes
    ]
    project_rows.sort(key=lambda row: row.minutes, reverse=True)

    dept_attendance: DefaultDict[str, int] = defaultdict(int)
    dept_task_minutes: DefaultDict[str, int] = defaultdict(int)
    dept_task_count: DefaultDict[str, int] = defaultdict(int)
    dept_forms: DefaultDict[str, int] = defaultdict(int)
    dept_employees: DefaultDict[str, set[int]] = defaultdict(set)
    dept_active: DefaultDict[str, set[int]] = defaultdict(set)

    for user in users:
        name = _org_department(user)
        dept_employees[name].add(user.id)
        if user.id in active_employee_ids:
            dept_active[name].add(user.id)
        dept_attendance[name] += employee_attendance[user.id]
        dept_task_minutes[name] += employee_task_minutes[user.id]
        dept_task_count[name] += employee_task_count[user.id]

    for submission, user in submissions_in_range:
        name = _org_department(user)
        dept_forms[name] += 1
        if user:
            dept_employees[name].add(user.id)

    department_names = set(dept_employees) | set(dept_forms)
    department_rows = [
        DepartmentAnalyticsRow(
            name=name,
            employee_count=len(dept_employees[name]),
            attendance_minutes=dept_attendance[name],
            task_minutes=dept_task_minutes[name],
            untracked_minutes=max(dept_attendance[name] - dept_task_minutes[name], 0),
            efficiency_percent=(
                round(dept_task_minutes[name] / dept_attendance[name] * 100, 2)
                if dept_attendance[name]
                else 0.0
            ),
            task_count=dept_task_count[name],
            form_count=dept_forms[name],
            active_employees=len(dept_active[name]),
        )
        for name in department_names
    ]
    department_rows.sort(
        key=lambda row: (row.task_minutes + row.form_count * 60, row.form_count),
        reverse=True,
    )

    # Forms breakdowns
    status_counts: DefaultDict[str, int] = defaultdict(int)
    org_dept_forms: DefaultDict[str, int] = defaultdict(int)
    portal_dept_forms: DefaultDict[str, int] = defaultdict(int)
    form_type_counts: DefaultDict[str, int] = defaultdict(int)
    submitter_counts: DefaultDict[str, int] = defaultdict(int)
    daily_form_counts: DefaultDict[str, int] = defaultdict(int)

    for submission, user in submissions_in_range:
        status_counts[submission.status or "نامشخص"] += 1
        org_dept_forms[_org_department(user)] += 1
        portal_dept_forms[_portal_department_title(submission.department_id)] += 1
        form_type_counts[_form_title(submission.form_id)] += 1
        submitter_name = (
            (user.display_name or user.username) if user else "کاربر حذف‌شده"
        )
        submitter_counts[submitter_name] += 1
        daily_form_counts[gregorian_to_jalali(submission.created_at.date())] += 1

    # Monthly trend for last 6 Gregorian months (forms, all-time window relative to now)
    month_start = today_start.replace(day=1)
    months: list[tuple[str, datetime]] = []
    cursor = month_start
    for _ in range(6):
        months.append((cursor.strftime("%Y/%m"), cursor))
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    months.reverse()
    monthly_items: list[ChartItem] = []
    for index, (label, month_begin) in enumerate(months):
        month_end = (
            months[index + 1][1]
            if index + 1 < len(months)
            else (month_start + timedelta(days=32)).replace(day=1)
        )
        count = (
            db.query(Submission)
            .filter(
                Submission.created_at >= month_begin,
                Submission.created_at < month_end,
            )
            .count()
        )
        monthly_items.append(ChartItem(label=label, value=count))

    recent_rows = (
        db.query(Submission, User)
        .outerjoin(User, User.id == Submission.user_id)
        .order_by(Submission.created_at.desc())
        .limit(12)
        .all()
    )

    def chart_from_counts(counts: dict[str, int], limit: int | None = None) -> list[ChartItem]:
        items = [
            ChartItem(label=label, value=value)
            for label, value in sorted(counts.items(), key=lambda item: item[1], reverse=True)
            if value
        ]
        return items[:limit] if limit is not None else items

    timesheet_dates = sorted(set(daily_attendance) | set(daily_tasks))
    form_dates = sorted(daily_form_counts)

    overview = AnalyticsOverview(
        total_users=total_users,
        active_users=active_users,
        total_requests=all_time_requests,
        requests_in_range=len(submissions_in_range),
        requests_today=requests_today,
        active_admin_devices=active_admin_devices,
        attendance_minutes=total_attendance,
        task_minutes=total_task_minutes,
        untracked_minutes=max(total_attendance - total_task_minutes, 0),
        efficiency_percent=(
            round(total_task_minutes / total_attendance * 100, 2)
            if total_attendance
            else 0.0
        ),
        task_count=sum(employee_task_count.values()),
        active_employees=len(active_employee_ids),
        open_check_ins=open_check_ins,
        project_count=len(project_rows),
        department_count=len(department_rows),
    )

    forms = FormsAnalytics(
        by_status=chart_from_counts(status_counts),
        by_org_department=chart_from_counts(org_dept_forms),
        by_portal_department=chart_from_counts(portal_dept_forms),
        by_form=chart_from_counts(form_type_counts, limit=12),
        daily_trend=[
            DailyFormPoint(date=day, count=daily_form_counts[day]) for day in form_dates
        ],
        monthly_trend=monthly_items,
        top_submitters=chart_from_counts(submitter_counts, limit=10),
        recent_requests=[
            DashboardRecentRequest(
                id=submission.id,
                subject=submission.subject,
                status=submission.status,
                form_id=submission.form_id,
                submitted_by=(
                    (user.display_name or user.username) if user else "کاربر حذف‌شده"
                ),
                created_at=submission.created_at,
            )
            for submission, user in recent_rows
        ],
    )

    return AnalyticsResponse(
        start_date=start,
        end_date=end,
        overview=overview,
        forms=forms,
        employees=employees,
        projects=project_rows,
        departments=department_rows,
        timesheet_daily_trend=[
            DailyTimesheetPoint(
                date=day,
                attendance_minutes=daily_attendance[day],
                task_minutes=daily_tasks[day],
            )
            for day in timesheet_dates
        ],
    )
