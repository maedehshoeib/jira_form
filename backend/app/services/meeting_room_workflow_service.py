import json
import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.submission import (
    Submission,
    SubmissionInitialAssignee,
    SubmissionReferral,
    SubmissionStatusHistory,
)
from app.models.user import User
from app.services.form_duty_service import snapshot_submission_initial_assignees
from app.services.portal_service import (
    MEETING_ROOM_DEPARTMENT_ID,
    MEETING_ROOM_FORM_ID,
    MEETING_ROOM_SECTION_ID,
)


APPROVER_SURNAMES = ("پناهی", "بشیری", "عباسی")
WORKFLOW_DATA_KEY = "_meeting_room_workflow"
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def is_meeting_room_submission(submission: Submission) -> bool:
    return (
        submission.form_id == MEETING_ROOM_FORM_ID
        and submission.department_id == MEETING_ROOM_DEPARTMENT_ID
        and submission.section_id == MEETING_ROOM_SECTION_ID
    )


def _normalize_name(value: str) -> str:
    return " ".join(
        (value or "")
        .replace("ي", "ی")
        .replace("ى", "ی")
        .replace("ك", "ک")
        .split()
    )


def resolve_meeting_room_approvers(
    db: Session,
    surnames: tuple[str, ...] = APPROVER_SURNAMES,
) -> list[User]:
    users = db.query(User).filter(User.is_active.is_(True)).all()
    approvers: list[User] = []
    for surname in surnames:
        matches = [
            user
            for user in users
            if _normalize_name(user.display_name).endswith(surname)
            or _normalize_name(user.username).endswith(surname)
        ]
        if not matches:
            raise ValueError(f"کاربر تاییدکننده «{surname}» یافت نشد یا غیرفعال است.")
        if len(matches) > 1:
            raise ValueError(f"بیش از یک کاربر فعال با نام خانوادگی «{surname}» یافت شد.")
        approvers.append(matches[0])
    return approvers


def prepare_meeting_room_data(
    db: Session,
    form_data: dict,
) -> tuple[dict, list[User]]:
    required_fields = {
        "requester": "درخواست‌کننده",
        "subject": "موضوع جلسه",
        "participant_scope": "شرکت‌کنندگان",
        "participant_details": "شرکت‌کنندگان (نام و سمت)",
        "meeting_date": "تاریخ جلسه",
        "start_time": "ساعت شروع",
        "end_time": "ساعت پایان",
        "needs_catering": "نیاز به پذیرایی",
    }
    for key, label in required_fields.items():
        if not str(form_data.get(key) or "").strip():
            raise ValueError(f"تکمیل فیلد «{label}» الزامی است.")

    if form_data["participant_scope"] not in {"داخلی", "خارجی"}:
        raise ValueError("نوع شرکت‌کنندگان نامعتبر است.")
    if form_data["needs_catering"] not in {"دارد", "ندارد"}:
        raise ValueError("گزینه نیاز به پذیرایی نامعتبر است.")
    if form_data["needs_catering"] == "دارد" and not str(
        form_data.get("catering_type") or ""
    ).strip():
        raise ValueError("تکمیل فیلد «نوع پذیرایی» الزامی است.")

    start_time = str(form_data["start_time"])
    end_time = str(form_data["end_time"])
    if not TIME_PATTERN.fullmatch(start_time) or not TIME_PATTERN.fullmatch(end_time):
        raise ValueError("ساعت جلسه نامعتبر است.")
    if start_time >= end_time:
        raise ValueError("ساعت پایان باید بعد از ساعت شروع باشد.")

    approver_surnames = (
        APPROVER_SURNAMES
        if form_data["needs_catering"] == "دارد"
        else APPROVER_SURNAMES[:1]
    )
    approvers = resolve_meeting_room_approvers(db, approver_surnames)
    form_data[WORKFLOW_DATA_KEY] = {
        "approver_ids": [user.id for user in approvers],
        "approver_names": [user.display_name or user.username for user in approvers],
        "current_step": 0,
        "approved_by_ids": [],
    }
    return form_data, approvers


