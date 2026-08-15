from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.timezone import format_tehran_iso, tehran_now
from app.db.session import get_db
from app.models.timesheet import (
    TimesheetAttendance,
    TimesheetProject,
    TimesheetProjectUser,
    TimesheetSubproject,
    TimesheetSubprojectUser,
    TimesheetTask,
)
from app.models.user import User
from app.schemas.timesheet import (
    AdminAttendancePayload,
    AdminAttendanceUpdatePayload,
    AdminTaskPayload,
    CheckInPayload,
    CheckOutPayload,
    ProjectPayload,
    SubprojectPayload,
    TaskPayload,
    normalize_digits,
)

router = APIRouter()


def _local_now_time() -> str:
    return tehran_now().strftime("%H:%M")


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
        "created_at": format_tehran_iso(item.created_at),
        "updated_at": format_tehran_iso(item.updated_at),
    }


def _serialize_task(item: TimesheetTask) -> dict:
    return {
        "id": item.id,
        "work_date": item.work_date,
        "project_code": item.project_code,
        "subproject_code": item.subproject_code,
        "task_name": item.task_name,
        "start_time": item.start_time,
        "end_time": item.end_time,
        "minutes_spent": item.minutes_spent,
        "created_at": format_tehran_iso(item.created_at),
    }


def _serialize_subproject(
    item: TimesheetSubproject, *, user_ids: list[int] | None = None
) -> dict:
    return {
        "code": item.code,
        "title": item.title or item.code,
        "project_code": item.project_code,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "is_active": item.is_active,
        "user_ids": user_ids if user_ids is not None else [],
        "created_at": format_tehran_iso(item.created_at),
    }


def _serialize_project(
    item: TimesheetProject,
    *,
    user_ids: list[int] | None = None,
    subprojects: list[dict] | None = None,
) -> dict:
    return {
        "code": item.code,
        "title": item.title or item.code,
        "start_date": item.start_date,
        "end_date": item.end_date,
        "is_active": item.is_active,
        "user_ids": user_ids if user_ids is not None else [],
        "subprojects": subprojects if subprojects is not None else [],
        "created_at": format_tehran_iso(item.created_at),
    }


def _date_in_period(work_date: str, start_date: str | None, end_date: str | None) -> bool:
    """Return True when the work date is inside an optional Jalali period."""
    if start_date and work_date < start_date:
        return False
    if end_date and work_date > end_date:
        return False
    return True


def _period_error(label: str, code: str, start_date: str | None, end_date: str | None) -> str:
    if start_date and end_date:
        return (
            f"{label} «{code}» فقط از تاریخ {start_date} تا {end_date} "
            "قابل استفاده است."
        )
    if start_date:
        return f"{label} «{code}» فقط از تاریخ {start_date} به بعد قابل استفاده است."
    if end_date:
        return f"{label} «{code}» فقط تا تاریخ {end_date} قابل استفاده است."
    return f"{label} «{code}» در این تاریخ قابل استفاده نیست."


def _ensure_within_period(
    *,
    label: str,
    code: str,
    work_date: str,
    start_date: str | None,
    end_date: str | None,
) -> None:
    if not start_date and not end_date:
        return
    if not _date_in_period(work_date, start_date, end_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_period_error(label, code, start_date, end_date),
        )


def _project_assignees(db: Session) -> dict[str, list[int]]:
    grouped: dict[str, list[int]] = {}
    for row in db.query(TimesheetProjectUser).all():
        grouped.setdefault(row.project_code, []).append(row.user_id)
    for code, ids in grouped.items():
        grouped[code] = sorted(set(ids))
    return grouped


def _subproject_assignees(db: Session) -> dict[str, list[int]]:
    grouped: dict[str, list[int]] = {}
    for row in db.query(TimesheetSubprojectUser).all():
        grouped.setdefault(row.subproject_code, []).append(row.user_id)
    for code, ids in grouped.items():
        grouped[code] = sorted(set(ids))
    return grouped


def _user_can_access_project(
    *, project_code: str, user_id: int, assignees: dict[str, list[int]]
) -> bool:
    assigned = assignees.get(project_code)
    if not assigned:
        # Unassigned catalog entries stay open (legacy / GENERAL).
        return True
    return user_id in assigned


