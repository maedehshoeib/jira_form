from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.timesheet import (
    TimesheetAttendance,
    TimesheetProject,
    TimesheetTask,
)
from app.models.user import User
from app.schemas.timesheet import (
    CheckInPayload,
    CheckOutPayload,
    ProjectPayload,
    TaskPayload,
    normalize_digits,
)

router = APIRouter()


def _minutes(value: str) -> int:
    hour, minute = (int(part) for part in value.split(":"))
    return hour * 60 + minute


def _duration(start: str, end: str) -> int:
    duration = _minutes(end) - _minutes(start)
    if duration <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="زمان پایان باید بعد از زمان شروع باشد.",
        )
    return duration


def _serialize_attendance(item: TimesheetAttendance) -> dict:
    return {
        "id": item.id,
        "work_date": item.work_date,
        "check_in_time": item.check_in_time,
        "check_out_time": item.check_out_time,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _serialize_task(item: TimesheetTask) -> dict:
    return {
        "id": item.id,
        "work_date": item.work_date,
        "project_code": item.project_code,
        "task_name": item.task_name,
        "start_time": item.start_time,
        "end_time": item.end_time,
        "minutes_spent": item.minutes_spent,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def _require_timesheet_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin or user.username.casefold() != "Vosouq.admin".casefold():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="پنل مدیریت تایم شیت فقط در دسترس Vosouq.admin است.",
        )
    return user


def _day_summary(db: Session, user_id: int, work_date: str) -> dict:
    attendance = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user_id,
            TimesheetAttendance.work_date == work_date,
        )
        .order_by(TimesheetAttendance.check_in_time, TimesheetAttendance.id)
        .all()
    )
    tasks = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == user_id,
            TimesheetTask.work_date == work_date,
        )
        .all()
    )
    now_time = datetime.now().strftime("%H:%M")
    attendance_minutes = 0
    for item in attendance:
        end = item.check_out_time or now_time
        if _minutes(end) > _minutes(item.check_in_time):
            attendance_minutes += _minutes(end) - _minutes(item.check_in_time)
    task_minutes = sum(item.minutes_spent for item in tasks)
    return {
        "employee_id": str(user_id),
        "work_date": work_date,
        "check_in_time": attendance[0].check_in_time if attendance else None,
        "check_out_time": attendance[-1].check_out_time if attendance else None,
        "is_currently_checked_in": bool(
            attendance and attendance[-1].check_out_time is None
        ),
        "attendance_minutes": attendance_minutes,
        "task_minutes": task_minutes,
        "untracked_minutes": max(attendance_minutes - task_minutes, 0),
        "efficiency_percent": (
            round(task_minutes / attendance_minutes * 100, 2)
            if attendance_minutes
            else 0
        ),
    }


@router.get("/projects")
def list_projects(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(TimesheetProject)
        .filter(TimesheetProject.is_active.is_(True))
        .order_by(TimesheetProject.code)
        .all()
    )
    return {
        "projects": [
            {"code": item.code, "title": item.title or item.code}
            for item in projects
        ]
    }


@router.post("/attendance/check-in")
def check_in(
    payload: CheckInPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user.id,
            TimesheetAttendance.check_out_time.is_(None),
        )
        .first()
    )
    if active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="یک ورود باز دارید؛ ابتدا خروج را ثبت کنید.",
        )
    db.add(
        TimesheetAttendance(
            user_id=user.id,
            work_date=payload.work_date,
            check_in_time=payload.check_in_time,
        )
    )
    db.commit()
    return {"message": "ورود با موفقیت ثبت شد."}


@router.post("/attendance/check-out")
def check_out(
    payload: CheckOutPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user.id,
            TimesheetAttendance.work_date == payload.work_date,
            TimesheetAttendance.check_out_time.is_(None),
        )
        .order_by(TimesheetAttendance.id.desc())
        .first()
    )
    if not active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ورود بازی برای این روز پیدا نشد.",
        )
    _duration(active.check_in_time, payload.check_out_time)
    active.check_out_time = payload.check_out_time
    active.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "خروج با موفقیت ثبت شد."}


