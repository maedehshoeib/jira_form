"""Draft folder endpoints for management letters (owner-only)."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.management_letter_form import LetterFormFields, parse_letter_form
from app.api.routes.management_letters import LetterSendResponse, send_letter_fields
from app.core.deps import get_current_user
from app.core.timezone import format_tehran_datetime
from app.db.session import get_db
from app.models.submission import LetterDraft
from app.models.user import User
from app.services.letter_draft_service import LetterDraftNotFound, LetterDraftService
from app.services.management_letter_service import (
    DEFAULT_LETTER_TYPE,
    LetterType,
    save_attachments,
    user_can_use_management_workflow,
)

router = APIRouter(prefix="/management-letters/drafts", tags=["management-letters"])


class LetterDraftSummary(BaseModel):
    id: int
    letter_type: LetterType
    subject: str
    recipient_count: int
    attachment_count: int
    updated_at: str


class LetterDraftResponse(BaseModel):
    id: int
    letter_type: LetterType
    subject: str
    description: str
    letter_number: str = ""
    needs_reply: str = ""
    needs_action: str = ""
    due_date: str = ""
    sender: str = ""
    sender_detail: str = ""
    recipient_ids: list[int] = []
    cc_recipient_ids: list[int] = []
    recipient_comments: dict[str, str] = {}
    attachment_names: list[str] = []
    created_at: str
    updated_at: str


def _letter_type(draft: LetterDraft) -> LetterType:
    return "internal" if draft.letter_type == "internal" else DEFAULT_LETTER_TYPE


def _int_list(value: object) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, int) and not isinstance(item, bool)]


def _summary(service: LetterDraftService, draft: LetterDraft) -> LetterDraftSummary:
    payload = service.payload(draft)
    return LetterDraftSummary(
        id=draft.id,
        letter_type=_letter_type(draft),
        subject=draft.subject or "",
        recipient_count=len(_int_list(payload.get("recipient_ids")))
        + len(_int_list(payload.get("cc_recipient_ids"))),
        attachment_count=len(service.attachments(draft)),
        updated_at=format_tehran_datetime(draft.updated_at),
    )


def _detail(service: LetterDraftService, draft: LetterDraft) -> LetterDraftResponse:
    payload = service.payload(draft)
    comments = payload.get("recipient_comments")
    return LetterDraftResponse(
        id=draft.id,
        letter_type=_letter_type(draft),
        subject=draft.subject or "",
        description=draft.description or "",
        **{
            key: str(payload.get(key) or "")
            for key in (
                "letter_number",
                "needs_reply",
                "needs_action",
                "due_date",
                "sender",
                "sender_detail",
            )
        },
        recipient_ids=_int_list(payload.get("recipient_ids")),
        cc_recipient_ids=_int_list(payload.get("cc_recipient_ids")),
        recipient_comments=(
            {str(k): str(v) for k, v in comments.items()}
            if isinstance(comments, dict)
            else {}
        ),
        attachment_names=[item["name"] for item in service.attachments(draft)],
        created_at=format_tehran_datetime(draft.created_at),
        updated_at=format_tehran_datetime(draft.updated_at),
    )


def _payload(fields: LetterFormFields) -> dict:
    return {
        "letter_number": fields.letter_number,
        "needs_reply": fields.needs_reply,
        "needs_action": fields.needs_action,
        "due_date": fields.due_date,
        "sender": fields.sender,
        "sender_detail": fields.sender_detail,
        "recipient_ids": fields.recipient_ids,
        "cc_recipient_ids": fields.cc_recipient_ids,
        "recipient_comments": {
            str(key): value for key, value in fields.recipient_comments.items()
        },
    }


def _require_access(db: Session, user: User, letter_type: LetterType) -> None:
    if not user_can_use_management_workflow(db, user, letter_type=letter_type):
        raise HTTPException(status_code=403, detail="شما به نامه‌های سازمانی دسترسی ندارید.")


def _owned_draft(service: LetterDraftService, draft_id: int, user: User) -> LetterDraft:
    try:
        return service.get(draft_id, user.id)
    except LetterDraftNotFound as exc:
        raise HTTPException(status_code=404, detail="پیش‌نویس یافت نشد") from exc


@router.get("", response_model=list[LetterDraftSummary])
def list_letter_drafts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LetterDraftService(db)
    return [_summary(service, item) for item in service.list_for_user(current_user.id)]


@router.post("", response_model=LetterDraftResponse)
async def create_letter_draft(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fields = parse_letter_form(await request.form())
    _require_access(db, current_user, fields.letter_type)
    service = LetterDraftService(db)
    draft = service.create(
        current_user.id,
        letter_type=fields.letter_type,
        subject=fields.subject,
        description=fields.description,
        payload=_payload(fields),
        new_attachments=await save_attachments(fields.uploads),
    )
    return _detail(service, draft)


@router.get("/{draft_id}", response_model=LetterDraftResponse)
def get_letter_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LetterDraftService(db)
    return _detail(service, _owned_draft(service, draft_id, current_user))


@router.put("/{draft_id}", response_model=LetterDraftResponse)
async def update_letter_draft(
    draft_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LetterDraftService(db)
    draft = _owned_draft(service, draft_id, current_user)
    fields = parse_letter_form(await request.form())
    _require_access(db, current_user, fields.letter_type)
    draft = service.update(
        draft,
        letter_type=fields.letter_type,
        subject=fields.subject,
        description=fields.description,
        payload=_payload(fields),
        new_attachments=await save_attachments(fields.uploads),
        remove_indexes=fields.remove_attachment_indexes,
    )
    return _detail(service, draft)


@router.delete("/{draft_id}")
def delete_letter_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LetterDraftService(db)
    service.delete(_owned_draft(service, draft_id, current_user))
    return {"message": "پیش‌نویس حذف شد."}


@router.post("/{draft_id}/send", response_model=LetterSendResponse)
async def send_letter_draft(
    draft_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = LetterDraftService(db)
    draft = _owned_draft(service, draft_id, current_user)
    fields = parse_letter_form(await request.form())
    kept, removed = service.split_attachments(draft, fields.remove_attachment_indexes)
    new_files = await save_attachments(fields.uploads)
    response = send_letter_fields(db, current_user, fields, [*kept, *new_files])
    service.finish_sent(draft, removed)
    return response