def _user_can_access_subproject(
    *,
    subproject_code: str,
    user_id: int,
    assignees: dict[str, list[int]],
) -> bool:
    assigned = assignees.get(subproject_code)
    if not assigned:
        return True
    return user_id in assigned


def _resolve_active_users(db: Session, user_ids: list[int]) -> list[User]:
    if not user_ids:
        return []
    users = (
        db.query(User)
        .filter(User.id.in_(user_ids), User.is_active.is_(True), User.is_admin.is_(False))
        .all()
    )
    found = {user.id for user in users}
    missing = [item for item in user_ids if item not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="یک یا چند کاربر انتخاب‌شده معتبر نیست.",
        )
    return users


def _require_assignees(code: str, user_ids: list[int]) -> None:
    if code == "GENERAL":
        return
    if not user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="حداقل یک کاربر باید برای پروژه/زیرپروژه انتخاب شود.",
        )


def _set_project_assignees(db: Session, project_code: str, user_ids: list[int]) -> None:
    db.query(TimesheetProjectUser).filter(
        TimesheetProjectUser.project_code == project_code
    ).delete(synchronize_session=False)
    for user_id in user_ids:
        db.add(TimesheetProjectUser(project_code=project_code, user_id=user_id))


def _set_subproject_assignees(
    db: Session, subproject_code: str, user_ids: list[int]
) -> None:
    db.query(TimesheetSubprojectUser).filter(
        TimesheetSubprojectUser.subproject_code == subproject_code
    ).delete(synchronize_session=False)
    for user_id in user_ids:
        db.add(
            TimesheetSubprojectUser(subproject_code=subproject_code, user_id=user_id)
        )


def _assert_code_available(
    db: Session, code: str, *, ignore_project: str | None = None, ignore_sub: str | None = None
) -> None:
    project = db.get(TimesheetProject, code)
    if project and project.code != ignore_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="این کد پروژه قبلاً ثبت شده است.",
        )
    subproject = db.get(TimesheetSubproject, code)
    if subproject and subproject.code != ignore_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="این کد زیرپروژه قبلاً ثبت شده است.",
        )


def _ensure_subproject_within_project(
    project: TimesheetProject, payload: SubprojectPayload
) -> None:
    if project.start_date and payload.start_date < project.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تاریخ شروع زیرپروژه نمی‌تواند قبل از تاریخ شروع پروژه باشد.",
        )
    if project.end_date and payload.end_date > project.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تاریخ پایان زیرپروژه نمی‌تواند بعد از تاریخ پایان پروژه باشد.",
        )


def _subprojects_by_project(
    db: Session,
    *,
    active_only: bool = False,
    user_id: int | None = None,
) -> dict[str, list[dict]]:
    query = db.query(TimesheetSubproject).order_by(
        TimesheetSubproject.project_code, TimesheetSubproject.code
    )
    if active_only:
        query = query.filter(TimesheetSubproject.is_active.is_(True))
    sub_assignees = _subproject_assignees(db)
    grouped: dict[str, list[dict]] = {}
    for item in query.all():
        if user_id is not None and not _user_can_access_subproject(
            subproject_code=item.code,
            user_id=user_id,
            assignees=sub_assignees,
        ):
            continue
        grouped.setdefault(item.project_code, []).append(
            _serialize_subproject(item, user_ids=sub_assignees.get(item.code, []))
        )
    return grouped


def _require_timesheet_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="پنل مدیریت تایم شیت فقط برای مدیران سامانه در دسترس است.",
        )
    return user


def _get_employee(db: Session, employee_id: int, *, require_active: bool = True) -> User:
    employee = db.get(User, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کارمند پیدا نشد.",
        )
    if require_active and not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کارمند غیرفعال است.",
        )
    return employee


