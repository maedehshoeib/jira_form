import json
import uuid
from pathlib import Path
from typing import Literal, cast

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.submission import Submission, SubmissionReferral
from app.models.user import User
from app.services.form_access_service import can_access_restricted_department
from app.services.form_duty_service import snapshot_submission_initial_assignees
from app.services.portal_service import (
    INTERNAL_LETTERS_WORKFLOW_ID,
    MANAGEMENT_LETTER_FORM_ID,
    MANAGEMENT_LETTER_SECTION,
    MANAGEMENT_WORKFLOW_ID,
)
from app.services.task_workflow_service import list_submission_referrals


LetterType = Literal["internal", "external"]
DEFAULT_LETTER_TYPE: LetterType = "external"
LETTER_TYPES = frozenset({"internal", "external"})
LETTER_NUMBER_SUFFIXES: dict[LetterType, str] = {
    "internal": "د",
    "external": "ب",
}
LETTER_NUMBER_START = 1001


def validate_letter_type(letter_type: str) -> LetterType:
    """Validate an API/service letter type without changing bad input."""
    if letter_type not in LETTER_TYPES:
        raise ValueError("نوع نامه نامعتبر است.")
    return cast(LetterType, letter_type)


def user_can_use_management_workflow(
    db: Session,
    user: User,
    *,
    letter_type: str = DEFAULT_LETTER_TYPE,
) -> bool:
    normalized_letter_type = validate_letter_type(letter_type)
    access_department_id = (
        INTERNAL_LETTERS_WORKFLOW_ID
        if normalized_letter_type == "internal"
        else MANAGEMENT_WORKFLOW_ID
    )
    return can_access_restricted_department(db, user, access_department_id)


def list_letter_recipients(
    db: Session,
    *,
    exclude_user_id: int | None = None,
    letter_type: str = DEFAULT_LETTER_TYPE,
) -> list[User]:
    normalized_letter_type = validate_letter_type(letter_type)
    query = db.query(User).filter(User.is_active.is_(True))
    if normalized_letter_type == "external":
        query = query.filter(User.is_letter_recipient.is_(True))
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.order_by(User.display_name.asc(), User.username.asc()).all()


def _validate_recipients(
    db: Session,
    actor: User,
    recipient_ids: list[int],
    *,
    letter_type: LetterType,
) -> list[User]:
    unique_ids = list(dict.fromkeys(recipient_ids))
    if not unique_ids:
        raise ValueError("حداقل یک گیرنده را انتخاب کنید.")
    if actor.id in unique_ids:
        raise ValueError("نمی‌توانید نامه را برای خودتان ارسال کنید.")

    query = db.query(User).filter(
        User.id.in_(unique_ids),
        User.is_active.is_(True),
    )
    if letter_type == "external":
        query = query.filter(User.is_letter_recipient.is_(True))
    recipients = query.all()
    found = {user.id for user in recipients}
    missing = [item for item in unique_ids if item not in found]
    if missing:
        raise ValueError("یکی از گیرنده‌های انتخاب‌شده در فهرست مجاز نیست.")
    by_id = {user.id: user for user in recipients}
    return [by_id[item] for item in unique_ids]


async def save_attachment(upload) -> tuple[str | None, str | None]:
    saved = await save_attachments([upload] if upload else [])
    if not saved:
        return None, None
    return saved[0]["path"], saved[0]["name"]


async def save_attachments(uploads: list) -> list[dict[str, str]]:
    """Persist uploaded files and return [{name, path}, ...]."""
    results: list[dict[str, str]] = []
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    for upload in uploads or []:
        if not upload or not getattr(upload, "filename", None):
            continue
        original_name = Path(upload.filename).name[:256]
        if not original_name:
            continue
        ext = Path(original_name).suffix
        stored_name = f"{uuid.uuid4().hex}{ext}"
        file_path = upload_dir / stored_name
        content = await upload.read()
        file_path.write_bytes(content)
        results.append({"name": original_name, "path": str(file_path)})
    return results


def attachment_names_from_submission(submission: Submission) -> list[str]:
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
    if submission.attachment_name:
        return [submission.attachment_name]
    return []


