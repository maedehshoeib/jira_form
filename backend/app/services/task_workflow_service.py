from datetime import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.submission import (
    Submission,
    SubmissionReferral,
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


def _task_access_conditions(db: Session, user_id: int):
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
    conditions = _task_access_conditions(db, user_id)
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
    conditions = _task_access_conditions(db, user_id)
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
    conditions = _task_access_conditions(db, user_id)
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
            or_(SubmissionView.id.is_(None), newer_referral_exists),
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
    if not user_can_access_task(db, actor, submission):
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
    if (
        old_status == status
        and old_progress == new_progress
        and not cleaned_note
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
) -> SubmissionReferral:
    referrals = refer_tasks(
        db,
        actor,
        submission_id,
        [to_user_id],
        note,
        allow_repeat=allow_repeat,
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

    targets = {
        user.id: user
        for user in db.query(User)
        .filter(User.id.in_(unique_ids), User.is_active.is_(True))
        .all()
    }
    missing = [user_id for user_id in unique_ids if user_id not in targets]
    if missing:
        raise ValueError("کاربر مقصد یافت نشد یا غیرفعال است.")

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
    referrals = [
        SubmissionReferral(
            submission_id=submission.id,
            from_user_id=actor.id,
            to_user_id=user_id,
            note=cleaned_note,
        )
        for user_id in unique_ids
    ]
    db.add_all(referrals)
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
