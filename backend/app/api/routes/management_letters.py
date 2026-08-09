import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.birthday import is_birthday_today, user_display_name
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.management_letter_service import (
    DEFAULT_LETTER_TYPE,
    MAX_RECIPIENT_COMMENT_LENGTH,
    LetterType,
    create_management_letters,
    list_letter_recipients,
    list_sent_letters,
    save_attachments,
    user_can_use_management_workflow,
    validate_letter_type,
)


router = APIRouter(prefix="/management-letters", tags=["management-letters"])
IRAN_TZ = timezone(timedelta(hours=3, minutes=30))


def _format_report_dt(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(IRAN_TZ).strftime("%Y/%m/%d %H:%M")


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
    comment: str = ""


class LetterReportItem(BaseModel):
    batch_id: str
    subject: str
    description: str
    letter_number: str = ""
    system_letter_number: str = ""
    letter_type: LetterType = DEFAULT_LETTER_TYPE
    needs_reply: str = ""
    needs_action: str = ""
    due_date: str = ""
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
    system_letter_number: str
    letter_type: LetterType
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
    letter_type: LetterType = DEFAULT_LETTER_TYPE,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "allowed": user_can_use_management_workflow(
            db,
            current_user,
            letter_type=letter_type,
        )
    }


@router.get("/recipients", response_model=list[LetterRecipientResponse])
def get_letter_recipients(
    letter_type: LetterType = DEFAULT_LETTER_TYPE,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not user_can_use_management_workflow(
        db,
        current_user,
        letter_type=letter_type,
    ):
        raise HTTPException(status_code=403, detail="شما به نامه‌های سازمانی دسترسی ندارید.")
    return [
        _recipient_response(user)
        for user in list_letter_recipients(
            db,
            exclude_user_id=current_user.id,
            letter_type=letter_type,
        )
    ]


@router.post("", response_model=LetterSendResponse)
async def send_management_letter(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = await request.form()
    raw_letter_type = form.get("letter_type")
    try:
        letter_type = validate_letter_type(
            DEFAULT_LETTER_TYPE
            if raw_letter_type is None
            else str(raw_letter_type)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    subject = str(form.get("subject") or "")
    description = str(form.get("description") or "")
    letter_number = str(form.get("letter_number") or "")
    needs_reply = str(form.get("needs_reply") or "")
    needs_action = str(form.get("needs_action") or "")
    due_date = str(form.get("due_date") or "")
    sender = str(form.get("sender") or "")
    sender_detail = str(form.get("sender_detail") or "")
    recipient_ids = str(form.get("recipient_ids") or "[]")
    recipient_comments = str(form.get("recipient_comments") or "{}")

    try:
        parsed_ids = json.loads(recipient_ids)
        if not isinstance(parsed_ids, list):
            raise ValueError("فهرست گیرندگان نامعتبر است.")
        if any(
            not isinstance(item, int)
            or isinstance(item, bool)
            or item <= 0
            for item in parsed_ids
        ):
            raise ValueError("فهرست گیرندگان نامعتبر است.")
        ids = parsed_ids
    except (json.JSONDecodeError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="فهرست گیرندگان نامعتبر است.")

    try:
        parsed_comments = json.loads(recipient_comments)
        if not isinstance(parsed_comments, dict):
            raise ValueError("یادداشت گیرندگان نامعتبر است.")
        comments: dict[int, str] = {}
        for recipient_id, comment in parsed_comments.items():
            if (
                not recipient_id.isascii()
                or not recipient_id.isdigit()
                or recipient_id.startswith("0")
                or not isinstance(comment, str)
            ):
                raise ValueError("یادداشت گیرندگان نامعتبر است.")
            normalized_id = int(recipient_id)
            if normalized_id in comments:
                raise ValueError("یادداشت گیرندگان نامعتبر است.")
            comments[normalized_id] = comment
        if not set(comments).issubset(ids) or any(
            len(comment.strip()) > MAX_RECIPIENT_COMMENT_LENGTH
            for comment in comments.values()
        ):
            raise ValueError("یادداشت گیرندگان نامعتبر است.")
    except (json.JSONDecodeError, TypeError, ValueError, OverflowError):
        raise HTTPException(status_code=400, detail="یادداشت گیرندگان نامعتبر است.")

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
            recipient_comments=comments,
            letter_number=letter_number,
            needs_reply=needs_reply,
            needs_action=needs_action,
            due_date=due_date,
            sender=sender,
            sender_detail=sender_detail,
            recipient_ids=ids,
            attachments=saved_files,
            letter_type=letter_type,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    batch_id = ""
    system_letter_number = ""
    if submissions:
        try:
            data = json.loads(submissions[0].data or "{}")
            batch_id = str(data.get("letter_batch_id") or "")
            system_letter_number = str(data.get("system_letter_number") or "")
        except (json.JSONDecodeError, TypeError):
            batch_id = ""
            system_letter_number = ""

    return LetterSendResponse(
        message="نامه با موفقیت ارسال شد.",
        batch_id=batch_id,
        system_letter_number=system_letter_number,
        letter_type=letter_type,
        count=len(submissions),
        ids=[item.id for item in submissions],
    )


@router.get("/report", response_model=list[LetterReportItem])
def management_letter_report(
    letter_type: LetterType = DEFAULT_LETTER_TYPE,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        rows = list_sent_letters(db, current_user, letter_type=letter_type)
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
                system_letter_number=row.get("system_letter_number") or "",
                letter_type=row.get("letter_type") or DEFAULT_LETTER_TYPE,
                needs_reply=row.get("needs_reply") or "",
                needs_action=row.get("needs_action") or "",
                due_date=row.get("due_date") or "",
                sender=row.get("sender") or "",
                sender_detail=row.get("sender_detail") or "",
                attachment_name=row["attachment_name"],
                attachment_names=row.get("attachment_names") or (
                    [row["attachment_name"]] if row.get("attachment_name") else []
                ),
                created_at=(
                    _format_report_dt(created_at)
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
                            _format_report_dt(item["status_updated_at"])
                            if item.get("status_updated_at")
                            else None
                        ),
                        submission_id=item["submission_id"],
                        referred_to=item.get("referred_to"),
                        comment=item.get("comment") or "",
                    )
                    for item in row["recipients"]
                ],
            )
        )
    return result