def resolve_submission_attachment(
    submission: Submission, index: int = 0
) -> tuple[Path, str]:
    try:
        data = json.loads(submission.data or "{}")
    except (json.JSONDecodeError, TypeError):
        data = {}

    stored = data.get("_attachments")
    if isinstance(stored, list) and stored:
        if index < 0 or index >= len(stored):
            raise LookupError("پیوست یافت نشد")
        item = stored[index]
        if not isinstance(item, dict) or not item.get("path"):
            raise LookupError("پیوست یافت نشد")
        path = Path(str(item["path"]))
        name = str(item.get("name") or path.name)
        return path, name

    if index == 0 and submission.attachment_path:
        return (
            Path(submission.attachment_path),
            submission.attachment_name or Path(submission.attachment_path).name,
        )
    raise LookupError("پیوست یافت نشد")


NEEDS_REPLY_OPTIONS = {"دارد", "ندارد"}
SENDER_OPTIONS = {"بانک", "شرکت های گروه", "سایر", "هلدینگ"}
HOLDING_OPTIONS = {"فناوری اطلاعات", "مالی", "کسب و کار", "سایر"}
NEEDS_ACTION_OPTIONS = {
    "دارد",
    "ندارد(جهت اطلاع)",
}
MAX_RECIPIENT_COMMENT_LENGTH = 4000


def _stored_letter_type(data: dict) -> LetterType:
    """Treat records created before letter types were introduced as external."""
    value = data.get("letter_type")
    if value is None or value == "":
        return DEFAULT_LETTER_TYPE
    if value in LETTER_TYPES:
        return cast(LetterType, value)
    # Invalid historical data must never appear in the internal-letter report.
    return DEFAULT_LETTER_TYPE


def _next_system_letter_number(db: Session, letter_type: LetterType) -> str:
    """Atomically reserve the next durable number for one logical batch.

    SQLite executes this upsert as one write statement. Each letter type owns a
    separate row, so both sequences begin at 1001 and advance independently.
    """
    number = db.execute(
        text(
            """
            INSERT INTO management_letter_number_counters (letter_type, last_number)
            VALUES (:letter_type, :start_number)
            ON CONFLICT(letter_type) DO UPDATE SET
                last_number = management_letter_number_counters.last_number + 1
            RETURNING last_number
            """
        ),
        {
            "letter_type": letter_type,
            "start_number": LETTER_NUMBER_START,
        },
    ).scalar_one()
    return f"{int(number)}/{LETTER_NUMBER_SUFFIXES[letter_type]}"


