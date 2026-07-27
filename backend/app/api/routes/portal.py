import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.routes.submissions_helpers import (
    _submission_to_list_item,
    _submission_to_response,
    require_api_key_or_user,
)
from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.submission import Submission
from app.models.pdf_form import PdfForm
from app.models.site_banner import SiteBanner, SiteBannerImage
from app.models.user import User
from app.schemas.admin import SiteBannerResponse
from app.schemas.submission import SubmissionListItem, SubmissionResponse
from app.schemas.pdf_form import PdfFormResponse
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES
from app.services.form_access_service import allowed_target_keys, can_access_target
from app.services.report_submission_service import (
    create_report_from_submission,
    is_performance_report_submission,
)

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/pdf-forms", response_model=list[PdfFormResponse])
def list_pdf_forms(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(PdfForm).order_by(PdfForm.created_at.desc(), PdfForm.id.desc()).all()


@router.get("/pdf-forms/{form_id}/file")
def get_pdf_form_file(
    form_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.query(PdfForm).filter(PdfForm.id == form_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="فرم PDF یافت نشد.")
    file_path = Path(item.file_path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="فایل PDF یافت نشد.")
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=item.file_name,
    )


@router.get("/banner", response_model=SiteBannerResponse)
def get_home_banner(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    banner = db.query(SiteBanner).filter(SiteBanner.id == 1).first()
    if not banner:
        return SiteBannerResponse(is_active=False)
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


@router.get("/banner/image")
def get_home_banner_image(
    db: Session = Depends(get_db),
):
    image = (
        db.query(SiteBannerImage)
        .filter(SiteBannerImage.banner_id == 1)
        .order_by(SiteBannerImage.sort_order, SiteBannerImage.id)
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    image_path = Path(image.image_path)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    return FileResponse(image_path)


@router.get("/banner/images/{image_id}")
def get_home_banner_image_by_id(
    image_id: int,
    db: Session = Depends(get_db),
):
    image = (
        db.query(SiteBannerImage)
        .filter(
            SiteBannerImage.id == image_id,
            SiteBannerImage.banner_id == 1,
        )
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    image_path = Path(image.image_path)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    return FileResponse(image_path)


@router.get("/departments")
def get_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = allowed_target_keys(db, current_user)
    if allowed is None:
        return DEPARTMENTS
    result = []
    for department in DEPARTMENTS:
        if department.sections:
            sections = [
                section
                for section in department.sections
                if f"{department.id}:{section.id}:{section.form_id}" in allowed
            ]
            if sections:
                result.append(department.model_copy(update={"sections": sections}))
        elif f"{department.id}::{department.id}" in allowed:
            result.append(department)
    return result


@router.get("/departments/{department_id}")
def get_department(
    department_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible = get_departments(db, current_user)
    for dep in visible:
        if dep.id == department_id:
            return dep
    raise HTTPException(status_code=404, detail="Department not found")


@router.get("/forms/{form_id}")
def get_form(
    form_id: str,
    department: str = Query(default=""),
    section: str = Query(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FORM_TEMPLATES.get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    portal_department_id = department or form.department_id
    section_id = section or form.section_id
    if not can_access_target(
        db, current_user, portal_department_id, section_id, form_id
    ):
        raise HTTPException(status_code=403, detail="شما به این فرم دسترسی ندارید.")
    return form


@router.post("/submissions")
async def create_submission(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = await request.form()
    form_id = str(form.get("form_id", "common-form"))
    department_id = str(form.get("department_id", ""))
    section_id = str(form.get("section_id", ""))
    if form_id not in FORM_TEMPLATES or not can_access_target(
        db, current_user, department_id, section_id, form_id
    ):
        raise HTTPException(status_code=403, detail="شما به این فرم دسترسی ندارید.")
    form_data: dict = {}
    attachment_path = None
    attachment_name = None

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    for key, value in form.items():
        if key in {"form_id", "department_id", "section_id"}:
            continue
        if hasattr(value, "filename") and value.filename:
            ext = Path(value.filename).suffix
            filename = f"{uuid.uuid4().hex}{ext}"
            file_path = upload_dir / filename
            content = await value.read()
            file_path.write_bytes(content)
            attachment_path = str(file_path)
            attachment_name = value.filename
            form_data[key] = value.filename
        else:
            form_data[key] = str(value)

    subject = form_data.get("subject", "")

    submission = Submission(
        form_id=form_id,
        department_id=department_id,
        section_id=section_id,
        user_id=current_user.id,
        subject=subject,
        data=json.dumps(form_data, ensure_ascii=False),
        attachment_path=attachment_path,
        attachment_name=attachment_name,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    report_id = None
    if is_performance_report_submission(form_id, department_id, section_id):
        report = create_report_from_submission(
            db, form_data, current_user, department_id
        )
        report_id = report.id
        form_data["_report_id"] = report_id

    submission.data = json.dumps(form_data, ensure_ascii=False)
    db.commit()
    db.refresh(submission)

    response = {
        "message": "submitted",
        "id": submission.id,
        "subject": subject,
        "file": attachment_name,
    }
    if report_id is not None:
        response["report_id"] = report_id
    return response


@router.get("/submissions", response_model=list[SubmissionListItem])
def list_submissions(
    form_id: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    section_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    auth: User | None = Depends(require_api_key_or_user),
):
    query = db.query(Submission).order_by(Submission.created_at.desc())

    # API-key callers are administrative integrations and may list everything.
    # A signed-in employee must only ever receive their own submissions.
    if auth is not None and not auth.is_admin:
        query = query.filter(Submission.user_id == auth.id)

    if form_id:
        query = query.filter(Submission.form_id == form_id)
    if department_id:
        query = query.filter(Submission.department_id == department_id)
    if section_id:
        query = query.filter(Submission.section_id == section_id)

    submissions = query.offset(offset).limit(limit).all()
    result = []
    for submission in submissions:
        user = db.query(User).filter(User.id == submission.user_id).first()
        result.append(_submission_to_list_item(submission, user))
    return result


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    auth: User | None = Depends(require_api_key_or_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")
    if auth is not None and not auth.is_admin and submission.user_id != auth.id:
        # Return 404 so request identifiers belonging to other employees are not exposed.
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")

    user = db.query(User).filter(User.id == submission.user_id).first()
    return _submission_to_response(submission, user)
