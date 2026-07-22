import json

from fastapi import Depends, Header, HTTPException

from app.api.routes.reports_helpers import _format_dt, _verify_api_key
from app.core.deps import get_optional_user
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import SubmissionListItem, SubmissionResponse
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES


def _parse_submission_data(raw: str) -> dict:
    try:
        data = json.loads(raw or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}
    parsed: dict = {}
    for key, value in data.items():
        if key == "_report_id":
            continue
        if isinstance(value, str) and value.strip()[:1] in ("[", "{"):
            try:
                parsed[key] = json.loads(value)
            except json.JSONDecodeError:
                parsed[key] = value
        else:
            parsed[key] = value
    return parsed


def _report_id_from_data(raw: str) -> int | None:
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return None
    report_id = data.get("_report_id")
    if report_id is None:
        return None
    try:
        return int(report_id)
    except (TypeError, ValueError):
        return None


def _form_title(form_id: str) -> str:
    form = FORM_TEMPLATES.get(form_id)
    return form.title if form else form_id


def _department_and_section_titles(
    department_id: str, section_id: str
) -> tuple[str, str]:
    for department in DEPARTMENTS:
        if department.id != department_id:
            continue
        section_title = next(
            (
                section.title
                for section in department.sections
                if section.id == section_id
            ),
            section_id,
        )
        return department.title, section_title
    return department_id, section_id


def _submission_to_list_item(submission: Submission, user: User | None) -> SubmissionListItem:
    department_title, section_title = _department_and_section_titles(
        submission.department_id, submission.section_id
    )
    return SubmissionListItem(
        id=submission.id,
        form_id=submission.form_id,
        form_title=_form_title(submission.form_id),
        department_id=submission.department_id,
        department_title=department_title,
        section_id=submission.section_id,
        section_title=section_title,
        subject=submission.subject,
        status=submission.status,
        submitted_by=(user.display_name or user.username) if user else "نامشخص",
        submitted_by_username=user.username if user else "",
        attachment_name=submission.attachment_name,
        report_id=_report_id_from_data(submission.data),
        created_at=_format_dt(submission.created_at),
    )


def _submission_to_response(submission: Submission, user: User | None) -> SubmissionResponse:
    department_title, section_title = _department_and_section_titles(
        submission.department_id, submission.section_id
    )
    return SubmissionResponse(
        id=submission.id,
        form_id=submission.form_id,
        form_title=_form_title(submission.form_id),
        department_id=submission.department_id,
        department_title=department_title,
        section_id=submission.section_id,
        section_title=section_title,
        subject=submission.subject,
        status=submission.status,
        submitted_by=(user.display_name or user.username) if user else "نامشخص",
        submitted_by_username=user.username if user else "",
        attachment_name=submission.attachment_name,
        report_id=_report_id_from_data(submission.data),
        created_at=_format_dt(submission.created_at),
        data=_parse_submission_data(submission.data),
    )


def require_api_key_or_user(
    x_api_key: str | None = Header(default=None),
    current_user: User | None = Depends(get_optional_user),
):
    if _verify_api_key(x_api_key):
        return None
    if current_user:
        return current_user
    raise HTTPException(status_code=401, detail="دسترسی غیرمجاز")
