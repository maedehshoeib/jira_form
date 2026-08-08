import json

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.reports_helpers import _format_dt, _verify_api_key
from app.core.deps import get_optional_user
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import (
    SubmissionListItem,
    SubmissionReferralItem,
    SubmissionResponse,
)
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES
from app.services.task_workflow_service import list_submission_referrals


def _parse_submission_data(raw: str) -> dict:
    try:
        data = json.loads(raw or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}
    parsed: dict = {}
    for key, value in data.items():
        if key in {"_report_id", "_attachments"}:
            continue
        if isinstance(value, str) and value.strip()[:1] in ("[", "{"):
            try:
                parsed[key] = json.loads(value)
            except json.JSONDecodeError:
                parsed[key] = value
        else:
            parsed[key] = value
    # Expose attachment names without filesystem paths.
    stored = data.get("_attachments")
    if isinstance(stored, list):
        names = [
            str(item.get("name"))
            for item in stored
            if isinstance(item, dict) and item.get("name")
        ]
        if names:
            parsed["attachments"] = names
    return parsed


def _attachment_names(submission: Submission) -> list[str]:
    try:
        data = json.loads(submission.data or "{}")
    except (json.JSONDecodeError, TypeError):
        data = {}
    stored = data.get("_attachments")
    if isinstance(stored, list):
        names = [
            str(item.get("name"))
            for item in stored
            if isinstance(item, dict) and item.get("name")
        ]
        if names:
            return names
    public = data.get("attachments")
    if isinstance(public, list):
        names = [str(name) for name in public if name]
        if names:
            return names
    if submission.attachment_name:
        return [submission.attachment_name]
    return []


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
    from app.services.portal_service import (
        MANAGEMENT_LETTER_SECTION,
        MANAGEMENT_WORKFLOW_ID,
    )

    if department_id == MANAGEMENT_WORKFLOW_ID:
        section_title = (
            "نامه‌های مدیریتی"
            if section_id == MANAGEMENT_LETTER_SECTION
            else section_id
        )
        return "گردش کار مدیریت", section_title or "گردش کار مدیریت"

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


def _user_display(user: User | None) -> str:
    if not user:
        return "نامشخص"
    from app.core.birthday import user_display_name

    return user_display_name(user) or "نامشخص"


def _referral_items(
    db: Session, submission_id: int
) -> list[SubmissionReferralItem]:
    referrals = list_submission_referrals(db, submission_id)
    if not referrals:
        return []
    user_ids = {row.from_user_id for row in referrals} | {
        row.to_user_id for row in referrals
    }
    users = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(user_ids)).all()
    }
    return [
        SubmissionReferralItem(
            id=row.id,
            from_user_id=row.from_user_id,
            from_user_name=_user_display(users.get(row.from_user_id)),
            to_user_id=row.to_user_id,
            to_user_name=_user_display(users.get(row.to_user_id)),
            note=row.note or "",
            created_at=_format_dt(row.created_at),
        )
        for row in referrals
    ]


def _status_updated_by_name(db: Session, submission: Submission) -> str | None:
    if not submission.status_updated_by_id:
        return None
    user = (
        db.query(User).filter(User.id == submission.status_updated_by_id).first()
    )
    return _user_display(user)


def _submission_to_list_item(
    submission: Submission,
    user: User | None,
    *,
    db: Session | None = None,
    can_act: bool = False,
) -> SubmissionListItem:
    department_title, section_title = _department_and_section_titles(
        submission.department_id, submission.section_id
    )
    referrals = _referral_items(db, submission.id) if db is not None else []
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
        attachment_names=_attachment_names(submission),
        report_id=_report_id_from_data(submission.data),
        created_at=_format_dt(submission.created_at),
        status_updated_by=_status_updated_by_name(db, submission) if db else None,
        status_updated_at=(
            _format_dt(submission.status_updated_at)
            if db and submission.status_updated_at
            else None
        ),
        status_note=(submission.status_note or "") if db else "",
        referrals=referrals,
        can_act=can_act,
    )


def _submission_to_response(
    submission: Submission,
    user: User | None,
    *,
    db: Session | None = None,
    can_act: bool = False,
) -> SubmissionResponse:
    department_title, section_title = _department_and_section_titles(
        submission.department_id, submission.section_id
    )
    referrals = _referral_items(db, submission.id) if db is not None else []
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
        attachment_names=_attachment_names(submission),
        report_id=_report_id_from_data(submission.data),
        created_at=_format_dt(submission.created_at),
        data=_parse_submission_data(submission.data),
        status_updated_by=_status_updated_by_name(db, submission) if db else None,
        status_updated_at=(
            _format_dt(submission.status_updated_at)
            if db and submission.status_updated_at
            else None
        ),
        status_note=(submission.status_note or "") if db else "",
        referrals=referrals,
        can_act=can_act,
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