@router.post("/tasks")
def add_task(
    payload: TaskPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    duration = _duration(payload.start_time, payload.end_time)
    project = db.get(TimesheetProject, payload.project_code)
    if not project or not project.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="پروژه انتخاب‌شده معتبر یا فعال نیست.",
        )

    start, end = _minutes(payload.start_time), _minutes(payload.end_time)
    overlap = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == user.id,
            TimesheetTask.work_date == payload.work_date,
        )
        .all()
    )
    if any(
        max(start, _minutes(item.start_time)) < min(end, _minutes(item.end_time))
        for item in overlap
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="بازه این فعالیت با فعالیت ثبت‌شده دیگری هم‌پوشانی دارد.",
        )

    attendance = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user.id,
            TimesheetAttendance.work_date == payload.work_date,
        )
        .all()
    )
    now = _minutes(datetime.now().strftime("%H:%M"))
    inside_attendance = any(
        start >= _minutes(item.check_in_time)
        and end <= (_minutes(item.check_out_time) if item.check_out_time else now)
        for item in attendance
    )
    if not inside_attendance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="زمان فعالیت باید داخل یکی از بازه‌های حضور باشد.",
        )

    item = TimesheetTask(
        user_id=user.id,
        work_date=payload.work_date,
        project_code=payload.project_code,
        task_name=payload.task_name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        minutes_spent=duration,
    )
    db.add(item)
    db.commit()
    return {"message": "فعالیت با موفقیت ثبت شد.", "minutes_spent": duration}


@router.get("/me/day/timeline")
def my_timeline(
    work_date: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    date = normalize_digits(work_date)
    attendance = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user.id,
            TimesheetAttendance.work_date == date,
        )
        .order_by(TimesheetAttendance.check_in_time, TimesheetAttendance.id)
        .all()
    )
    tasks = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == user.id,
            TimesheetTask.work_date == date,
        )
        .order_by(TimesheetTask.start_time, TimesheetTask.id)
        .all()
    )
    return {
        "employee_id": str(user.id),
        "work_date": date,
        "attendance": [_serialize_attendance(item) for item in attendance],
        "tasks": [_serialize_task(item) for item in tasks],
    }


