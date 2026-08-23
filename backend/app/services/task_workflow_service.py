from datetime import datetime
from pathlib import Path

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.submission import (
    Submission,
    SubmissionCcRecipient,
    SubmissionComment,
    SubmissionCommentMention,
    SubmissionInitialAssignee,
    SubmissionReferral,
    SubmissionReminder,
    SubmissionStatusHistory,
    SubmissionView,
)
from app.models.user import User
from app.services.form_duty_service import list_user_duty_assignments, user_handles_target

ALLOWED_TASK_STATUSES = {"approved", "rejected", "submitted", "in_progress"}
TERMINAL_TASK_STATUSES = {"approved", "rejected"}


def user_is_referral_recipient(db: Session, user_id: int, submission_id: int) -> bool:
    return (
        db.query(SubmissionReferral.id)
        .filter(
            SubmissionReferral.submission_id == submission_id,
            SubmissionReferral.to_user_id == user_id,
        )
        .first()
        is not None
    )


def user_can_access_task(db: Session, user: User, submission: Submission) -> bool:
    if user.is_admin:
        return True
    if user_handles_target(
        db,
        user.id,
        submission.department_id,
        submission.section_id,
        submission.form_id,
    ):
        return True
    return user_is_referral_recipient(db, user.id, submission.id)


def user_is_cc_recipient(db: Session, user_id: int, submission_id: int) -> bool:
    return (
        db.query(SubmissionCcRecipient.id)
        .filter(
            SubmissionCcRecipient.submission_id == submission_id,
            SubmissionCcRecipient.user_id == user_id,
        )
        .first()
        is not None
    )


def user_can_view_task(db: Session, user: User, submission: Submission) -> bool:
    return user_can_access_task(db, user, submission) or user_is_cc_recipient(
        db, user.id, submission.id
    )


def _task_action_conditions(db: Session, user_id: int):
    assignments = list_user_duty_assignments(db, user_id)
    conditions = [
        and_(
            Submission.department_id == assignment.portal_department_id,
            Submission.section_id == assignment.section_id,
            Submission.form_id == assignment.form_id,
        )
        for assignment in assignments
    ]
    referred_ids = [
        row.submission_id
        for row in db.query(SubmissionReferral.submission_id)
        .filter(SubmissionReferral.to_user_id == user_id)
        .distinct()
        .all()
    ]
    if referred_ids:
        conditions.append(Submission.id.in_(referred_ids))
    return conditions


def _task_view_conditions(db: Session, user_id: int):
    conditions = _task_action_conditions(db, user_id)
    cc_ids = [
        row.submission_id
        for row in db.query(SubmissionCcRecipient.submission_id)
        .filter(SubmissionCcRecipient.user_id == user_id)
        .distinct()
        .all()
    ]
    if cc_ids:
        conditions.append(Submission.id.in_(cc_ids))
    return conditions


def list_task_submissions(
    db: Session,
    user_id: int,
    *,
    form_id: str | None = None,
    department_id: str | None = None,
    section_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Submission]:
    conditions = _task_view_conditions(db, user_id)
    if not conditions:
        return []

    query = db.query(Submission).filter(or_(*conditions)).order_by(
        Submission.created_at.desc()
    )
    if form_id:
        query = query.filter(Submission.form_id == form_id)
    if department_id:
        query = query.filter(Submission.department_id == department_id)
    if section_id:
        query = query.filter(Submission.section_id == section_id)
    return query.offset(offset).limit(limit).all()


def list_pending_task_ids(db: Session, user_id: int) -> list[int]:
    """IDs of non-terminal tasks the user can still act on."""
    conditions = _task_action_conditions(db, user_id)
    if not conditions:
        return []
    rows = (
        db.query(Submission.id)
        .filter(
            or_(*conditions),
            Submission.status.in_({"submitted", "in_progress"}),
        )
        .order_by(Submission.created_at.desc())
        .all()
    )
    return [row.id for row in rows]


