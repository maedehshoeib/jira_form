from datetime import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.submission import Submission, SubmissionReferral
from app.models.user import User
from app.services.form_duty_service import list_user_duty_assignments, user_handles_target

ALLOWED_TASK_STATUSES = {"approved", "rejected", "submitted"}


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
    """IDs of tasks the user can still act on (status=submitted)."""
    conditions = _task_access_conditions(db, user_id)
    if not conditions:
        return []
    rows = (
        db.query(Submission.id)
        .filter(or_(*conditions), Submission.status == "submitted")
        .order_by(Submission.created_at.desc())
        .all()
    )
    return [row.id for row in rows]


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
) -> Submission:
    if status not in ALLOWED_TASK_STATUSES:
        raise ValueError("وضعیت نامعتبر است.")

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise LookupError("درخواست یافت نشد")
    if not user_can_access_task(db, actor, submission):
        raise PermissionError("شما به این وظیفه دسترسی ندارید.")
    if submission.status == status and not note:
        return submission

    submission.status = status
    submission.status_updated_at = datetime.utcnow()
    submission.status_updated_by_id = actor.id
    cleaned_note = (note or "").strip()[:512]
    if status == "submitted":
        submission.status_note = ""
    else:
        submission.status_note = cleaned_note
    db.commit()
    db.refresh(submission)
    return submission


def refer_task(
    db: Session,
    actor: User,
    submission_id: int,
    to_user_id: int,
    note: str = "",
) -> SubmissionReferral:
    referrals = refer_tasks(db, actor, submission_id, [to_user_id], note)
    return referrals[0]


def refer_tasks(
    db: Session,
    actor: User,
    submission_id: int,
    to_user_ids: list[int],
    note: str = "",
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
    if submission.status != "submitted":
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
    if existing_ids:
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
