import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.reports_helpers import _format_dt
from app.core.birthday import is_birthday_today, user_display_name
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.management_letter_service import (
    create_management_letters,
    list_letter_recipients,
    list_sent_letters,
    save_attachments,
    user_can_use_management_workflow,
)


router = APIRouter(prefix="/management-letters", tags=["management-letters"])


class LetterRecipientResponse(BaseModel):
    id: int
    username: str
    display_name: str
    department: str
    job_title: str
    birth_date: str | None = None
    is_birthday: bool = False


class LetterRecipientStatus(BaseModel):
    user_id: int | None
    display_name: str
    status: str
    status_updated_at: str | None = None
    submission_id: int
    referred_to: str | None = None


class LetterReportItem(BaseModel):
    batch_id: str
    subject: str
    description: str
    letter_number: str = ""
    needs_reply: str = ""
    sender: str = ""
    sender_detail: str = ""
    attachment_name: str | None = None
    attachment_names: list[str] = []
    created_at: str
    sent_by: str
    sent_by_id: int
    recipients: list[LetterRecipientStatus]


class LetterSendResponse(BaseModel):
    message: str
    batch_id: str
    count: int
    ids: list[int]


def _recipient_response(user: User) -> LetterRecipientResponse:
    return LetterRecipientResponse(
        id=user.id,
        username=user.username,
        display_name=user_display_name(user),
        department=user.department or "",
        job_title=user.job_title or "",
        birth_date=user.birth_date.isoformat() if user.birth_date else None,
        is_birthday=is_birthday_today(user.birth_date),
    )


@router.get("/access")
def management_letter_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"allowed": user_can_use_management_workflow(db, current_user)}


@router.get("/recipients", response_model=list[LetterRecipientResponse])
def get_letter_recipients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not user_can_use_management_workflow(db, current_user):
        raise HTTPException(status_code=403, detail="شما به گردش کار مدیریت دسترسی ندارید.")
    return [
        _recipient_response(user)
        for user in list_letter_recipients(db, exclude_user_id=current_user.id)
    ]


@router.post("", response_model=LetterSendResponse)
async def send_management_letter(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = await request.form()
    subject = str(form.get("subject") or "")
    description = str(form.get("description") or "")
    letter_number = str(form.get("letter_number") or "")
    needs_reply = str(form.get("needs_reply") or "")
    sender = str(form.get("sender") or "")
    sender_detail = str(form.get("sender_detail") or "")
    recipient_ids = str(form.get("recipient_ids") or "[]")

    try:
        parsed_ids = json.loads(recipient_ids)
        if not isinstance(parsed_ids, list):
            raise ValueError("فهرست گیرندگان نامعتبر است.")
        ids = [int(item) for item in parsed_ids]
    except (json.JSONDecodeError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="فهرست گیرندگان نامعتبر است.")

    uploads: list[UploadFile] = []
    for key in ("attachments", "attachment"):
        for item in form.getlist(key):
            if hasattr(item, "filename") and item.filename:
                uploads.append(item)  # type: ignore[arg-type]
    saved_files = await save_attachments(uploads)

    try:
        submissions = create_management_letters(
            db,
            actor=current_user,
            subject=subject,
            description=description,
            letter_number=letter_number,
            needs_reply=needs_reply,
            sender=sender,
            sender_detail=sender_detail,
            recipient_ids=ids,
            attachments=saved_files,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    batch_id = ""
    if submissions:
        try:
            data = json.loads(submissions[0].data or "{}")
            batch_id = str(data.get("letter_batch_id") or "")
        except (json.JSONDecodeError, TypeError):
            batch_id = ""

    return LetterSendResponse(
        message="نامه با موفقیت ارسال شد.",
        batch_id=batch_id,
        count=len(submissions),
        ids=[item.id for item in submissions],
    )


@router.get("/report", response_model=list[LetterReportItem])
def management_letter_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        rows = list_sent_letters(db, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    result: list[LetterReportItem] = []
    for row in rows:
        created_at = row["created_at"]
        result.append(
            LetterReportItem(
                batch_id=row["batch_id"],
                subject=row["subject"],
                description=row["description"],
                letter_number=row.get("letter_number") or "",
                needs_reply=row.get("needs_reply") or "",
                sender=row.get("sender") or "",
                sender_detail=row.get("sender_detail") or "",
                attachment_name=row["attachment_name"],
                attachment_names=row.get("attachment_names") or (
                    [row["attachment_name"]] if row.get("attachment_name") else []
                ),
                created_at=(
                    _format_dt(created_at)
                    if isinstance(created_at, datetime)
                    else str(created_at)
                ),
                sent_by=row["sent_by"],
                sent_by_id=row["sent_by_id"],
                recipients=[
                    LetterRecipientStatus(
                        user_id=item.get("user_id"),
                        display_name=item["display_name"],
                        status=item["status"],
                        status_updated_at=(
                            _format_dt(item["status_updated_at"])
                            if item.get("status_updated_at")
                            else None
                        ),
                        submission_id=item["submission_id"],
                        referred_to=item.get("referred_to"),
                    )
                    for item in row["recipients"]
                ],
            )
        )
    return result
