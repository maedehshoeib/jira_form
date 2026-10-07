"""Multipart boundary parsing shared by letter send and draft endpoints."""

import json
from dataclasses import dataclass, field

from fastapi import HTTPException, UploadFile
from starlette.datastructures import FormData

from app.services.management_letter_service import (
    DEFAULT_LETTER_TYPE,
    MAX_RECIPIENT_COMMENT_LENGTH,
    LetterType,
    validate_letter_type,
)


@dataclass
class LetterFormFields:
    letter_type: LetterType
    subject: str
    description: str
    letter_number: str
    needs_reply: str
    needs_action: str
    due_date: str
    sender: str
    sender_detail: str
    recipient_ids: list[int]
    cc_recipient_ids: list[int]
    recipient_comments: dict[int, str]
    uploads: list[UploadFile] = field(default_factory=list)
    remove_attachment_indexes: list[int] = field(default_factory=list)


def _parse_positive_ids(raw: str, error: str) -> list[int]:
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail=error)
    if not isinstance(parsed, list) or any(
        not isinstance(item, int) or isinstance(item, bool) or item <= 0
        for item in parsed
    ):
        raise HTTPException(status_code=400, detail=error)
    return parsed


def _parse_indexes(raw: str) -> list[int]:
    error = "فهرست پیوست‌های حذف‌شده نامعتبر است."
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail=error)
    if not isinstance(parsed, list) or any(
        not isinstance(item, int) or isinstance(item, bool) or item < 0
        for item in parsed
    ):
        raise HTTPException(status_code=400, detail=error)
    return parsed


def _parse_comments(raw: str, allowed_ids: set[int]) -> dict[int, str]:
    error = "یادداشت گیرندگان نامعتبر است."
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError(error)
        comments: dict[int, str] = {}
        for recipient_id, comment in parsed.items():
            if (
                not recipient_id.isascii()
                or not recipient_id.isdigit()
                or recipient_id.startswith("0")
                or not isinstance(comment, str)
            ):
                raise ValueError(error)
            normalized_id = int(recipient_id)
            if normalized_id in comments:
                raise ValueError(error)
            comments[normalized_id] = comment
        if not set(comments).issubset(allowed_ids) or any(
            len(comment.strip()) > MAX_RECIPIENT_COMMENT_LENGTH
            for comment in comments.values()
        ):
            raise ValueError(error)
    except (json.JSONDecodeError, TypeError, ValueError, OverflowError):
        raise HTTPException(status_code=400, detail=error)
    return comments


def parse_letter_form(form: FormData) -> LetterFormFields:
    raw_letter_type = form.get("letter_type")
    try:
        letter_type = validate_letter_type(
            DEFAULT_LETTER_TYPE if raw_letter_type is None else str(raw_letter_type)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ids = _parse_positive_ids(
        str(form.get("recipient_ids") or "[]"), "فهرست گیرندگان نامعتبر است."
    )
    cc_ids = _parse_positive_ids(
        str(form.get("cc_recipient_ids") or "[]"), "فهرست رونوشت‌ها نامعتبر است."
    )
    comments = _parse_comments(
        str(form.get("recipient_comments") or "{}"), {*ids, *cc_ids}
    )

    uploads: list[UploadFile] = []
    for key in ("attachments", "attachment"):
        for item in form.getlist(key):
            if hasattr(item, "filename") and item.filename:
                uploads.append(item)  # type: ignore[arg-type]

    return LetterFormFields(
        letter_type=letter_type,
        subject=str(form.get("subject") or ""),
        description=str(form.get("description") or ""),
        letter_number=str(form.get("letter_number") or ""),
        needs_reply=str(form.get("needs_reply") or ""),
        needs_action=str(form.get("needs_action") or ""),
        due_date=str(form.get("due_date") or ""),
        sender=str(form.get("sender") or ""),
        sender_detail=str(form.get("sender_detail") or ""),
        recipient_ids=ids,
        cc_recipient_ids=cc_ids,
        recipient_comments=comments,
        uploads=uploads,
        remove_attachment_indexes=_parse_indexes(
            str(form.get("remove_attachments") or "[]")
        ),
    )
