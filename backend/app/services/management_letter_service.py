import json
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.submission import Submission, SubmissionReferral
from app.models.user import User
from app.services.form_access_service import can_access_restricted_department
from app.services.portal_service import (
    MANAGEMENT_LETTER_FORM_ID,
    MANAGEMENT_LETTER_SECTION,
    MANAGEMENT_WORKFLOW_ID,
)
from app.services.task_workflow_service import list_submission_referrals


def user_can_use_management_workflow(db: Session, user: User) -> bool:
    return can_access_restricted_department(db, user, MANAGEMENT_WORKFLOW_ID)


def list_letter_recipients(db: Session, *, exclude_user_id: int | None = None) -> list[User]:
    query = db.query(User).filter(
        User.is_active.is_(True),
        User.is_letter_recipient.is_(True),
    )
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.order_by(User.display_name.asc(), User.username.asc()).all()


def _validate_recipients(db: Session, actor: User, recipient_ids: list[int]) -> list[User]:
    unique_ids = list(dict.fromkeys(recipient_ids))
    if not unique_ids:
        raise ValueError("حداقل یک گیرنده را انتخاب کنید.")
    if actor.id in unique_ids:
        raise ValueError("نمی‌توانید نامه را برای خودتان ارسال کنید.")

    recipients = (
        db.query(User)
        .filter(
            User.id.in_(unique_ids),
            User.is_active.is_(True),
            User.is_letter_recipient.is_(True),
        )
        .all()
    )
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


def create_management_letters(
    db: Session,
    *,
    actor: User,
    subject: str,
    description: str,
    recipient_ids: list[int],
    attachments: list[dict[str, str]] | None = None,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
) -> list[Submission]:
    if not user_can_use_management_workflow(db, actor):
        raise PermissionError("شما به گردش کار مدیریت دسترسی ندارید.")

    cleaned_subject = (subject or "").strip()
    cleaned_description = (description or "").strip()
    if not cleaned_subject:
        raise ValueError("موضوع نامه الزامی است.")
    if not cleaned_description:
        raise ValueError("توضیحات نامه الزامی است.")

    files = list(attachments or [])
    if not files and attachment_path and attachment_name:
        files = [{"name": attachment_name, "path": attachment_path}]

    recipients = _validate_recipients(db, actor, recipient_ids)
    batch_id = uuid.uuid4().hex
    submissions: list[Submission] = []
    first_path = files[0]["path"] if files else None
    first_name = files[0]["name"] if files else None

    for recipient in recipients:
        form_data: dict = {
            "subject": cleaned_subject,
            "description": cleaned_description,
            "letter_batch_id": batch_id,
            "recipient_id": recipient.id,
            "recipient_name": recipient.display_name or recipient.username,
        }
        if files:
            form_data["_attachments"] = files
            form_data["attachments"] = [item["name"] for item in files]
            form_data["attachment"] = first_name

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
        db.add(
            SubmissionReferral(
                submission_id=submission.id,
                from_user_id=actor.id,
                to_user_id=recipient.id,
                note="نامه مدیریت",
            )
        )
        submissions.append(submission)

    db.commit()
    for submission in submissions:
        db.refresh(submission)
    return submissions


def list_sent_letters(db: Session, user: User) -> list[dict]:
    if not user_can_use_management_workflow(db, user):
        raise PermissionError("شما به گردش کار مدیریت دسترسی ندارید.")

    query = db.query(Submission).filter(
        Submission.department_id == MANAGEMENT_WORKFLOW_ID,
        Submission.section_id == MANAGEMENT_LETTER_SECTION,
        Submission.form_id == MANAGEMENT_LETTER_FORM_ID,
    )
    if not user.is_admin:
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
            }
        else:
            recipient = {
                "user_id": data.get("recipient_id"),
                "display_name": data.get("recipient_name") or "نامشخص",
                "status": display_status,
                "status_updated_at": submission.status_updated_at,
                "submission_id": submission.id,
                "referred_to": referred_to_name,
            }

        if batch_id not in groups:
            sender = senders.get(submission.user_id)
            names = attachment_names_from_submission(submission)
            groups[batch_id] = {
                "batch_id": batch_id,
                "subject": submission.subject,
                "description": data.get("description") or "",
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
