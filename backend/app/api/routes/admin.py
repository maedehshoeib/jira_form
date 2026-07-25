from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import get_db
from app.models.admin_session import AdminSession
from app.models.submission import Submission
from app.models.user import User
from app.schemas.admin import (
    AdminSessionResponse,
    AdminUserCreate,
    AdminUserResponse,
    AdminUserUpdate,
    ChartItem,
    DashboardRecentRequest,
    DashboardResponse,
)

router = APIRouter()


def _normalized_username(value: str) -> str:
    return value.strip().lower()


def _expire_old_admin_sessions(db: Session, user_id: int) -> None:
    expired_before = datetime.utcnow() - timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    expired = (
        db.query(AdminSession)
        .filter(
            AdminSession.user_id == user_id,
            AdminSession.is_active.is_(True),
            AdminSession.logged_in_at < expired_before,
        )
        .all()
    )
    for session in expired:
        session.is_active = False
        session.logged_out_at = datetime.utcnow()
    if expired:
        db.commit()


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    _expire_old_admin_sessions(db, admin.id)
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    status_rows = (
        db.query(Submission.status, func.count(Submission.id))
        .group_by(Submission.status)
        .all()
    )
    department_rows = (
        db.query(Submission.department_id, func.count(Submission.id))
        .group_by(Submission.department_id)
        .order_by(func.count(Submission.id).desc())
        .limit(8)
        .all()
    )

    month_start = today.replace(day=1)
    months: list[tuple[str, datetime, datetime]] = []
    cursor = month_start
    for _ in range(6):
        previous = (cursor - timedelta(days=1)).replace(day=1)
        months.append((cursor.strftime("%Y/%m"), cursor, datetime.max))
        cursor = previous
    months.reverse()
    month_items: list[ChartItem] = []
    for index, (label, start, _) in enumerate(months):
        end = months[index + 1][1] if index + 1 < len(months) else (
            month_start + timedelta(days=32)
        ).replace(day=1)
        count = (
            db.query(Submission)
            .filter(Submission.created_at >= start, Submission.created_at < end)
            .count()
        )
        month_items.append(ChartItem(label=label, value=count))

    recent_rows = (
        db.query(Submission, User)
        .outerjoin(User, User.id == Submission.user_id)
        .order_by(Submission.created_at.desc())
        .limit(8)
        .all()
    )

    return DashboardResponse(
        total_users=db.query(User).filter(User.is_admin.is_(False)).count(),
        active_users=db.query(User).filter(
            User.is_admin.is_(False), User.is_active.is_(True)
        ).count(),
        total_requests=db.query(Submission).count(),
        requests_today=db.query(Submission)
        .filter(Submission.created_at >= today)
        .count(),
        active_admin_devices=db.query(AdminSession.device_id)
        .filter(AdminSession.user_id == admin.id, AdminSession.is_active.is_(True))
        .distinct()
        .count(),
        requests_by_status=[
            ChartItem(label=row[0] or "نامشخص", value=row[1]) for row in status_rows
        ],
        requests_by_department=[
            ChartItem(label=row[0] or "بدون واحد", value=row[1])
            for row in department_rows
        ],
        requests_by_month=month_items,
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


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    search: str = Query(default="", max_length=128),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    query = db.query(User).filter(User.is_admin.is_(False))
    if search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            User.username.ilike(pattern)
            | User.display_name.ilike(pattern)
            | User.email.ilike(pattern)
            | User.department.ilike(pattern)
        )
    return query.order_by(User.created_at.desc()).all()


@router.post("/users", response_model=AdminUserResponse, status_code=201)
def create_user(
    body: AdminUserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    username = _normalized_username(body.username)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است.")
    user = User(
        username=username,
        password_hash=hash_password(body.password),
        display_name=body.display_name.strip(),
        email=body.email.strip().lower(),
        category=body.category.strip(),
        department=body.department.strip(),
        job_title=body.job_title.strip(),
        extension=body.extension.strip(),
        is_active=body.is_active,
        must_change_password=body.must_change_password,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id, User.is_admin.is_(False)).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    values = body.model_dump(exclude_unset=True)
    if "username" in values:
        username = _normalized_username(values.pop("username"))
        duplicate = (
            db.query(User)
            .filter(User.username == username, User.id != user.id)
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است.")
        user.username = username
    password = values.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
        user.password_changed_at = datetime.utcnow()
    for field, value in values.items():
        if isinstance(value, str):
            value = value.strip()
            if field == "email":
                value = value.lower()
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id, User.is_admin.is_(False)).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    # Keep historical request ownership intact while removing all login access.
    user.is_active = False
    db.commit()


@router.get("/sessions", response_model=list[AdminSessionResponse])
def list_sessions(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    _expire_old_admin_sessions(db, admin.id)
    return (
        db.query(AdminSession)
        .filter(AdminSession.user_id == admin.id)
        .order_by(AdminSession.logged_in_at.desc())
        .limit(limit)
        .all()
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    session = (
        db.query(AdminSession)
        .filter(AdminSession.id == session_id, AdminSession.user_id == admin.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="نشست یافت نشد.")
    session.is_active = False
    session.logged_out_at = datetime.utcnow()
    db.commit()