def _segments_overlap(
    start_a: str, end_a: str | None, start_b: str, end_b: str | None
) -> bool:
    """Return True when two attendance segments overlap on the same day.

    Open segments (no check-out) are treated as extending to end-of-day for
    conflict detection so admins cannot stack multiple open entries.
    """
    end_of_day = 24 * 60
    a_start, a_end = _minutes(start_a), _minutes(end_a) if end_a else end_of_day
    b_start, b_end = _minutes(start_b), _minutes(end_b) if end_b else end_of_day
    return max(a_start, b_start) < min(a_end, b_end)


def _assert_attendance_fits_tasks(
    db: Session,
    *,
    user_id: int,
    work_date: str,
    check_in_time: str,
    check_out_time: str | None,
    ignore_attendance_id: int | None = None,
) -> None:
    """Reject attendance edits that would leave existing tasks outside presence."""
    tasks = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == user_id,
            TimesheetTask.work_date == work_date,
        )
        .all()
    )
    if not tasks:
        return

    attendance = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user_id,
            TimesheetAttendance.work_date == work_date,
        )
        .all()
    )
    now = _minutes(_local_now_time())
    segments: list[tuple[int, int]] = []
    for item in attendance:
        if ignore_attendance_id is not None and item.id == ignore_attendance_id:
            continue
        end = _minutes(item.check_out_time) if item.check_out_time else now
        segments.append((_minutes(item.check_in_time), end))
    edited_end = _minutes(check_out_time) if check_out_time else now
    segments.append((_minutes(check_in_time), edited_end))

    for task in tasks:
        start, end = _minutes(task.start_time), _minutes(task.end_time)
        if not any(start >= seg_start and end <= seg_end for seg_start, seg_end in segments):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "این تغییر حضور باعث می‌شود فعالیت‌های ثبت‌شده "
                    "خارج از بازه حضور قرار گیرند."
                ),
            )


def _assert_no_attendance_overlap(
    db: Session,
    *,
    user_id: int,
    work_date: str,
    check_in_time: str,
    check_out_time: str | None,
    ignore_id: int | None = None,
) -> None:
    existing = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user_id,
            TimesheetAttendance.work_date == work_date,
        )
        .all()
    )
    for item in existing:
        if ignore_id is not None and item.id == ignore_id:
            continue
        if _segments_overlap(
            check_in_time, check_out_time, item.check_in_time, item.check_out_time
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="بازه حضور با تردد ثبت‌شده دیگری هم‌پوشانی دارد.",
            )


def _assert_single_open_attendance(
    db: Session,
    *,
    user_id: int,
    check_out_time: str | None,
    ignore_id: int | None = None,
) -> None:
    if check_out_time is not None:
        return
    active = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user_id,
            TimesheetAttendance.check_out_time.is_(None),
        )
        .all()
    )
    if any(item.id != ignore_id for item in active):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="این کارمند یک ورود باز دارد؛ ابتدا خروج را ثبت کنید.",
        )


def _resolve_task_codes(
    db: Session,
    *,
    user_id: int,
    work_date: str,
    project_code: str,
    subproject_code: str | None,
    enforce_assignees: bool,
) -> tuple[TimesheetProject, str | None]:
    project = db.get(TimesheetProject, project_code)
    if not project or not project.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="پروژه انتخاب‌شده معتبر یا فعال نیست.",
        )
    if enforce_assignees:
        project_assignees = _project_assignees(db)
        if not _user_can_access_project(
            project_code=project.code,
            user_id=user_id,
            assignees=project_assignees,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="شما به این پروژه دسترسی ندارید.",
            )
    _ensure_within_period(
        label="پروژه",
        code=project.code,
        work_date=work_date,
        start_date=project.start_date,
        end_date=project.end_date,
    )

    resolved_sub = subproject_code
    if resolved_sub:
        subproject = db.get(TimesheetSubproject, resolved_sub)
        if (
            not subproject
            or not subproject.is_active
            or subproject.project_code != project_code
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="زیرپروژه انتخاب‌شده معتبر یا متعلق به این پروژه نیست.",
            )
        if enforce_assignees:
            sub_assignees = _subproject_assignees(db)
            if not _user_can_access_subproject(
                subproject_code=subproject.code,
                user_id=user_id,
                assignees=sub_assignees,
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="شما به این زیرپروژه دسترسی ندارید.",
                )
        _ensure_within_period(
            label="زیرپروژه",
            code=subproject.code,
            work_date=work_date,
            start_date=subproject.start_date,
            end_date=subproject.end_date,
        )
    else:
        resolved_sub = None
    return project, resolved_sub