def list_unseen_task_ids(db: Session, user_id: int) -> list[int]:
    """IDs of accessible tasks not opened since their latest referral."""
    conditions = _task_view_conditions(db, user_id)
    if not conditions:
        return []
    newer_referral_exists = (
        db.query(SubmissionReferral.id)
        .filter(
            SubmissionReferral.submission_id == Submission.id,
            SubmissionReferral.to_user_id == user_id,
            SubmissionReferral.created_at > SubmissionView.last_viewed_at,
        )
        .exists()
    )
    newer_cc_exists = (
        db.query(SubmissionCcRecipient.id)
        .filter(
            SubmissionCcRecipient.submission_id == Submission.id,
            SubmissionCcRecipient.user_id == user_id,
            SubmissionCcRecipient.created_at > SubmissionView.last_viewed_at,
        )
        .exists()
    )
    newer_comment_exists = (
        db.query(SubmissionComment.id)
        .filter(
            SubmissionComment.submission_id == Submission.id,
            SubmissionComment.author_id != user_id,
            SubmissionComment.created_at > SubmissionView.last_viewed_at,
        )
        .exists()
    )
    newer_reminder_exists = (
        db.query(SubmissionReminder.id)
        .filter(
            SubmissionReminder.submission_id == Submission.id,
            SubmissionReminder.recipient_id == user_id,
            SubmissionReminder.created_at > SubmissionView.last_viewed_at,
        )
        .exists()
    )
    rows = (
        db.query(Submission.id)
        .outerjoin(
            SubmissionView,
            and_(
                SubmissionView.submission_id == Submission.id,
                SubmissionView.user_id == user_id,
            ),
        )
        .filter(
            or_(*conditions),
            or_(
                SubmissionView.id.is_(None),
                newer_referral_exists,
                newer_cc_exists,
                newer_comment_exists,
                newer_reminder_exists,
            ),
        )
        .order_by(Submission.created_at.desc())
        .all()
    )
    return [row.id for row in rows]


def mark_task_viewed(
    db: Session,
    actor: User,
    submission: Submission,
) -> SubmissionView:
    if not user_can_view_task(db, actor, submission):
        raise PermissionError("شما به این وظیفه دسترسی ندارید.")

    now = datetime.utcnow()
    view = (
        db.query(SubmissionView)
        .filter(
            SubmissionView.submission_id == submission.id,
            SubmissionView.user_id == actor.id,
        )
        .first()
    )
    if view is None:
        view = SubmissionView(
            submission_id=submission.id,
            user_id=actor.id,
            first_viewed_at=now,
            last_viewed_at=now,
        )
        db.add(view)
    else:
        view.last_viewed_at = now
    db.commit()
    db.refresh(view)
    return view


def derive_workflow_status(
    submission: Submission,
    *,
    has_referrals: bool,
    has_views: bool,
) -> str:
    """Return the sender-facing lifecycle stage in deterministic precedence."""
    if submission.status == "approved":
        return "completed"
    if submission.status == "rejected":
        return "rejected"
    if submission.status == "in_progress":
        return "in_progress"
    if has_referrals:
        return "referred"
    if has_views:
        return "seen"
    return "unseen"


def list_submission_referrals(
    db: Session, submission_id: int
) -> list[SubmissionReferral]:
    return (
        db.query(SubmissionReferral)
        .filter(SubmissionReferral.submission_id == submission_id)
        .order_by(SubmissionReferral.created_at.asc(), SubmissionReferral.id.asc())
        .all()
    )


def set_task_status(
    db: Session,
    actor: User,
    submission_id: int,
    status: str,
    note: str = "",
    progress_percent: int | None = None,
    *,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
) -> Submission:
    if status not in ALLOWED_TASK_STATUSES:
        raise ValueError("وضعیت نامعتبر است.")

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise LookupError("درخواست یافت نشد")
    if not user_can_access_task(db, actor, submission):
        raise PermissionError("شما به این وظیفه دسترسی ندارید.")
    old_status = submission.status or "submitted"
    old_progress = int(submission.progress_percent or 0)
    if progress_percent is not None and not 0 <= progress_percent <= 100:
        raise ValueError("درصد پیشرفت باید بین صفر تا صد باشد.")
    if status == "approved":
        new_progress = 100
    elif status == "submitted":
        new_progress = 0
    elif status == "in_progress":
        new_progress = old_progress if progress_percent is None else progress_percent
        if new_progress >= 100:
            raise ValueError("برای پیشرفت صد درصد، وضعیت را انجام‌شده ثبت کنید.")
    else:
        new_progress = old_progress if progress_percent is None else progress_percent

    cleaned_note = (note or "").strip()[:512]
    cleaned_attachment_path = (attachment_path or "").strip() or None
    cleaned_attachment_name = (attachment_name or "").strip()[:256] or None
    if cleaned_attachment_path and not cleaned_attachment_name:
        cleaned_attachment_name = Path(cleaned_attachment_path).name
    if status == "submitted":
        cleaned_attachment_path = None
        cleaned_attachment_name = None
    if (
        old_status == status
        and old_progress == new_progress
        and not cleaned_note
        and not cleaned_attachment_path
    ):
        return submission

    submission.status = status
    submission.progress_percent = new_progress
    submission.status_updated_at = datetime.utcnow()
    submission.status_updated_by_id = actor.id
    if status == "submitted":
        submission.status_note = ""
    else:
        submission.status_note = cleaned_note
    db.add(
        SubmissionStatusHistory(
            submission_id=submission.id,
            changed_by_id=actor.id,
            from_status=old_status,
            to_status=status,
            from_progress_percent=old_progress,
            to_progress_percent=new_progress,
            note=submission.status_note,
            attachment_path=cleaned_attachment_path,
            attachment_name=cleaned_attachment_name,
            created_at=submission.status_updated_at,
        )
    )
    db.commit()
    db.refresh(submission)
    return submission