def initialize_meeting_room_workflow(
    db: Session,
    submission: Submission,
    requester: User,
    approvers: list[User],
) -> None:
    snapshot_submission_initial_assignees(
        db,
        submission,
        explicit_user_ids=[user.id for user in approvers],
    )
    db.add(
        SubmissionReferral(
            submission_id=submission.id,
            from_user_id=requester.id,
            to_user_id=approvers[0].id,
            note="مرحله اول تایید رزرو اتاق جلسات",
        )
    )
    db.flush()


def meeting_room_workflow_state(submission: Submission) -> dict | None:
    if not is_meeting_room_submission(submission):
        return None
    try:
        data = json.loads(submission.data or "{}")
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    state = data.get(WORKFLOW_DATA_KEY)
    return state if isinstance(state, dict) else None


def active_meeting_room_approver_id(submission: Submission) -> int | None:
    state = meeting_room_workflow_state(submission)
    if not state or submission.status in {"approved", "rejected"}:
        return None
    approver_ids = state.get("approver_ids")
    step = state.get("current_step")
    if not isinstance(approver_ids, list) or not isinstance(step, int):
        return None
    if step < 0 or step >= len(approver_ids):
        return None
    try:
        return int(approver_ids[step])
    except (TypeError, ValueError):
        return None


def user_is_meeting_room_participant(
    db: Session,
    user_id: int,
    submission: Submission,
) -> bool:
    if not is_meeting_room_submission(submission):
        return False
    return (
        db.query(SubmissionInitialAssignee.id)
        .filter(
            SubmissionInitialAssignee.submission_id == submission.id,
            SubmissionInitialAssignee.user_id == user_id,
        )
        .first()
        is not None
    )


def approve_meeting_room_step(
    db: Session,
    actor: User,
    submission: Submission,
    note: str,
    *,
    attachment_path: str | None = None,
    attachment_name: str | None = None,
) -> Submission:
    state = meeting_room_workflow_state(submission)
    if not state:
        raise ValueError("اطلاعات گردش تایید رزرو اتاق جلسات ناقص است.")
    approver_ids = [int(value) for value in state.get("approver_ids", [])]
    step = int(state.get("current_step", 0))
    if not approver_ids or step >= len(approver_ids):
        raise ValueError("مرحله فعال تایید یافت نشد.")
    if not actor.is_admin and actor.id != approver_ids[step]:
        raise PermissionError("این درخواست در مرحله تایید شما نیست.")

    old_status = submission.status or "submitted"
    old_progress = int(submission.progress_percent or 0)
    approved_by_ids = list(state.get("approved_by_ids") or [])
    approved_by_ids.append(actor.id)
    next_step = step + 1
    is_final = next_step >= len(approver_ids)
    new_status = "approved" if is_final else "in_progress"
    new_progress = 100 if is_final else round((next_step / len(approver_ids)) * 100)
    now = datetime.utcnow()

    state["approved_by_ids"] = approved_by_ids
    state["current_step"] = next_step
    data = json.loads(submission.data or "{}")
    data[WORKFLOW_DATA_KEY] = state
    submission.data = json.dumps(data, ensure_ascii=False)
    submission.status = new_status
    submission.progress_percent = new_progress
    submission.status_updated_at = now
    submission.status_updated_by_id = actor.id
    submission.status_note = (note or "").strip()[:512]
    db.add(
        SubmissionStatusHistory(
            submission_id=submission.id,
            changed_by_id=actor.id,
            from_status=old_status,
            to_status=new_status,
            from_progress_percent=old_progress,
            to_progress_percent=new_progress,
            note=submission.status_note,
            attachment_path=attachment_path,
            attachment_name=attachment_name,
            created_at=now,
        )
    )
    if not is_final:
        db.add(
            SubmissionReferral(
                submission_id=submission.id,
                from_user_id=actor.id,
                to_user_id=approver_ids[next_step],
                note=f"تایید مرحله {next_step} و ارسال به تاییدکننده بعدی",
            )
        )
    db.commit()
    db.refresh(submission)
    return submission