def _assert_task_window(
    db: Session,
    *,
    user_id: int,
    work_date: str,
    start_time: str,
    end_time: str,
    ignore_task_id: int | None = None,
) -> int:
    duration = _duration(start_time, end_time)
    start, end = _minutes(start_time), _minutes(end_time)
    overlap = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == user_id,
            TimesheetTask.work_date == work_date,
        )
        .all()
    )
    if any(
        item.id != ignore_task_id
        and max(start, _minutes(item.start_time)) < min(end, _minutes(item.end_time))
        for item in overlap
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="بازه این فعالیت با فعالیت ثبت‌شده دیگری هم‌پوشانی دارد.",
        )

    attendance = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user_id,
            TimesheetAttendance.work_date == work_date,
        )
        .all()
    )
    now = _minutes(_local_now_time())
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
    return duration


def _create_task_for_user(
    db: Session,
    *,
    user_id: int,
    payload: TaskPayload,
    enforce_assignees: bool,
) -> dict:
    project, subproject_code = _resolve_task_codes(
        db,
        user_id=user_id,
        work_date=payload.work_date,
        project_code=payload.project_code,
        subproject_code=payload.subproject_code,
        enforce_assignees=enforce_assignees,
    )
    duration = _assert_task_window(
        db,
        user_id=user_id,
        work_date=payload.work_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    item = TimesheetTask(
        user_id=user_id,
        work_date=payload.work_date,
        project_code=project.code,
        subproject_code=subproject_code,
        task_name=payload.task_name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        minutes_spent=duration,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "message": "فعالیت با موفقیت ثبت شد.",
        "minutes_spent": duration,
        "task": _serialize_task(item),
    }


def _open_attendance(db: Session, user_id: int) -> TimesheetAttendance | None:
    """Return the user's latest open attendance, regardless of work date."""
    return (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user_id,
            TimesheetAttendance.check_out_time.is_(None),
        )
        .order_by(TimesheetAttendance.id.desc())
        .first()
    )


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
    active_attendance = _open_attendance(db, user_id)
    tasks = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == user_id,
            TimesheetTask.work_date == work_date,
        )
        .all()
    )
    now_time = _local_now_time()
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
        "is_currently_checked_in": active_attendance is not None,
        "active_work_date": active_attendance.work_date if active_attendance else None,
        "active_check_in_time": (
            active_attendance.check_in_time if active_attendance else None
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(TimesheetProject)
        .filter(TimesheetProject.is_active.is_(True))
        .order_by(TimesheetProject.code)
        .all()
    )
    project_assignees = _project_assignees(db)
    subprojects = _subprojects_by_project(db, active_only=True, user_id=user.id)
    visible = []
    for item in projects:
        if not _user_can_access_project(
            project_code=item.code,
            user_id=user.id,
            assignees=project_assignees,
        ):
            continue
        visible.append(
            _serialize_project(
                item,
                user_ids=project_assignees.get(item.code, []),
                subprojects=subprojects.get(item.code, []),
            )
        )
    return {"projects": visible}


@router.post("/attendance/check-in")
def check_in(
    payload: CheckInPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active = _open_attendance(db, user.id)
    if active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="یک ورود باز دارید؛ ابتدا خروج را ثبت کنید.",
        )
    item = TimesheetAttendance(
        user_id=user.id,
        work_date=payload.work_date,
        check_in_time=payload.check_in_time,
    )
    db.add(item)
    db.commit()
    return {
        "message": "ورود با موفقیت ثبت شد.",
        "attendance": _serialize_attendance(item),
        "summary": _day_summary(db, user.id, payload.work_date),
    }


@router.post("/attendance/check-out")
def check_out(
    payload: CheckOutPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active = _open_attendance(db, user.id)
    if not active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ورود بازی برای شما پیدا نشد.",
        )
    _duration(active.check_in_time, payload.check_out_time)
    active.check_out_time = payload.check_out_time
    active.updated_at = datetime.utcnow()
    db.commit()
    return {
        "message": "خروج با موفقیت ثبت شد.",
        "attendance": _serialize_attendance(active),
        "summary": _day_summary(db, user.id, payload.work_date),
    }


