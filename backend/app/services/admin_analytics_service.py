"""Aggregated admin analytics for forms and timesheet data."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import DefaultDict, Literal

from sqlalchemy.orm import Session

from app.core.jalali import (
    gregorian_to_jalali,
    jalali_range_to_datetimes,
    jalali_to_gregorian,
    jalali_today,
    normalize_digits,
)
from app.core.timezone import (
    tehran_date_bounds_to_utc_naive,
    tehran_now,
    tehran_today,
    utc_naive_to_tehran,
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
    AnalyticsFilterEmployee,
    AnalyticsFilterForm,
    AnalyticsFilterOptions,
    AnalyticsFilterProject,
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

ProjectStatusFilter = Literal["active", "inactive"]


def _local_now_time() -> str:
    return tehran_now().strftime("%H:%M")


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


def _user_matches_department(user: User | None, department: str | None) -> bool:
    if not department:
        return True
    return _org_department(user) == department.strip()


def _user_matches_employee(user: User | None, employee_id: str | None) -> bool:
    if not employee_id:
        return True
    if not user:
        return False
    return str(user.id) == str(employee_id).strip()


def build_analytics(
    db: Session,
    *,
    admin: User,
    start_date: str,
    end_date: str,
    department: str | None = None,
    employee_id: str | None = None,
    project_code: str | None = None,
    project_status: ProjectStatusFilter | None = None,
    form_id: str | None = None,
) -> AnalyticsResponse:
    start = normalize_digits(start_date)
    end = normalize_digits(end_date)
    if start > end:
        raise ValueError("تاریخ شروع باید قبل از تاریخ پایان باشد.")

    department_filter = (department or "").strip() or None
    employee_filter = (employee_id or "").strip() or None
    project_filter = (project_code or "").strip() or None
    form_filter = (form_id or "").strip() or None
    if project_status not in (None, "active", "inactive"):
        raise ValueError("وضعیت پروژه نامعتبر است.")

    form_start, form_end = jalali_range_to_datetimes(start, end)
    today = tehran_today()
    today_start, today_end = tehran_date_bounds_to_utc_naive(today, today)
    today_jalali = jalali_today()
    now_time = _local_now_time()

    all_users = (
        db.query(User)
        .filter(User.is_admin.is_(False))
        .order_by(User.display_name, User.username)
        .all()
    )
    project_models = db.query(TimesheetProject).order_by(TimesheetProject.code).all()
    project_active_map = {item.code: bool(item.is_active) for item in project_models}
    projects = {item.code: item.title or item.code for item in project_models}
    subprojects = {
        item.code: item for item in db.query(TimesheetSubproject).all()
    }

    filter_options = AnalyticsFilterOptions(
        departments=sorted({_org_department(user) for user in all_users}),
        employees=[
            AnalyticsFilterEmployee(
                employee_id=str(user.id),
                full_name=user.display_name or user.username,
                department=_org_department(user),
            )
            for user in all_users
        ],
        projects=[
            AnalyticsFilterProject(
                code=item.code,
                title=item.title or item.code,
                is_active=bool(item.is_active),
            )
            for item in project_models
        ],
        forms=[
            AnalyticsFilterForm(id=template.id, title=template.title)
            for template in sorted(FORM_TEMPLATES.values(), key=lambda item: item.title)
        ],
    )

    users = [
        user
        for user in all_users
        if _user_matches_department(user, department_filter)
        and _user_matches_employee(user, employee_filter)
    ]
    allowed_user_ids = {user.id for user in users}
    total_users = len(users)
    active_users = sum(1 for user in users if user.is_active)

    def project_allowed(code: str) -> bool:
        if project_filter and code != project_filter:
            return False
        if project_status is None:
            return True
        is_active = project_active_map.get(code, True)
        return is_active if project_status == "active" else not is_active

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
    attendance_rows = [
        (attendance, user)
        for attendance, user in attendance_rows
        if user.id in allowed_user_ids
    ]

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
    task_rows = [
        (task, user)
        for task, user in task_rows
        if user.id in allowed_user_ids and project_allowed(task.project_code)
    ]

    submissions_in_range = (
        db.query(Submission, User)
        .outerjoin(User, User.id == Submission.user_id)
        .filter(
            Submission.created_at >= form_start,
            Submission.created_at < form_end,
        )
        .all()
    )
    submissions_in_range = [
        (submission, user)
        for submission, user in submissions_in_range
        if _user_matches_department(user, department_filter)
        and _user_matches_employee(user, employee_filter)
        and (not form_filter or submission.form_id == form_filter)
    ]

    def _submission_matches(submission: Submission, user: User | None) -> bool:
        return (
            _user_matches_department(user, department_filter)
            and _user_matches_employee(user, employee_filter)
            and (not form_filter or submission.form_id == form_filter)
        )

    if department_filter or employee_filter or form_filter:
        all_time_requests = sum(
            1
            for submission, user in (
                db.query(Submission, User)
                .outerjoin(User, User.id == Submission.user_id)
                .all()
            )
            if _submission_matches(submission, user)
        )
        requests_today = sum(
            1
            for submission, user in (
                db.query(Submission, User)
                .outerjoin(User, User.id == Submission.user_id)
                .filter(
                    Submission.created_at >= today_start,
                    Submission.created_at < today_end,
                )
                .all()
            )
            if _submission_matches(submission, user)
        )
    else:
        all_time_requests = db.query(Submission).count()
        requests_today = (
            db.query(Submission)
            .filter(
                Submission.created_at >= today_start,
                Submission.created_at < today_end,
            )
            .count()
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

    # When filtering by project, attendance is only meaningful for people who
    # worked that project; still count their full attendance in-range.
    project_scoped_user_ids: set[int] | None = None
    if project_filter or project_status is not None:
        project_scoped_user_ids = {user.id for _, user in task_rows}

    for attendance, user in attendance_rows:
        if project_scoped_user_ids is not None and user.id not in project_scoped_user_ids:
            continue
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

    directory_users = users
    if project_scoped_user_ids is not None and (project_filter or project_status is not None):
        # Keep employees who have form activity under form/person/unit filters even
        # when a project filter excludes their timesheet work.
        form_user_ids = {user.id for user in users if employee_form_count[user.id]}
        visible_ids = project_scoped_user_ids | form_user_ids
        if project_filter or project_status is not None:
            if not form_filter and not department_filter and not employee_filter:
                directory_users = [user for user in users if user.id in project_scoped_user_ids]
            else:
                directory_users = [user for user in users if user.id in visible_ids]

    employees: list[EmployeeAnalyticsRow] = []
    for user in directory_users:
        attendance = employee_attendance[user.id]
        tracked = employee_task_minutes[user.id]
        form_count = employee_form_count[user.id]
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

    project_codes = set(project_minutes.keys())
    if project_filter and project_filter not in project_codes and project_allowed(project_filter):
        project_codes.add(project_filter)
    if project_status is not None:
        project_codes = {code for code in project_codes if project_allowed(code)}
    elif project_filter:
        project_codes = {code for code in project_codes if code == project_filter}

    project_rows = [
        ProjectAnalyticsRow(
            code=code,
            title=projects.get(code, code),
            minutes=project_minutes[code],
            task_count=project_tasks[code],
            employee_count=len(project_employees[code]),
            is_active=project_active_map.get(code, True),
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
        for code in project_codes
        if project_minutes[code] or (project_filter and code == project_filter)
    ]
    project_rows.sort(key=lambda row: row.minutes, reverse=True)

    dept_attendance: DefaultDict[str, int] = defaultdict(int)
    dept_task_minutes: DefaultDict[str, int] = defaultdict(int)
    dept_task_count: DefaultDict[str, int] = defaultdict(int)
    dept_forms: DefaultDict[str, int] = defaultdict(int)
    dept_employees: DefaultDict[str, set[int]] = defaultdict(set)
    dept_active: DefaultDict[str, set[int]] = defaultdict(set)

    for user in directory_users:
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
        if user and user.id in {u.id for u in directory_users}:
            dept_employees[name].add(user.id)
        elif user and not (project_filter or project_status is not None):
            dept_employees[name].add(user.id)

    department_names = set(dept_employees) | set(dept_forms)
    if department_filter:
        department_names = {name for name in department_names if name == department_filter}
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
        daily_form_counts[gregorian_to_jalali(utc_naive_to_tehran(submission.created_at).date())] += 1

    jalali_year, jalali_month, _ = (
        int(part) for part in jalali_today().split("/")
    )
    current_month_index = jalali_year * 12 + jalali_month - 1
    month_starts: list[tuple[str, datetime]] = []
    for month_offset in range(-5, 2):
        month_index = current_month_index + month_offset
        month_year, zero_based_month = divmod(month_index, 12)
        month_label = f"{month_year:04d}/{zero_based_month + 1:02d}"
        month_start_date = jalali_to_gregorian(f"{month_label}/01")
        month_start, _ = tehran_date_bounds_to_utc_naive(
            month_start_date,
            month_start_date,
        )
        month_starts.append((month_label, month_start))

    monthly_items: list[ChartItem] = []
    for index, (label, month_begin) in enumerate(month_starts[:-1]):
        month_end = month_starts[index + 1][1]
        month_rows = (
            db.query(Submission, User)
            .outerjoin(User, User.id == Submission.user_id)
            .filter(
                Submission.created_at >= month_begin,
                Submission.created_at < month_end,
            )
            .all()
        )
        count = sum(
            1
            for submission, user in month_rows
            if _user_matches_department(user, department_filter)
            and _user_matches_employee(user, employee_filter)
            and (not form_filter or submission.form_id == form_filter)
        )
        monthly_items.append(ChartItem(label=label, value=count))

    recent_query = (
        db.query(Submission, User)
        .outerjoin(User, User.id == Submission.user_id)
        .order_by(Submission.created_at.desc())
    )
    recent_rows = [
        (submission, user)
        for submission, user in recent_query.limit(200).all()
        if _user_matches_department(user, department_filter)
        and _user_matches_employee(user, employee_filter)
        and (not form_filter or submission.form_id == form_filter)
    ][:12]

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
        filter_options=filter_options,
    )