def refer_task(
    db: Session,
    actor: User,
    submission_id: int,
    to_user_id: int,
    note: str = "",
    *,
    allow_repeat: bool = False,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
    cc_user_ids: list[int] | None = None,
) -> SubmissionReferral:
    referrals = refer_tasks(
        db,
        actor,
        submission_id,
        [to_user_id],
        note,
        allow_repeat=allow_repeat,
        attachment_path=attachment_path,
        attachment_name=attachment_name,
        cc_user_ids=cc_user_ids,
    )
    return referrals[0]


def refer_tasks(
    db: Session,
    actor: User,
    submission_id: int,
    to_user_ids: list[int],
    note: str = "",
    *,
    allow_repeat: bool = False,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
    cc_user_ids: list[int] | None = None,
) -> list[SubmissionReferral]:
    unique_ids: list[int] = []
    for user_id in to_user_ids:
        if user_id not in unique_ids:
            unique_ids.append(user_id)
    if not unique_ids:
        raise ValueError("حداقل یک گیرنده برای ارجاع لازم است.")

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise LookupError("درخواست یافت نشد")
    if not user_can_access_task(db, actor, submission):
        raise PermissionError("شما به این وظیفه دسترسی ندارید.")
    if submission.status in TERMINAL_TASK_STATUSES:
        raise ValueError("پس از تایید یا رد، امکان ارجاع وجود ندارد.")
    if any(user_id == actor.id for user_id in unique_ids):
        raise ValueError("نمی‌توانید درخواست را به خودتان ارجاع دهید.")

    unique_cc_ids: list[int] = []
    for user_id in cc_user_ids or []:
        if user_id not in unique_cc_ids and user_id not in unique_ids:
            unique_cc_ids.append(user_id)
    if actor.id in unique_cc_ids:
        raise ValueError("You cannot mention yourself as a CC recipient.")

    targets = {
        user.id: user
        for user in db.query(User)
        .filter(User.id.in_(unique_ids), User.is_active.is_(True))
        .all()
    }
    missing = [user_id for user_id in unique_ids if user_id not in targets]
    if missing:
        raise ValueError("کاربر مقصد یافت نشد یا غیرفعال است.")

    cc_targets = {
        user.id: user
        for user in db.query(User)
        .filter(User.id.in_(unique_cc_ids), User.is_active.is_(True))
        .all()
    }
    if len(cc_targets) != len(unique_cc_ids):
        raise ValueError("One or more CC recipients were not found or are inactive.")

    existing_ids = {
        row.to_user_id
        for row in db.query(SubmissionReferral.to_user_id)
        .filter(
            SubmissionReferral.submission_id == submission.id,
            SubmissionReferral.to_user_id.in_(unique_ids),
        )
        .all()
    }
    if existing_ids and not allow_repeat:
        raise ValueError("این درخواست قبلاً به یکی از کاربران انتخاب‌شده ارجاع شده است.")

    cleaned_note = (note or "").strip()[:512]
    cleaned_attachment_path = (attachment_path or "").strip() or None
    cleaned_attachment_name = (attachment_name or "").strip()[:256] or None
    if cleaned_attachment_path and not cleaned_attachment_name:
        cleaned_attachment_name = Path(cleaned_attachment_path).name
    referrals = [
        SubmissionReferral(
            submission_id=submission.id,
            from_user_id=actor.id,
            to_user_id=user_id,
            note=cleaned_note,
            attachment_path=cleaned_attachment_path,
            attachment_name=cleaned_attachment_name,
        )
        for user_id in unique_ids
    ]
    db.add_all(referrals)
    existing_cc_ids = (
        {
            row.user_id
            for row in db.query(SubmissionCcRecipient.user_id)
            .filter(
                SubmissionCcRecipient.submission_id == submission.id,
                SubmissionCcRecipient.user_id.in_(unique_cc_ids),
            )
            .all()
        }
        if unique_cc_ids
        else set()
    )
    db.add_all(
        [
            SubmissionCcRecipient(
                submission_id=submission.id,
                user_id=user_id,
                mentioned_by_id=actor.id,
            )
            for user_id in unique_cc_ids
            if user_id not in existing_cc_ids
        ]
    )
    db.commit()
    for referral in referrals:
        db.refresh(referral)
    return referrals


