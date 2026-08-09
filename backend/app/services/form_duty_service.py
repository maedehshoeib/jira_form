import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.birthday import user_display_name
from app.models.form_template import FormDutyAssignment
from app.models.submission import Submission, SubmissionInitialAssignee
from app.models.user import User
from app.services.form_access_service import (
    AccessTarget,
    access_catalog,
    parse_target_keys,
    target_key,
)


@dataclass(frozen=True)
class DutyEdge:
    user_id: int
    username: str
    display_name: str
    portal_department_id: str
    portal_department_title: str
    section_id: str
    section_title: str
    form_id: str

    @property
    def target_key(self) -> str:
        return target_key(self.portal_department_id, self.section_id, self.form_id)


def list_assignments(db: Session) -> list[DutyEdge]:
    rows = (
        db.query(FormDutyAssignment, User)
        .join(User, User.id == FormDutyAssignment.user_id)
        .order_by(User.display_name.asc(), User.username.asc(), FormDutyAssignment.id.asc())
        .all()
    )
    catalog = {target.key: target for target in access_catalog()}
    edges: list[DutyEdge] = []
    for assignment, user in rows:
        key = target_key(
            assignment.portal_department_id,
            assignment.section_id,
            assignment.form_id,
        )
        target = catalog.get(key)
        edges.append(
            DutyEdge(
                user_id=user.id,
                username=user.username,
                display_name=user_display_name(user) or user.username,
                portal_department_id=assignment.portal_department_id,
                portal_department_title=(
                    target.portal_department_title if target else assignment.portal_department_id
                ),
                section_id=assignment.section_id,
                section_title=target.section_title if target else assignment.section_id,
                form_id=assignment.form_id,
            )
        )
    return edges


def snapshot_submission_initial_assignees(
    db: Session,
    submission: Submission,
    *,
    explicit_user_ids: list[int] | None = None,
    assigned_at: datetime | None = None,
) -> list[SubmissionInitialAssignee]:
    """Persist the initial recipients of a submission without changing them later.

    Normal portal submissions resolve recipients from the form-duty mapping. Workflows
    that select their own recipients (such as management letters) pass explicit IDs.
    The helper only flushes so callers can keep submission creation atomic.
    """
    if submission.id is None:
        db.flush()

    if explicit_user_ids is None:
        candidate_ids = [
            row.user_id
            for row in db.query(FormDutyAssignment.user_id)
            .filter(
                FormDutyAssignment.portal_department_id
                == submission.department_id,
                FormDutyAssignment.section_id == submission.section_id,
                FormDutyAssignment.form_id == submission.form_id,
            )
            .order_by(FormDutyAssignment.id.asc())
            .all()
        ]
    else:
        candidate_ids = list(explicit_user_ids)

    candidate_ids = list(dict.fromkeys(candidate_ids))
    if not candidate_ids:
        return []

    valid_user_ids = {
        row.id
        for row in db.query(User.id).filter(User.id.in_(candidate_ids)).all()
    }
    existing_user_ids = {
        row.user_id
        for row in db.query(SubmissionInitialAssignee.user_id)
        .filter(SubmissionInitialAssignee.submission_id == submission.id)
        .all()
    }
    snapshot_time = assigned_at or submission.created_at or datetime.utcnow()
    snapshots = [
        SubmissionInitialAssignee(
            submission_id=submission.id,
            user_id=user_id,
            assigned_at=snapshot_time,
        )
        for user_id in candidate_ids
        if user_id in valid_user_ids and user_id not in existing_user_ids
    ]
    if snapshots:
        db.add_all(snapshots)
        db.flush()
    return snapshots


