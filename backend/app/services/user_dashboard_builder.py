"""Per-user request, task, and organizational-letter analytics."""

import json
from collections import defaultdict

from sqlalchemy.orm import Session

from app.core.jalali import gregorian_to_jalali
from app.core.timezone import utc_naive_to_tehran
from app.models.submission import Submission
from app.models.user import User
from app.repositories import SubmissionRepository, UserRepository
from app.schemas.user_dashboard import (
    UserDashboardChartItem,
    UserDashboardLetters,
    UserDashboardResponse,
    UserDashboardSummary,
)
from app.services.admin_analytics_service import _form_title, _portal_department_title
from app.services.portal_service import MANAGEMENT_LETTER_FORM_ID
from app.services.task_workflow_service import is_letter_announcement, list_task_submissions

STATUS_LABELS = {
    "submitted": "اقدام‌نشده",
    "in_progress": "در حال انجام",
    "approved": "انجام‌شده",
    "rejected": "ردشده",
    "referred": "ارجاع‌شده",
}
LETTER_TYPE_LABELS = {"external": "برون‌سازمانی", "internal": "درون‌سازمانی"}
OPEN_STATUSES = {"submitted", "in_progress"}


def _data(submission: Submission) -> dict:
    try:
        value = json.loads(submission.data or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}
    return value if isinstance(value, dict) else {}


def _chart(counts: dict[str, int], limit: int | None = None):
    rows = [
        UserDashboardChartItem(label=label, value=value)
        for label, value in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        if value
    ]
    return rows[:limit] if limit else rows


def _status_counts(submissions: list[Submission]) -> dict[str, int]:
    result: dict[str, int] = defaultdict(int)
    for submission in submissions:
        result[STATUS_LABELS.get(submission.status, submission.status or "نامشخص")] += 1
    return result


def _monthly(submissions: list[Submission]):
    counts: dict[str, int] = defaultdict(int)
    for submission in submissions:
        date = utc_naive_to_tehran(submission.created_at).date()
        counts[gregorian_to_jalali(date)[:7]] += 1
    return [
        UserDashboardChartItem(label=label, value=counts[label])
        for label in sorted(counts)[-6:]
    ]


def build_user_dashboard(db: Session, user: User) -> UserDashboardResponse:
    submissions = SubmissionRepository(db)
    users_repository = UserRepository(db)
    requests = submissions.owned_by(user.id)
    tasks = list_task_submissions(db, user.id, limit=1_000_000)
    actionable_tasks = [item for item in tasks if not is_letter_announcement(item)]

    user_ids = {item.user_id for item in tasks}
    users = users_repository.by_ids(user_ids)
    requester_counts: dict[str, int] = defaultdict(int)
    requester_departments: dict[str, int] = defaultdict(int)
    for submission in actionable_tasks:
        submitter = users.get(submission.user_id)
        requester_counts[
            (submitter.display_name or submitter.username) if submitter else "کاربر حذف‌شده"
        ] += 1
        requester_departments[
            ((submitter.department or "").strip() or "بدون واحد") if submitter else "بدون واحد"
        ] += 1

    recipient_counts: dict[str, int] = defaultdict(int)
    request_ids = {item.id for item in requests}
    assignees = submissions.assignees_for(request_ids)
    seen: set[tuple[int, int]] = set()
    for assignee, recipient in assignees:
        key = (assignee.submission_id, assignee.user_id)
        if key not in seen and assignee.user_id != user.id:
            seen.add(key)
            recipient_counts[recipient.display_name or recipient.username] += 1

    request_departments: dict[str, int] = defaultdict(int)
    request_forms: dict[str, int] = defaultdict(int)
    for submission in requests:
        request_departments[_portal_department_title(submission.department_id)] += 1
        request_forms[_form_title(submission.form_id)] += 1

    sent_batches: dict[str, list[Submission]] = defaultdict(list)
    received_letters: list[Submission] = []
    for submission in requests:
        if submission.form_id == MANAGEMENT_LETTER_FORM_ID:
            data = _data(submission)
            batch_id = str(data.get("letter_batch_id") or f"single-{submission.id}")
            sent_batches[batch_id].append(submission)
    for submission in tasks:
        if submission.form_id != MANAGEMENT_LETTER_FORM_ID:
            continue
        data = _data(submission)
        try:
            recipient_id = int(data.get("recipient_id"))
        except (TypeError, ValueError):
            recipient_id = 0
        if recipient_id == user.id:
            received_letters.append(submission)

    sent_types: dict[str, int] = defaultdict(int)
    sent_statuses: dict[str, int] = defaultdict(int)
    for batch in sent_batches.values():
        letter_type = str(_data(batch[0]).get("letter_type") or "external")
        sent_types[LETTER_TYPE_LABELS.get(letter_type, letter_type)] += 1
        for submission in batch:
            status_label = (
                "رونوشت اطلاع‌رسانی"
                if is_letter_announcement(submission)
                else STATUS_LABELS.get(submission.status, submission.status)
            )
            sent_statuses[status_label] += 1
    received_types: dict[str, int] = defaultdict(int)
    received_statuses: dict[str, int] = defaultdict(int)
    for submission in received_letters:
        letter_type = str(_data(submission).get("letter_type") or "external")
        received_types[LETTER_TYPE_LABELS.get(letter_type, letter_type)] += 1
        status_label = (
            "رونوشت اطلاع‌رسانی"
            if is_letter_announcement(submission)
            else STATUS_LABELS.get(submission.status, submission.status)
        )
        received_statuses[status_label] += 1

    return UserDashboardResponse(
        user_name=user.display_name or user.username,
        summary=UserDashboardSummary(
            total_tasks=len(actionable_tasks),
            open_tasks=sum(item.status in OPEN_STATUSES for item in actionable_tasks),
            completed_tasks=sum(item.status == "approved" for item in actionable_tasks),
            total_requests=len(requests),
            open_requests=sum(item.status in OPEN_STATUSES for item in requests),
            completed_requests=sum(item.status == "approved" for item in requests),
            sent_letters=len(sent_batches),
            received_letters=len(received_letters),
        ),
        task_statuses=_chart(_status_counts(actionable_tasks)),
        request_statuses=_chart(_status_counts(requests)),
        top_requesters=_chart(requester_counts, 8),
        top_recipients=_chart(recipient_counts, 8),
        requester_departments=_chart(requester_departments, 8),
        request_departments=_chart(request_departments, 8),
        request_forms=_chart(request_forms, 8),
        monthly_tasks=_monthly(actionable_tasks),
        monthly_requests=_monthly(requests),
        letters=UserDashboardLetters(
            sent_by_type=_chart(sent_types), received_by_type=_chart(received_types),
            sent_by_status=_chart(sent_statuses), received_by_status=_chart(received_statuses),
        ),
    )