def list_colleagues(db: Session, exclude_user_id: int) -> list[User]:
    return (
        db.query(User)
        .filter(
            User.is_active.is_(True),
            User.id != exclude_user_id,
            User.is_admin.is_(False),
        )
        .order_by(User.display_name.asc(), User.username.asc())
        .all()
    )


def task_participant_ids(db: Session, submission: Submission) -> set[int]:
    """Return everyone allowed to take part in the task-card conversation."""
    ids = {submission.user_id}
    ids.update(
        row.user_id
        for row in db.query(SubmissionInitialAssignee.user_id)
        .filter(SubmissionInitialAssignee.submission_id == submission.id)
        .all()
    )
    for row in (
        db.query(SubmissionReferral.from_user_id, SubmissionReferral.to_user_id)
        .filter(SubmissionReferral.submission_id == submission.id)
        .all()
    ):
        ids.update((row.from_user_id, row.to_user_id))
    for row in (
        db.query(SubmissionCcRecipient.user_id, SubmissionCcRecipient.mentioned_by_id)
        .filter(SubmissionCcRecipient.submission_id == submission.id)
        .all()
    ):
        ids.update((row.user_id, row.mentioned_by_id))
    return ids


def user_can_join_conversation(
    db: Session, user: User, submission: Submission
) -> bool:
    return user.is_admin or user.id in task_participant_ids(db, submission)


def add_task_comment(
    db: Session,
    actor: User,
    submission: Submission,
    body: str,
    mention_user_ids: list[int] | None = None,
) -> SubmissionComment:
    if not user_can_join_conversation(db, actor, submission):
        raise PermissionError("You do not have access to this conversation.")
    cleaned_body = (body or "").strip()
    if not cleaned_body:
        raise ValueError("Message cannot be empty.")
    if len(cleaned_body) > 2000:
        raise ValueError("Message is too long.")
    allowed_ids = task_participant_ids(db, submission)
    mention_ids = list(dict.fromkeys(mention_user_ids or []))
    if any(user_id not in allowed_ids for user_id in mention_ids):
        raise ValueError("Only task participants can be mentioned.")
    comment = SubmissionComment(
        submission_id=submission.id,
        author_id=actor.id,
        body=cleaned_body,
    )
    db.add(comment)
    db.flush()
    db.add_all(
        [
            SubmissionCommentMention(comment_id=comment.id, user_id=user_id)
            for user_id in mention_ids
            if user_id != actor.id
        ]
    )
    db.commit()
    db.refresh(comment)
    return comment


def send_task_reminders(
    db: Session,
    actor: User,
    submission: Submission,
    message: str = "",
) -> list[SubmissionReminder]:
    if not actor.is_admin and submission.user_id != actor.id:
        raise PermissionError("Only the requester can send a reminder.")
    recipient_ids = {
        row.user_id
        for row in db.query(SubmissionInitialAssignee.user_id)
        .filter(SubmissionInitialAssignee.submission_id == submission.id)
        .all()
    }
    recipient_ids.update(
        row.to_user_id
        for row in db.query(SubmissionReferral.to_user_id)
        .filter(SubmissionReferral.submission_id == submission.id)
        .all()
    )
    recipient_ids.discard(actor.id)
    if not recipient_ids:
        raise ValueError("No assignee is available to remind.")
    cleaned_message = (message or "").strip()[:512]
    reminders = [
        SubmissionReminder(
            submission_id=submission.id,
            sender_id=actor.id,
            recipient_id=user_id,
            message=cleaned_message,
        )
        for user_id in sorted(recipient_ids)
    ]
    db.add_all(reminders)
    db.commit()
    for reminder in reminders:
        db.refresh(reminder)
    return reminders