def backfill_submission_initial_assignees(db: Session) -> int:
    """Create missing snapshots and repair legacy management-letter batches."""
    from app.services.portal_service import (
        MANAGEMENT_LETTER_FORM_ID,
        MANAGEMENT_LETTER_SECTION,
        MANAGEMENT_WORKFLOW_ID,
    )

    created = 0
    # One logical management letter is stored as one submission per recipient.
    # Every sibling copy needs the same name-only initial-recipient snapshot.
    management_letters = (
        db.query(Submission)
        .filter(
            Submission.department_id == MANAGEMENT_WORKFLOW_ID,
            Submission.section_id == MANAGEMENT_LETTER_SECTION,
            Submission.form_id == MANAGEMENT_LETTER_FORM_ID,
        )
        .order_by(Submission.id.asc())
        .all()
    )
    batch_key_by_submission: dict[int, tuple[int, str]] = {}
    recipient_ids_by_batch: dict[tuple[int, str], list[int]] = {}
    for submission in management_letters:
        try:
            data = json.loads(submission.data or "{}")
        except (json.JSONDecodeError, TypeError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        batch_id = str(data.get("letter_batch_id") or "").strip()
        if not batch_id:
            batch_id = f"single-{submission.id}"
        batch_key = (submission.user_id, batch_id)
        batch_key_by_submission[submission.id] = batch_key

        raw_recipient_id = data.get("recipient_id")
        try:
            if isinstance(raw_recipient_id, bool):
                raise ValueError
            recipient_id = int(raw_recipient_id)
        except (TypeError, ValueError, OverflowError):
            continue
        if recipient_id <= 0:
            continue
        batch_recipient_ids = recipient_ids_by_batch.setdefault(batch_key, [])
        if recipient_id not in batch_recipient_ids:
            batch_recipient_ids.append(recipient_id)

    management_letter_ids = [submission.id for submission in management_letters]
    existing_by_submission: dict[int, set[int]] = {}
    if management_letter_ids:
        existing_snapshots = (
            db.query(SubmissionInitialAssignee)
            .filter(
                SubmissionInitialAssignee.submission_id.in_(management_letter_ids)
            )
            .all()
        )
        for row in existing_snapshots:
            existing_by_submission.setdefault(row.submission_id, set()).add(
                row.user_id
            )

    for submission in management_letters:
        recipient_ids = recipient_ids_by_batch.get(
            batch_key_by_submission[submission.id], []
        )
        existing_ids = existing_by_submission.get(submission.id, set())
        if not any(user_id not in existing_ids for user_id in recipient_ids):
            continue
        created += len(
            snapshot_submission_initial_assignees(
                db,
                submission,
                explicit_user_ids=recipient_ids,
                assigned_at=submission.created_at,
            )
        )

    submissions = (
        db.query(Submission)
        .outerjoin(
            SubmissionInitialAssignee,
            SubmissionInitialAssignee.submission_id == Submission.id,
        )
        .filter(SubmissionInitialAssignee.id.is_(None))
        .order_by(Submission.id.asc())
        .all()
    )
    for submission in submissions:
        if (
            submission.department_id == MANAGEMENT_WORKFLOW_ID
            and submission.section_id == MANAGEMENT_LETTER_SECTION
            and submission.form_id == MANAGEMENT_LETTER_FORM_ID
        ):
            continue

        created += len(
            snapshot_submission_initial_assignees(
                db,
                submission,
                assigned_at=submission.created_at,
            )
        )
    return created


def replace_assignments(
    db: Session, edges: list[tuple[int, str]]
) -> list[DutyEdge]:
    """Replace all duty edges. Each item is (user_id, target_key)."""
    if not edges:
        db.query(FormDutyAssignment).delete(synchronize_session=False)
        db.commit()
        return []

    user_ids = sorted({user_id for user_id, _ in edges})
    users = {
        user.id: user
        for user in db.query(User)
        .filter(User.id.in_(user_ids), User.is_active.is_(True))
        .all()
    }
    missing = [user_id for user_id in user_ids if user_id not in users]
    if missing:
        raise ValueError(f"Unknown or inactive user: {missing[0]}")

    target_keys = [key for _, key in edges]
    targets_by_key: dict[str, AccessTarget] = {
        target.key: target for target in parse_target_keys(target_keys)
    }

    seen: set[tuple[int, str]] = set()
    unique_edges: list[tuple[int, AccessTarget]] = []
    for user_id, key in edges:
        pair = (user_id, key)
        if pair in seen:
            continue
        seen.add(pair)
        unique_edges.append((user_id, targets_by_key[key]))

    db.query(FormDutyAssignment).delete(synchronize_session=False)
    db.add_all(
        [
            FormDutyAssignment(
                user_id=user_id,
                portal_department_id=target.portal_department_id,
                section_id=target.section_id,
                form_id=target.form_id,
            )
            for user_id, target in unique_edges
        ]
    )
    db.commit()
    return list_assignments(db)


def list_user_duty_assignments(db: Session, user_id: int) -> list[FormDutyAssignment]:
    return (
        db.query(FormDutyAssignment)
        .filter(FormDutyAssignment.user_id == user_id)
        .all()
    )


def user_handles_target(
    db: Session,
    user_id: int,
    portal_department_id: str,
    section_id: str,
    form_id: str,
) -> bool:
    return (
        db.query(FormDutyAssignment.id)
        .filter(
            FormDutyAssignment.user_id == user_id,
            FormDutyAssignment.portal_department_id == portal_department_id,
            FormDutyAssignment.section_id == section_id,
            FormDutyAssignment.form_id == form_id,
        )
        .first()
        is not None
    )


def list_duty_submissions(
    db: Session,
    user_id: int,
    *,
    form_id: str | None = None,
    department_id: str | None = None,
    section_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Submission]:
    assignments = list_user_duty_assignments(db, user_id)
    if not assignments:
        return []

    conditions = [
        and_(
            Submission.department_id == assignment.portal_department_id,
            Submission.section_id == assignment.section_id,
            Submission.form_id == assignment.form_id,
        )
        for assignment in assignments
    ]
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