def create_management_letters(
    db: Session,
    *,
    actor: User,
    subject: str,
    description: str,
    recipient_ids: list[int],
    recipient_comments: dict[int, str] | None = None,
    letter_number: str = "",
    needs_reply: str = "",
    needs_action: str = "",
    due_date: str = "",
    sender: str = "",
    sender_detail: str = "",
    attachments: list[dict[str, str]] | None = None,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
    letter_type: str = DEFAULT_LETTER_TYPE,
) -> list[Submission]:
    normalized_letter_type = validate_letter_type(letter_type)
    if not user_can_use_management_workflow(
        db,
        actor,
        letter_type=normalized_letter_type,
    ):
        raise PermissionError("شما به نامه‌های سازمانی دسترسی ندارید.")

    cleaned_subject = (subject or "").strip()
    cleaned_description = (description or "").strip()
    cleaned_letter_number = (letter_number or "").strip()
    cleaned_needs_reply = (needs_reply or "").strip()
    cleaned_needs_action = (needs_action or "").strip()
    cleaned_due_date = (due_date or "").strip()
    cleaned_sender = (sender or "").strip()
    cleaned_sender_detail = (sender_detail or "").strip()

    if not cleaned_subject:
        raise ValueError("موضوع نامه الزامی است.")
    if not cleaned_description:
        raise ValueError("توضیحات نامه الزامی است.")
    if normalized_letter_type == "external" and not cleaned_letter_number:
        raise ValueError("شماره نامه الزامی است.")
    if cleaned_needs_reply not in NEEDS_REPLY_OPTIONS:
        raise ValueError("مقدار «نیاز به پاسخ» نامعتبر است.")
    if cleaned_needs_action not in NEEDS_ACTION_OPTIONS:
        raise ValueError("مقدار «نیاز به اقدام» نامعتبر است.")
    if cleaned_needs_reply == "دارد":
        if not cleaned_due_date:
            raise ValueError("مهلت انجام الزامی است.")
    else:
        cleaned_due_date = ""
    if normalized_letter_type == "external":
        if cleaned_sender not in SENDER_OPTIONS:
            raise ValueError("فرستنده نامعتبر است.")
        if cleaned_sender == "هلدینگ":
            if cleaned_sender_detail not in HOLDING_OPTIONS:
                raise ValueError("واحد هلدینگ را انتخاب کنید.")
        else:
            cleaned_sender_detail = ""
    else:
        # Internal letters are sent by the logged-in user and have no separate
        # sender field in their contract or persisted form data.
        cleaned_sender = ""
        cleaned_sender_detail = ""

    files = list(attachments or [])
    if not files and attachment_path and attachment_name:
        files = [{"name": attachment_name, "path": attachment_path}]

    recipients = _validate_recipients(
        db,
        actor,
        recipient_ids,
        letter_type=normalized_letter_type,
    )
    # Each submission below is a per-recipient copy of the same logical letter,
    # so every copy keeps the complete original audience for display.
    all_recipient_ids = [recipient.id for recipient in recipients]
    selected_recipient_ids = {recipient.id for recipient in recipients}
    cleaned_recipient_comments: dict[int, str] = {}
    for recipient_id, comment in (recipient_comments or {}).items():
        if (
            not isinstance(recipient_id, int)
            or isinstance(recipient_id, bool)
            or not isinstance(comment, str)
        ):
            raise ValueError("یادداشت گیرندگان نامعتبر است.")
        if recipient_id not in selected_recipient_ids:
            raise ValueError(
                "یادداشت فقط برای گیرندگان انتخاب‌شده قابل ثبت است."
            )
        cleaned_comment = comment.strip()
        if len(cleaned_comment) > MAX_RECIPIENT_COMMENT_LENGTH:
            raise ValueError(
                "یادداشت هر گیرنده حداکثر می‌تواند ۴۰۰۰ نویسه باشد."
            )
        if cleaned_comment:
            cleaned_recipient_comments[recipient_id] = cleaned_comment

    batch_id = uuid.uuid4().hex
    system_letter_number = _next_system_letter_number(db, normalized_letter_type)
    submissions: list[Submission] = []
    first_path = files[0]["path"] if files else None
    first_name = files[0]["name"] if files else None

    for recipient in recipients:
        form_data: dict = {
            "subject": cleaned_subject,
            "description": cleaned_description,
            "system_letter_number": system_letter_number,
            "letter_type": normalized_letter_type,
            "needs_reply": cleaned_needs_reply,
            "needs_action": cleaned_needs_action,
            "due_date": cleaned_due_date,
            "letter_batch_id": batch_id,
            "recipient_id": recipient.id,
            "recipient_name": recipient.display_name or recipient.username,
        }
        if normalized_letter_type == "external":
            form_data["letter_number"] = cleaned_letter_number
            form_data["sender"] = cleaned_sender
            form_data["sender_detail"] = cleaned_sender_detail
        if files:
            form_data["_attachments"] = files
            form_data["attachments"] = [item["name"] for item in files]
            form_data["attachment"] = first_name
        recipient_comment = cleaned_recipient_comments.get(recipient.id, "")
        if recipient_comment:
            form_data["recipient_comment"] = recipient_comment

        submission = Submission(
            form_id=MANAGEMENT_LETTER_FORM_ID,
            department_id=MANAGEMENT_WORKFLOW_ID,
            section_id=MANAGEMENT_LETTER_SECTION,
            user_id=actor.id,
            subject=cleaned_subject,
            data=json.dumps(form_data, ensure_ascii=False),
            attachment_path=first_path,
            attachment_name=first_name,
            status="submitted",
        )
        db.add(submission)
        db.flush()
        snapshot_submission_initial_assignees(
            db,
            submission,
            explicit_user_ids=all_recipient_ids,
        )
        db.add(
            SubmissionReferral(
                submission_id=submission.id,
                from_user_id=actor.id,
                to_user_id=recipient.id,
                note="نامه‌های سازمانی",
            )
        )
        submissions.append(submission)

    db.commit()
    for submission in submissions:
        db.refresh(submission)
    return submissions