@router.post("/tasks")
def add_task(
    payload: TaskPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_task_for_user(
        db,
        user_id=user.id,
        payload=payload,
        enforce_assignees=True,
    )


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


@router.get("/me/range-records")
def my_range_records(
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's attendance and tasks for one Jalali range."""
    start = normalize_digits(start_date)
    end = normalize_digits(end_date)
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تاریخ پایان باید بعد از تاریخ شروع باشد.",
        )

    attendance = (
        db.query(TimesheetAttendance)
        .filter(
            TimesheetAttendance.user_id == user.id,
            TimesheetAttendance.work_date >= start,
            TimesheetAttendance.work_date <= end,
        )
        .order_by(
            TimesheetAttendance.work_date,
            TimesheetAttendance.check_in_time,
            TimesheetAttendance.id,
        )
        .all()
    )
    tasks = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == user.id,
            TimesheetTask.work_date >= start,
            TimesheetTask.work_date <= end,
        )
        .order_by(
            TimesheetTask.work_date,
            TimesheetTask.start_time,
            TimesheetTask.id,
        )
        .all()
    )
    return {
        "employee_id": str(user.id),
        "start_date": start,
        "end_date": end,
        "attendance": [_serialize_attendance(item) for item in attendance],
        "tasks": [_serialize_task(item) for item in tasks],
    }


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


@router.post("/admin/attendance")
def admin_create_attendance(
    payload: AdminAttendancePayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    employee = _get_employee(db, payload.employee_id)
    if payload.check_out_time:
        _duration(payload.check_in_time, payload.check_out_time)
    _assert_single_open_attendance(
        db,
        user_id=employee.id,
        check_out_time=payload.check_out_time,
    )
    _assert_no_attendance_overlap(
        db,
        user_id=employee.id,
        work_date=payload.work_date,
        check_in_time=payload.check_in_time,
        check_out_time=payload.check_out_time,
    )
    item = TimesheetAttendance(
        user_id=employee.id,
        work_date=payload.work_date,
        check_in_time=payload.check_in_time,
        check_out_time=payload.check_out_time,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "message": "تردد با موفقیت ثبت شد.",
        "attendance": {
            **_serialize_attendance(item),
            "employee_id": str(employee.id),
            "username": employee.username,
            "full_name": employee.display_name or employee.username,
            "department": employee.department or "بدون واحد",
            "job_title": employee.job_title or "",
        },
    }


@router.put("/admin/attendance/{attendance_id}")
def admin_update_attendance(
    attendance_id: int,
    payload: AdminAttendanceUpdatePayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    item = db.get(TimesheetAttendance, attendance_id)
    if not item:
        raise HTTPException(status_code=404, detail="تردد پیدا نشد.")
    employee = _get_employee(db, item.user_id, require_active=False)
    if payload.check_out_time:
        _duration(payload.check_in_time, payload.check_out_time)
    _assert_single_open_attendance(
        db,
        user_id=employee.id,
        check_out_time=payload.check_out_time,
        ignore_id=item.id,
    )
    _assert_no_attendance_overlap(
        db,
        user_id=employee.id,
        work_date=payload.work_date,
        check_in_time=payload.check_in_time,
        check_out_time=payload.check_out_time,
        ignore_id=item.id,
    )
    _assert_attendance_fits_tasks(
        db,
        user_id=employee.id,
        work_date=payload.work_date,
        check_in_time=payload.check_in_time,
        check_out_time=payload.check_out_time,
        ignore_attendance_id=item.id,
    )
    # If the work date changes, also ensure tasks on the old date remain covered
    # by remaining attendance (or that there are no orphaned tasks).
    if payload.work_date != item.work_date:
        remaining = (
            db.query(TimesheetAttendance)
            .filter(
                TimesheetAttendance.user_id == employee.id,
                TimesheetAttendance.work_date == item.work_date,
                TimesheetAttendance.id != item.id,
            )
            .all()
        )
        old_tasks = (
            db.query(TimesheetTask)
            .filter(
                TimesheetTask.user_id == employee.id,
                TimesheetTask.work_date == item.work_date,
            )
            .all()
        )
        if old_tasks:
            now = _minutes(_local_now_time())
            segments = [
                (
                    _minutes(row.check_in_time),
                    _minutes(row.check_out_time) if row.check_out_time else now,
                )
                for row in remaining
            ]
            for task in old_tasks:
                start, end = _minutes(task.start_time), _minutes(task.end_time)
                if not any(
                    start >= seg_start and end <= seg_end
                    for seg_start, seg_end in segments
                ):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            "تغییر تاریخ این تردد باعث می‌شود فعالیت‌های "
                            "روز قبلی بدون پوشش حضور بمانند."
                        ),
                    )

    item.work_date = payload.work_date
    item.check_in_time = payload.check_in_time
    item.check_out_time = payload.check_out_time
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return {
        "message": "تردد با موفقیت ویرایش شد.",
        "attendance": {
            **_serialize_attendance(item),
            "employee_id": str(employee.id),
            "username": employee.username,
            "full_name": employee.display_name or employee.username,
            "department": employee.department or "بدون واحد",
            "job_title": employee.job_title or "",
        },
    }


