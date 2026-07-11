import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.submission import Submission
from app.models.user import User
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES
from app.services.report_submission_service import (
    create_report_from_submission,
    is_performance_report_submission,
)

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/departments")
def get_departments():
    return DEPARTMENTS


@router.get("/departments/{department_id}")
def get_department(department_id: str):
    for dep in DEPARTMENTS:
        if dep.id == department_id:
            return dep
    raise HTTPException(status_code=404, detail="Department not found")


@router.get("/forms/{form_id}")
def get_form(form_id: str):
    form = FORM_TEMPLATES.get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@router.post("/submissions")
async def create_submission(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = await request.form()
    form_data: dict = {}
    attachment_path = None
    attachment_name = None

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    for key, value in form.items():
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

    form_id = form_data.pop("form_id", "common-form")
    department_id = form_data.pop("department_id", "")
    section_id = form_data.pop("section_id", "")
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

    response = {
        "message": "submitted",
        "id": submission.id,
        "subject": subject,
        "file": attachment_name,
    }
    if report_id is not None:
        response["report_id"] = report_id
    return response