def list_sent_letters(
    db: Session,
    user: User | None,
    *,
    letter_type: str = DEFAULT_LETTER_TYPE,
) -> list[dict]:
    normalized_letter_type = validate_letter_type(letter_type)
    if user is not None and not user_can_use_management_workflow(
        db,
        user,
        letter_type=normalized_letter_type,
    ):
        raise PermissionError("شما به نامه‌های سازمانی دسترسی ندارید.")

    query = db.query(Submission).filter(
        Submission.department_id == MANAGEMENT_WORKFLOW_ID,
        Submission.section_id == MANAGEMENT_LETTER_SECTION,
        Submission.form_id == MANAGEMENT_LETTER_FORM_ID,
    )
    if user is not None and not user.is_admin:
        query = query.filter(Submission.user_id == user.id)

    submissions = query.order_by(Submission.created_at.desc(), Submission.id.desc()).all()
    sender_ids = {item.user_id for item in submissions}
    senders = {
        item.id: item
        for item in db.query(User).filter(User.id.in_(sender_ids)).all()
    } if sender_ids else {}

    groups: dict[str, dict] = {}
    order: list[str] = []

    for submission in submissions:
        try:
            data = json.loads(submission.data or "{}")
        except (json.JSONDecodeError, TypeError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        stored_letter_type = _stored_letter_type(data)
        if stored_letter_type != normalized_letter_type:
            continue
        batch_id = str(data.get("letter_batch_id") or f"single-{submission.id}")
        referrals = list_submission_referrals(db, submission.id)
        # First referral is the initial send; later ones mean the recipient referred onward.
        onward_referrals = referrals[1:] if len(referrals) > 1 else []
        if submission.status in {"approved", "rejected"}:
            display_status = submission.status
        elif onward_referrals:
            display_status = "referred"
        else:
            display_status = submission.status or "submitted"

        referred_to_name = None
        if onward_referrals:
            last = onward_referrals[-1]
            referred_user = db.query(User).filter(User.id == last.to_user_id).first()
            referred_to_name = (
                (referred_user.display_name or referred_user.username)
                if referred_user
                else None
            )

        recipient_comment = str(data.get("recipient_comment") or "")
        if referrals:
            recipient_user = (
                db.query(User).filter(User.id == referrals[0].to_user_id).first()
            )
            recipient = {
                "user_id": referrals[0].to_user_id,
                "display_name": (
                    (recipient_user.display_name or recipient_user.username)
                    if recipient_user
                    else data.get("recipient_name") or "نامشخص"
                ),
                "status": display_status,
                "status_updated_at": submission.status_updated_at,
                "submission_id": submission.id,
                "referred_to": referred_to_name,
                "comment": recipient_comment,
            }
        else:
            recipient = {
                "user_id": data.get("recipient_id"),
                "display_name": data.get("recipient_name") or "نامشخص",
                "status": display_status,
                "status_updated_at": submission.status_updated_at,
                "submission_id": submission.id,
                "referred_to": referred_to_name,
                "comment": recipient_comment,
            }

        if batch_id not in groups:
            sender = senders.get(submission.user_id)
            names = attachment_names_from_submission(submission)
            letter_sender = str(data.get("sender") or "")
            letter_sender_detail = str(data.get("sender_detail") or "")
            groups[batch_id] = {
                "batch_id": batch_id,
                "subject": submission.subject,
                "description": data.get("description") or "",
                "letter_number": (
                    str(data.get("letter_number") or "")
                    if stored_letter_type == "external"
                    else ""
                ),
                "system_letter_number": str(data.get("system_letter_number") or ""),
                "letter_type": stored_letter_type,
                "needs_reply": str(data.get("needs_reply") or ""),
                "needs_action": str(data.get("needs_action") or ""),
                "due_date": str(data.get("due_date") or ""),
                "sender": letter_sender,
                "sender_detail": letter_sender_detail,
                "attachment_name": names[0] if names else None,
                "attachment_names": names,
                "created_at": submission.created_at,
                "sent_by": (sender.display_name or sender.username) if sender else "نامشخص",
                "sent_by_id": submission.user_id,
                "recipients": [],
            }
            order.append(batch_id)
        groups[batch_id]["recipients"].append(recipient)

    return [groups[key] for key in order]