@router.get("/me/day/summary")
def my_summary(
    work_date: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _day_summary(db, user.id, normalize_digits(work_date))


@router.get("/admin/day-records")
def admin_day_records(
    work_date: str = Query(...),
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    date = normalize_digits(work_date)
    attendance = (
        db.query(TimesheetAttendance, User)
        .join(User, User.id == TimesheetAttendance.user_id)
        .filter(TimesheetAttendance.work_date == date)
        .order_by(User.display_name, TimesheetAttendance.check_in_time)
        .all()
    )
    tasks = (
        db.query(TimesheetTask, User)
        .join(User, User.id == TimesheetTask.user_id)
        .filter(TimesheetTask.work_date == date)
        .order_by(User.display_name, TimesheetTask.start_time)
        .all()
    )
    return {
        "work_date": date,
        "attendance": [
            {
                **_serialize_attendance(item),
                "employee_id": str(employee.id),
                "username": employee.username,
                "full_name": employee.display_name or employee.username,
            }
            for item, employee in attendance
        ],
        "tasks": [
            {
                **_serialize_task(item),
                "employee_id": str(employee.id),
                "username": employee.username,
                "full_name": employee.display_name or employee.username,
            }
            for item, employee in tasks
        ],
    }


@router.get("/admin/range-records")
def admin_range_records(
    start_date: str = Query(...),
    end_date: str = Query(...),
    employee_id: int | None = Query(default=None),
    department: str | None = Query(default=None),
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    """Return a complete timesheet report for a Jalali date range.

    Dates are stored in normalized YYYY/MM/DD form, so lexical comparisons are
    safe and avoid converting the organization's Jalali reporting dates.
    """
    start = normalize_digits(start_date)
    end = normalize_digits(end_date)
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تاریخ شروع باید قبل از تاریخ پایان باشد.",
        )

    attendance_query = (
        db.query(TimesheetAttendance, User)
        .join(User, User.id == TimesheetAttendance.user_id)
        .filter(
            TimesheetAttendance.work_date >= start,
            TimesheetAttendance.work_date <= end,
        )
    )
    tasks_query = (
        db.query(TimesheetTask, User)
        .join(User, User.id == TimesheetTask.user_id)
        .filter(
            TimesheetTask.work_date >= start,
            TimesheetTask.work_date <= end,
        )
    )

    if employee_id is not None:
        attendance_query = attendance_query.filter(User.id == employee_id)
        tasks_query = tasks_query.filter(User.id == employee_id)
    if department:
        normalized_department = department.strip()
        if normalized_department == "بدون واحد":
            department_filter = or_(User.department == "", User.department.is_(None))
        else:
            department_filter = User.department == normalized_department
        attendance_query = attendance_query.filter(department_filter)
        tasks_query = tasks_query.filter(department_filter)

    attendance = attendance_query.order_by(
        TimesheetAttendance.work_date, User.display_name, TimesheetAttendance.check_in_time
    ).all()
    tasks = tasks_query.order_by(
        TimesheetTask.work_date, User.display_name, TimesheetTask.start_time
    ).all()
    employees = (
        db.query(User)
        .filter(User.is_active.is_(True))
        .order_by(User.display_name, User.username)
        .all()
    )

    def employee_details(employee: User) -> dict:
        return {
            "employee_id": str(employee.id),
            "username": employee.username,
            "full_name": employee.display_name or employee.username,
            "department": employee.department or "بدون واحد",
            "job_title": employee.job_title or "",
        }

    return {
        "start_date": start,
        "end_date": end,
        "employees": [employee_details(employee) for employee in employees],
        "departments": sorted(
            {employee.department or "بدون واحد" for employee in employees}
        ),
        "attendance": [
            {**_serialize_attendance(item), **employee_details(employee)}
            for item, employee in attendance
        ],
        "tasks": [
            {**_serialize_task(item), **employee_details(employee)}
            for item, employee in tasks
        ],
    }


@router.get("/admin/projects")
def admin_projects(
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    projects = db.query(TimesheetProject).order_by(TimesheetProject.code).all()
    return {
        "projects": [
            {
                "code": item.code,
                "title": item.title or item.code,
                "is_active": item.is_active,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in projects
        ]
    }


@router.post("/admin/projects")
def create_project(
    payload: ProjectPayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    if db.get(TimesheetProject, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="این کد پروژه قبلاً ثبت شده است.",
        )
    project = TimesheetProject(code=payload.code, title=payload.title)
    db.add(project)
    db.commit()
    db.refresh(project)
    return {
        "code": project.code,
        "title": project.title or project.code,
        "is_active": project.is_active,
    }


@router.delete("/admin/projects/{project_code}")
def delete_project(
    project_code: str,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    code = normalize_digits(project_code).upper()
    if code == "GENERAL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="پروژه GENERAL قابل حذف نیست.",
        )
    project = db.get(TimesheetProject, code)
    if not project:
        raise HTTPException(status_code=404, detail="پروژه پیدا نشد.")
    general = db.get(TimesheetProject, "GENERAL")
    if not general:
        general = TimesheetProject(code="GENERAL", title="عمومی")
        db.add(general)
        db.flush()
    reassigned = (
        db.query(TimesheetTask)
        .filter(TimesheetTask.project_code == code)
        .update({TimesheetTask.project_code: "GENERAL"})
    )
    db.delete(project)
    db.commit()
    return {
        "message": "پروژه حذف شد.",
        "project_code": code,
        "reassigned_tasks": reassigned,
    }