@router.delete("/admin/attendance/{attendance_id}")
def admin_delete_attendance(
    attendance_id: int,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    item = db.get(TimesheetAttendance, attendance_id)
    if not item:
        raise HTTPException(status_code=404, detail="تردد پیدا نشد.")
    tasks = (
        db.query(TimesheetTask)
        .filter(
            TimesheetTask.user_id == item.user_id,
            TimesheetTask.work_date == item.work_date,
        )
        .all()
    )
    if tasks:
        remaining = (
            db.query(TimesheetAttendance)
            .filter(
                TimesheetAttendance.user_id == item.user_id,
                TimesheetAttendance.work_date == item.work_date,
                TimesheetAttendance.id != item.id,
            )
            .all()
        )
        now = _minutes(_local_now_time())
        segments = [
            (
                _minutes(row.check_in_time),
                _minutes(row.check_out_time) if row.check_out_time else now,
            )
            for row in remaining
        ]
        for task in tasks:
            start, end = _minutes(task.start_time), _minutes(task.end_time)
            if not any(
                start >= seg_start and end <= seg_end for seg_start, seg_end in segments
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "این تردد قابل حذف نیست؛ ابتدا فعالیت‌هایی که داخل "
                        "این بازه هستند را ویرایش یا حذف کنید."
                    ),
                )
    db.delete(item)
    db.commit()
    return {"message": "تردد حذف شد.", "attendance_id": attendance_id}


