from datetime import datetime, timedelta
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user
from app.core.config import settings
from app.core.jalali import default_analytics_range, normalize_digits
from app.core.security import hash_password
from app.db.session import get_db
from app.models.admin_session import AdminSession
from app.models.department import Department
from app.models.form_template import DepartmentFormAccess, UserFormAccess
from app.models.pdf_form import PdfForm
from app.models.submission import Submission
from app.models.site_banner import SiteBanner, SiteBannerImage
from app.models.site_news import SiteNews
from app.models.user import User
from app.schemas.admin import (
    AdminSessionResponse,
    AdminUserCreate,
    AdminUserResponse,
    AdminUserUpdate,
    AnalyticsResponse,
    ChartItem,
    DashboardRecentRequest,
    DashboardResponse,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    FormAccessResponse,
    FormAccessSelection,
    FormAccessTarget,
    SiteBannerResponse,
    SiteBannerUpdate,
    SiteNewsResponse,
)
from app.schemas.pdf_form import PdfFormResponse
from app.services.admin_analytics_service import build_analytics
from app.services.form_access_service import access_catalog, parse_target_keys

router = APIRouter()


@router.get("/pdf-forms", response_model=list[PdfFormResponse])
def list_pdf_forms(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return db.query(PdfForm).order_by(PdfForm.created_at.desc(), PdfForm.id.desc()).all()


@router.post("/pdf-forms", response_model=PdfFormResponse, status_code=201)
async def upload_pdf_form(
    title: str = Form(...),
    description: str = Form(default=""),
    pdf: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    normalized_title = title.strip()
    if not normalized_title:
        raise HTTPException(status_code=422, detail="عنوان فرم الزامی است.")
    if len(normalized_title) > 256 or len(description) > 2000:
        raise HTTPException(status_code=422, detail="عنوان یا توضیحات فرم بیش از حد طولانی است.")

    content = await pdf.read(20 * 1024 * 1024 + 1)
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="حجم فایل PDF نباید بیشتر از ۲۰ مگابایت باشد.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="فایل انتخاب‌شده باید با فرمت PDF باشد.")

    forms_dir = (Path(settings.UPLOAD_DIR) / "forms").resolve()
    forms_dir.mkdir(parents=True, exist_ok=True)
    new_path = forms_dir / f"{uuid.uuid4().hex}.pdf"
    new_path.write_bytes(content)

    item = PdfForm(
        title=normalized_title,
        description=description.strip(),
        file_path=str(new_path),
        file_name=(pdf.filename or f"{normalized_title}.pdf")[:256],
        file_size=len(content),
        uploaded_by=current_user.username,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/pdf-forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdf_form(
    form_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    item = db.query(PdfForm).filter(PdfForm.id == form_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="فرم PDF یافت نشد.")

    file_path = Path(item.file_path).resolve()
    forms_dir = (Path(settings.UPLOAD_DIR) / "forms").resolve()
    db.delete(item)
    db.commit()

    if file_path.parent == forms_dir and file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass


def _get_banner(db: Session) -> SiteBanner:
    banner = db.query(SiteBanner).filter(SiteBanner.id == 1).first()
    if not banner:
        banner = SiteBanner(id=1)
        db.add(banner)
        db.commit()
        db.refresh(banner)
    return banner


def _banner_response(banner: SiteBanner, db: Session) -> SiteBannerResponse:
    images = (
        db.query(SiteBannerImage)
        .filter(SiteBannerImage.banner_id == banner.id)
        .order_by(SiteBannerImage.sort_order, SiteBannerImage.id)
        .all()
    )
    first_image = images[0] if images else None
    return SiteBannerResponse(
        is_active=banner.is_active,
        images=[
            {
                "id": image.id,
                "image_url": f"/api/v1/banner/images/{image.id}",
                "image_name": image.image_name,
            }
            for image in images
        ],
        interval_seconds=banner.interval_seconds,
        image_url=(
            f"/api/v1/banner/images/{first_image.id}" if first_image else None
        ),
        image_name=first_image.image_name if first_image else "",
        updated_at=banner.updated_at,
    )


@router.get("/banner", response_model=SiteBannerResponse)
def get_banner_settings(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return _banner_response(_get_banner(db), db)


@router.put("/banner", response_model=SiteBannerResponse)
def update_banner_settings(
    body: SiteBannerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    banner = _get_banner(db)
    banner.is_active = body.is_active
    banner.interval_seconds = body.interval_seconds
    db.commit()
    db.refresh(banner)
    return _banner_response(banner, db)


@router.post("/banner/image", response_model=SiteBannerResponse)
async def upload_banner_image(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    content = await image.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="حجم تصویر بنر نباید بیشتر از ۱۰ مگابایت باشد.")

    signatures = {
        "jpg": content.startswith(b"\xff\xd8\xff"),
        "png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "webp": len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP",
    }
    extension = next((ext for ext, matches in signatures.items() if matches), None)
    if not extension:
        raise HTTPException(
            status_code=415,
            detail="فرمت تصویر باید JPG، PNG یا WebP باشد.",
        )

    banner_dir = (Path(settings.UPLOAD_DIR) / "banners").resolve()
    banner_dir.mkdir(parents=True, exist_ok=True)
    new_path = banner_dir / f"{uuid.uuid4().hex}.{extension}"
    new_path.write_bytes(content)

    banner = _get_banner(db)
    last_sort_order = (
        db.query(func.max(SiteBannerImage.sort_order))
        .filter(SiteBannerImage.banner_id == banner.id)
        .scalar()
    )
    db.add(
        SiteBannerImage(
            banner_id=banner.id,
            image_path=str(new_path),
            image_name=image.filename or f"banner.{extension}",
            sort_order=(last_sort_order if last_sort_order is not None else -1) + 1,
        )
    )
    banner.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(banner)
    return _banner_response(banner, db)


@router.delete("/banner/images/{image_id}", response_model=SiteBannerResponse)
def delete_banner_image(
    image_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    banner = _get_banner(db)
    image = (
        db.query(SiteBannerImage)
        .filter(
            SiteBannerImage.id == image_id,
            SiteBannerImage.banner_id == banner.id,
        )
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")

    image_path = Path(image.image_path).resolve()
    banner_dir = (Path(settings.UPLOAD_DIR) / "banners").resolve()
    if banner.image_path and Path(banner.image_path).resolve() == image_path:
        banner.image_path = ""
        banner.image_name = ""
    db.delete(image)
    banner.updated_at = datetime.utcnow()
    db.commit()

    if image_path.parent == banner_dir and image_path.is_file():
        try:
            image_path.unlink()
        except OSError:
            pass

    db.refresh(banner)
    return _banner_response(banner, db)


def _news_response(item: SiteNews) -> SiteNewsResponse:
    return SiteNewsResponse(
        id=item.id,
        title=item.title,
        body=item.body,
        image_url=f"/api/v1/news/images/{item.id}" if item.image_path else None,
        image_name=item.image_name,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def _store_news_image(image: UploadFile | None) -> tuple[str, str] | tuple[None, None]:
    if image is None or not (image.filename or "").strip():
        return None, None

    content = await image.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="حجم تصویر خبر نباید بیشتر از ۱۰ مگابایت باشد.")

    signatures = {
        "jpg": content.startswith(b"\xff\xd8\xff"),
        "png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "webp": len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP",
    }
    extension = next((ext for ext, matches in signatures.items() if matches), None)
    if not extension:
        raise HTTPException(
            status_code=415,
            detail="فرمت تصویر باید JPG، PNG یا WebP باشد.",
        )

    news_dir = (Path(settings.UPLOAD_DIR) / "news").resolve()
    news_dir.mkdir(parents=True, exist_ok=True)
    new_path = news_dir / f"{uuid.uuid4().hex}.{extension}"
    new_path.write_bytes(content)
    return str(new_path), (image.filename or f"news.{extension}")[:256]


def _delete_news_image_file(image_path: str) -> None:
    if not image_path:
        return
    path = Path(image_path).resolve()
    news_dir = (Path(settings.UPLOAD_DIR) / "news").resolve()
    if path.parent == news_dir and path.is_file():
        try:
            path.unlink()
        except OSError:
            pass


def _validate_news_content(title: str, body: str, has_image: bool) -> tuple[str, str]:
    normalized_title = title.strip()
    normalized_body = body.strip()
    if not normalized_title and not normalized_body and not has_image:
        raise HTTPException(
            status_code=422,
            detail="برای ثبت خبر حداقل عنوان، متن یا تصویر لازم است.",
        )
    if len(normalized_title) > 256:
        raise HTTPException(status_code=422, detail="عنوان خبر بیش از حد طولانی است.")
    if len(normalized_body) > 10000:
        raise HTTPException(status_code=422, detail="متن خبر بیش از حد طولانی است.")
    if not normalized_title:
        normalized_title = "اطلاعیه"
    return normalized_title, normalized_body


@router.get("/news", response_model=list[SiteNewsResponse])
def list_news(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    items = db.query(SiteNews).order_by(SiteNews.created_at.desc(), SiteNews.id.desc()).all()
    return [_news_response(item) for item in items]


@router.post("/news", response_model=SiteNewsResponse, status_code=201)
async def create_news(
    title: str = Form(default=""),
    body: str = Form(default=""),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    image_path, image_name = await _store_news_image(image)
    normalized_title, normalized_body = _validate_news_content(
        title, body, bool(image_path)
    )

    item = SiteNews(
        title=normalized_title,
        body=normalized_body,
        image_path=image_path or "",
        image_name=image_name or "",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _news_response(item)


@router.put("/news/{news_id}", response_model=SiteNewsResponse)
async def update_news(
    news_id: int,
    title: str = Form(default=""),
    body: str = Form(default=""),
    remove_image: bool = Form(default=False),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    item = db.query(SiteNews).filter(SiteNews.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="خبر یافت نشد.")

    new_image_path, new_image_name = await _store_news_image(image)
    old_image_path = item.image_path

    if new_image_path:
        item.image_path = new_image_path
        item.image_name = new_image_name or ""
    elif remove_image:
        item.image_path = ""
        item.image_name = ""

    has_image = bool(item.image_path)
    normalized_title, normalized_body = _validate_news_content(
        title, body, has_image
    )
    item.title = normalized_title
    item.body = normalized_body
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)

    if (new_image_path or remove_image) and old_image_path and old_image_path != item.image_path:
        _delete_news_image_file(old_image_path)

    return _news_response(item)


@router.delete("/news/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(
    news_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    item = db.query(SiteNews).filter(SiteNews.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="خبر یافت نشد.")

    image_path = item.image_path
    db.delete(item)
    db.commit()
    _delete_news_image_file(image_path)


def _normalized_username(value: str) -> str:
    return value.strip().lower()


def _department_or_404(db: Session, department_id: int) -> Department:
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="واحد سازمانی یافت نشد.")
    return department


def _department_response(db: Session, department: Department) -> DepartmentResponse:
    return DepartmentResponse(
        id=department.id,
        name=department.name,
        description=department.description,
        access_configured=department.access_configured,
        # Administrator identities are system accounts and are intentionally
        # absent from the employee-management screen.
        user_count=db.query(User)
        .filter(
            User.department_id == department.id,
            User.is_admin.is_(False),
        )
        .count(),
    )


def _resolve_user_department(
    db: Session, department_id: int | None, fallback_name: str = ""
) -> tuple[int | None, str]:
    if department_id is not None:
        department = _department_or_404(db, department_id)
        return department.id, department.name
    fallback_name = fallback_name.strip()
    if not fallback_name:
        return None, ""
    department = db.query(Department).filter(Department.name == fallback_name).first()
    return (department.id if department else None), fallback_name


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


@router.get("/analytics", response_model=AnalyticsResponse)
def analytics(
    start_date: str | None = Query(default=None, max_length=16),
    end_date: str | None = Query(default=None, max_length=16),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    _expire_old_admin_sessions(db, admin.id)
    default_start, default_end = default_analytics_range(6)
    start = normalize_digits(start_date) if start_date else default_start
    end = normalize_digits(end_date) if end_date else default_end
    try:
        return build_analytics(db, admin=admin, start_date=start, end_date=end)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
    query = db.query(User)
    if search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            User.username.ilike(pattern)
            | User.display_name.ilike(pattern)
            | User.email.ilike(pattern)
            | User.department.ilike(pattern)
        )
    return query.order_by(User.created_at.desc()).all()


@router.get("/departments", response_model=list[DepartmentResponse])
def list_managed_departments(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    return [
        _department_response(db, department)
        for department in db.query(Department).order_by(Department.name).all()
    ]


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(
    body: DepartmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    name = body.name.strip()
    if db.query(Department).filter(func.lower(Department.name) == name.lower()).first():
        raise HTTPException(status_code=409, detail="این واحد سازمانی قبلاً ثبت شده است.")
    department = Department(name=name, description=body.description.strip())
    db.add(department)
    db.commit()
    db.refresh(department)
    return _department_response(db, department)


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    body: DepartmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    department = _department_or_404(db, department_id)
    values = body.model_dump(exclude_unset=True)
    if "name" in values:
        name = values["name"].strip()
        duplicate = (
            db.query(Department)
            .filter(func.lower(Department.name) == name.lower(), Department.id != department.id)
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="این واحد سازمانی قبلاً ثبت شده است.")
        department.name = name
        # Retain the legacy display field used in profiles and reports.
        db.query(User).filter(User.department_id == department.id).update(
            {User.department: name}, synchronize_session=False
        )
    if "description" in values:
        department.description = values["description"].strip()
    db.commit()
    db.refresh(department)
    return _department_response(db, department)


@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    department = _department_or_404(db, department_id)
    if (
        db.query(User)
        .filter(
            User.department_id == department.id,
            User.is_admin.is_(False),
        )
        .first()
    ):
        raise HTTPException(
            status_code=409,
            detail="ابتدا کاربران این واحد را به واحد دیگری منتقل کنید.",
        )
    # A hidden system administrator may still carry the seeded "مدیریت"
    # assignment. It must not prevent an otherwise empty department deletion.
    db.query(User).filter(
        User.department_id == department.id,
        User.is_admin.is_(True),
    ).update(
        {User.department_id: None, User.department: ""},
        synchronize_session=False,
    )
    db.query(DepartmentFormAccess).filter(
        DepartmentFormAccess.department_id == department.id
    ).delete(synchronize_session=False)
    db.delete(department)
    db.commit()


@router.get("/form-access/catalog", response_model=list[FormAccessTarget])
def get_form_access_catalog(_: User = Depends(get_admin_user)):
    return [FormAccessTarget(**target.__dict__) for target in access_catalog()]


@router.get(
    "/departments/{department_id}/form-access",
    response_model=FormAccessResponse,
)
def get_department_form_access(
    department_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    department = _department_or_404(db, department_id)
    rows = db.query(DepartmentFormAccess).filter(
        DepartmentFormAccess.department_id == department.id
    ).all()
    return FormAccessResponse(
        configured=department.access_configured,
        targets=[
            f"{row.portal_department_id}:{row.section_id}:{row.form_id}"
            for row in rows
        ],
    )


@router.put(
    "/departments/{department_id}/form-access",
    response_model=FormAccessResponse,
)
def update_department_form_access(
    department_id: int,
    body: FormAccessSelection,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    department = _department_or_404(db, department_id)
    try:
        targets = parse_target_keys(body.targets)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.query(DepartmentFormAccess).filter(
        DepartmentFormAccess.department_id == department.id
    ).delete(synchronize_session=False)
    department.access_configured = body.configured
    if body.configured:
        db.add_all(
            [
                DepartmentFormAccess(
                    department_id=department.id,
                    portal_department_id=target.portal_department_id,
                    section_id=target.section_id,
                    form_id=target.form_id,
                )
                for target in targets
            ]
        )
    db.commit()
    return FormAccessResponse(
        configured=department.access_configured,
        targets=[target.key for target in targets] if body.configured else [],
    )


@router.get("/users/{user_id}/form-access", response_model=FormAccessResponse)
def get_user_form_access(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id, User.is_admin.is_(False)).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    rows = db.query(UserFormAccess).filter(UserFormAccess.user_id == user.id).all()
    return FormAccessResponse(
        configured=user.form_access_configured,
        targets=[
            f"{row.portal_department_id}:{row.section_id}:{row.form_id}"
            for row in rows
        ],
    )


@router.put("/users/{user_id}/form-access", response_model=FormAccessResponse)
def update_user_form_access(
    user_id: int,
    body: FormAccessSelection,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id, User.is_admin.is_(False)).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    try:
        targets = parse_target_keys(body.targets)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.query(UserFormAccess).filter(UserFormAccess.user_id == user.id).delete(
        synchronize_session=False
    )
    user.form_access_configured = body.configured
    if body.configured:
        db.add_all(
            [
                UserFormAccess(
                    user_id=user.id,
                    portal_department_id=target.portal_department_id,
                    section_id=target.section_id,
                    form_id=target.form_id,
                )
                for target in targets
            ]
        )
    db.commit()
    return FormAccessResponse(
        configured=user.form_access_configured,
        targets=[target.key for target in targets] if body.configured else [],
    )


@router.post("/users", response_model=AdminUserResponse, status_code=201)
def create_user(
    body: AdminUserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    username = _normalized_username(body.username)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="این نام کاربری قبلاً ثبت شده است.")
    department_id, department_name = _resolve_user_department(
        db, body.department_id, body.department
    )
    user = User(
        username=username,
        password_hash=hash_password(body.password),
        display_name=body.display_name.strip(),
        email=body.email.strip().lower(),
        category=body.category.strip(),
        department=department_name,
        department_id=department_id,
        job_title=body.job_title.strip(),
        extension=body.extension.strip(),
        is_active=body.is_active,
        must_change_password=body.must_change_password,
        is_admin=body.is_admin,
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
    current_user: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    values = body.model_dump(exclude_unset=True)
    if user.id == current_user.id and (
        values.get("is_active") is False or values.get("is_admin") is False
    ):
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate or remove administrator access from your own account.",
        )
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
    if "department_id" in values:
        department_id = values.pop("department_id")
        fallback = values.pop("department", "")
        user.department_id, user.department = _resolve_user_department(
            db, department_id, fallback
        )
    elif "department" in values:
        department_name = values.pop("department")
        user.department_id, user.department = _resolve_user_department(
            db, None, department_name
        )
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
    current_user: User = Depends(get_admin_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")
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