@router.post("/admin/tasks")
def admin_create_task(
    payload: AdminTaskPayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    employee = _get_employee(db, payload.employee_id)
    return _create_task_for_user(
        db,
        user_id=employee.id,
        payload=payload,
        enforce_assignees=False,
    )


@router.put("/admin/tasks/{task_id}")
def admin_update_task(
    task_id: int,
    payload: TaskPayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    item = db.get(TimesheetTask, task_id)
    if not item:
        raise HTTPException(status_code=404, detail="فعالیت پیدا نشد.")
    employee = _get_employee(db, item.user_id, require_active=False)
    project, subproject_code = _resolve_task_codes(
        db,
        user_id=employee.id,
        work_date=payload.work_date,
        project_code=payload.project_code,
        subproject_code=payload.subproject_code,
        enforce_assignees=False,
    )
    duration = _assert_task_window(
        db,
        user_id=employee.id,
        work_date=payload.work_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        ignore_task_id=item.id,
    )
    item.work_date = payload.work_date
    item.project_code = project.code
    item.subproject_code = subproject_code
    item.task_name = payload.task_name
    item.start_time = payload.start_time
    item.end_time = payload.end_time
    item.minutes_spent = duration
    db.commit()
    db.refresh(item)
    return {
        "message": "فعالیت با موفقیت ویرایش شد.",
        "minutes_spent": duration,
        "task": _serialize_task(item),
    }


@router.delete("/admin/tasks/{task_id}")
def admin_delete_task(
    task_id: int,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    item = db.get(TimesheetTask, task_id)
    if not item:
        raise HTTPException(status_code=404, detail="فعالیت پیدا نشد.")
    db.delete(item)
    db.commit()
    return {"message": "فعالیت حذف شد.", "task_id": task_id}


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
    project_assignees = _project_assignees(db)
    subprojects = _subprojects_by_project(db)
    return {
        "projects": [
            _serialize_project(
                item,
                user_ids=project_assignees.get(item.code, []),
                subprojects=subprojects.get(item.code, []),
            )
            for item in projects
        ]
    }


@router.post("/admin/projects")
def create_project(
    payload: ProjectPayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    _assert_code_available(db, payload.code)
    _require_assignees(payload.code, payload.user_ids)
    users = _resolve_active_users(db, payload.user_ids)
    project = TimesheetProject(
        code=payload.code,
        title=payload.title,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(project)
    db.flush()
    _set_project_assignees(db, project.code, [user.id for user in users])
    db.commit()
    db.refresh(project)
    return _serialize_project(
        project,
        user_ids=[user.id for user in users],
        subprojects=[],
    )


@router.put("/admin/projects/{project_code}")
def update_project(
    project_code: str,
    payload: ProjectPayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    old_code = normalize_digits(project_code).upper()
    project = db.get(TimesheetProject, old_code)
    if not project:
        raise HTTPException(status_code=404, detail="پروژه پیدا نشد.")
    if old_code == "GENERAL" and payload.code != "GENERAL":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کد پروژه GENERAL قابل تغییر نیست.",
        )
    _assert_code_available(
        db, payload.code, ignore_project=old_code, ignore_sub=None
    )
    _require_assignees(payload.code, payload.user_ids)
    users = _resolve_active_users(db, payload.user_ids)
    user_ids = [user.id for user in users]

    if payload.code != old_code:
        renamed = TimesheetProject(
            code=payload.code,
            title=payload.title,
            start_date=payload.start_date,
            end_date=payload.end_date,
            is_active=project.is_active,
            created_at=project.created_at,
        )
        db.add(renamed)
        db.flush()
        db.query(TimesheetTask).filter(
            TimesheetTask.project_code == old_code
        ).update(
            {TimesheetTask.project_code: payload.code},
            synchronize_session=False,
        )
        db.query(TimesheetSubproject).filter(
            TimesheetSubproject.project_code == old_code
        ).update(
            {TimesheetSubproject.project_code: payload.code},
            synchronize_session=False,
        )
        db.query(TimesheetProjectUser).filter(
            TimesheetProjectUser.project_code == old_code
        ).delete(synchronize_session=False)
        _set_project_assignees(db, payload.code, user_ids)
        db.delete(project)
        project = renamed
    else:
        project.title = payload.title
        project.start_date = payload.start_date
        project.end_date = payload.end_date
        _set_project_assignees(db, project.code, user_ids)

    db.commit()
    db.refresh(project)
    return _serialize_project(
        project,
        user_ids=user_ids,
        subprojects=_subprojects_by_project(db).get(project.code, []),
    )


@router.post("/admin/projects/{project_code}/subprojects")
def create_subproject(
    project_code: str,
    payload: SubprojectPayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    parent_code = normalize_digits(project_code).upper()
    project = db.get(TimesheetProject, parent_code)
    if not project:
        raise HTTPException(status_code=404, detail="پروژه پیدا نشد.")
    _assert_code_available(db, payload.code)
    _require_assignees(payload.code, payload.user_ids)
    _ensure_subproject_within_project(project, payload)
    users = _resolve_active_users(db, payload.user_ids)
    # Subproject assignees must be a subset of parent assignees when parent is restricted.
    parent_assignees = _project_assignees(db).get(parent_code, [])
    if parent_assignees:
        invalid = [user.id for user in users if user.id not in parent_assignees]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="کاربران زیرپروژه باید از میان کاربران اختصاص‌یافته به پروژه انتخاب شوند.",
            )
    subproject = TimesheetSubproject(
        code=payload.code,
        project_code=parent_code,
        title=payload.title,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(subproject)
    db.flush()
    _set_subproject_assignees(db, subproject.code, [user.id for user in users])
    db.commit()
    db.refresh(subproject)
    return _serialize_subproject(subproject, user_ids=[user.id for user in users])


@router.put("/admin/subprojects/{subproject_code}")
def update_subproject(
    subproject_code: str,
    payload: SubprojectPayload,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    old_code = normalize_digits(subproject_code).upper()
    subproject = db.get(TimesheetSubproject, old_code)
    if not subproject:
        raise HTTPException(status_code=404, detail="زیرپروژه پیدا نشد.")
    project = db.get(TimesheetProject, subproject.project_code)
    if not project:
        raise HTTPException(status_code=404, detail="پروژه پیدا نشد.")
    _assert_code_available(db, payload.code, ignore_sub=old_code)
    _require_assignees(payload.code, payload.user_ids)
    _ensure_subproject_within_project(project, payload)
    users = _resolve_active_users(db, payload.user_ids)
    parent_assignees = _project_assignees(db).get(project.code, [])
    if parent_assignees:
        invalid = [user.id for user in users if user.id not in parent_assignees]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="کاربران زیرپروژه باید از میان کاربران اختصاص‌یافته به پروژه انتخاب شوند.",
            )
    user_ids = [user.id for user in users]

    if payload.code != old_code:
        renamed = TimesheetSubproject(
            code=payload.code,
            project_code=subproject.project_code,
            title=payload.title,
            start_date=payload.start_date,
            end_date=payload.end_date,
            is_active=subproject.is_active,
            created_at=subproject.created_at,
        )
        db.add(renamed)
        db.flush()
        db.query(TimesheetTask).filter(
            TimesheetTask.subproject_code == old_code
        ).update(
            {TimesheetTask.subproject_code: payload.code},
            synchronize_session=False,
        )
        db.query(TimesheetSubprojectUser).filter(
            TimesheetSubprojectUser.subproject_code == old_code
        ).delete(synchronize_session=False)
        _set_subproject_assignees(db, payload.code, user_ids)
        db.delete(subproject)
        subproject = renamed
    else:
        subproject.title = payload.title
        subproject.start_date = payload.start_date
        subproject.end_date = payload.end_date
        _set_subproject_assignees(db, subproject.code, user_ids)

    db.commit()
    db.refresh(subproject)
    return _serialize_subproject(subproject, user_ids=user_ids)


@router.delete("/admin/subprojects/{subproject_code}")
def delete_subproject(
    subproject_code: str,
    _: User = Depends(_require_timesheet_admin),
    db: Session = Depends(get_db),
):
    code = normalize_digits(subproject_code).upper()
    subproject = db.get(TimesheetSubproject, code)
    if not subproject:
        raise HTTPException(status_code=404, detail="زیرپروژه پیدا نشد.")
    cleared = (
        db.query(TimesheetTask)
        .filter(TimesheetTask.subproject_code == code)
        .update({TimesheetTask.subproject_code: None})
    )
    db.query(TimesheetSubprojectUser).filter(
        TimesheetSubprojectUser.subproject_code == code
    ).delete(synchronize_session=False)
    db.delete(subproject)
    db.commit()
    return {
        "message": "زیرپروژه حذف شد.",
        "subproject_code": code,
        "cleared_tasks": cleared,
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
    subproject_codes = [
        item.code
        for item in db.query(TimesheetSubproject)
        .filter(TimesheetSubproject.project_code == code)
        .all()
    ]
    if subproject_codes:
        db.query(TimesheetTask).filter(
            TimesheetTask.subproject_code.in_(subproject_codes)
        ).update({TimesheetTask.subproject_code: None}, synchronize_session=False)
        db.query(TimesheetSubprojectUser).filter(
            TimesheetSubprojectUser.subproject_code.in_(subproject_codes)
        ).delete(synchronize_session=False)
        db.query(TimesheetSubproject).filter(
            TimesheetSubproject.project_code == code
        ).delete(synchronize_session=False)
    db.query(TimesheetProjectUser).filter(
        TimesheetProjectUser.project_code == code
    ).delete(synchronize_session=False)
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
