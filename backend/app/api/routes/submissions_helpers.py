import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.reports_helpers import _format_dt, _verify_api_key
from app.core.deps import get_optional_user
from app.models.submission import (
    Submission,
    SubmissionInitialAssignee,
    SubmissionReferral,
    SubmissionStatusHistory,
    SubmissionView,
)
from app.models.user import User
from app.schemas.submission import (
    SubmissionAssigneeItem,
    SubmissionListItem,
    SubmissionReferralItem,
    SubmissionResponse,
    SubmissionTimelineItem,
)
from app.services.portal_service import DEPARTMENTS, FORM_TEMPLATES
from app.services.task_workflow_service import derive_workflow_status


def _parse_submission_data(raw: str) -> dict:
    try:
        data = json.loads(raw or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}
    parsed: dict = {}
    for key, value in data.items():
        if key in {"_report_id", "_attachments"}:
            continue
        if isinstance(value, str) and value.strip()[:1] in ("[", "{"):
            try:
                parsed[key] = json.loads(value)
            except json.JSONDecodeError:
                parsed[key] = value
        else:
            parsed[key] = value
    # Expose attachment names without filesystem paths.
    stored = data.get("_attachments")
    if isinstance(stored, list):
        names = [
            str(item.get("name"))
            for item in stored
            if isinstance(item, dict) and item.get("name")
        ]
        if names:
            parsed["attachments"] = names
    return parsed


def _attachment_names(submission: Submission) -> list[str]:
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
    public = data.get("attachments")
    if isinstance(public, list):
        names = [str(name) for name in public if name]
        if names:
            return names
    if submission.attachment_name:
        return [submission.attachment_name]
    return []


def _report_id_from_data(raw: str) -> int | None:
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return None
    report_id = data.get("_report_id")
    if report_id is None:
        return None
    try:
        return int(report_id)
    except (TypeError, ValueError):
        return None


def _form_title(form_id: str) -> str:
    form = FORM_TEMPLATES.get(form_id)
    return form.title if form else form_id


def _department_and_section_titles(
    department_id: str,
    section_id: str,
    submission_data: str | None = None,
) -> tuple[str, str]:
    from app.services.portal_service import (
        MANAGEMENT_LETTER_SECTION,
        MANAGEMENT_WORKFLOW_ID,
    )

    if department_id == MANAGEMENT_WORKFLOW_ID:
        letter_type = "external"
        try:
            stored_data = json.loads(submission_data or "{}")
            if (
                isinstance(stored_data, dict)
                and stored_data.get("letter_type") == "internal"
            ):
                letter_type = "internal"
        except (json.JSONDecodeError, TypeError):
            pass
        workflow_title = (
            "نامه‌های درون‌سازمانی"
            if letter_type == "internal"
            else "نامه‌های برون‌سازمانی"
        )
        section_title = (
            workflow_title
            if section_id == MANAGEMENT_LETTER_SECTION
            else section_id
        )
        return workflow_title, section_title or workflow_title

    for department in DEPARTMENTS:
        if department.id != department_id:
            continue
        section_title = next(
            (
                section.title
                for section in department.sections
                if section.id == section_id
            ),
            section_id,
        )
        return department.title, section_title
    return department_id, section_id


def _user_display(user: User | None) -> str:
    if not user:
        return "نامشخص"
    from app.core.birthday import user_display_name

    return user_display_name(user) or "نامشخص"


@dataclass
class SubmissionWorkflowContext:
    initial_assignees_by_submission: dict[
        int, list[SubmissionInitialAssignee]
    ]
    referrals_by_submission: dict[int, list[SubmissionReferral]]
    views_by_submission: dict[int, list[SubmissionView]]
    histories_by_submission: dict[int, list[SubmissionStatusHistory]]
    users_by_id: dict[int, User]
    viewer_user_id: int | None = None


def build_submission_workflow_context(
    db: Session,
    submissions: list[Submission],
    *,
    viewer_user_id: int | None = None,
    include_history: bool = False,
) -> SubmissionWorkflowContext:
    """Load list workflow data in a bounded number of queries."""
    submission_ids = [item.id for item in submissions]
    if not submission_ids:
        return SubmissionWorkflowContext(
            initial_assignees_by_submission={},
            referrals_by_submission={},
            views_by_submission={},
            histories_by_submission={},
            users_by_id={},
            viewer_user_id=viewer_user_id,
        )

    initial_assignees = (
        db.query(SubmissionInitialAssignee)
        .filter(SubmissionInitialAssignee.submission_id.in_(submission_ids))
        .order_by(
            SubmissionInitialAssignee.assigned_at.asc(),
            SubmissionInitialAssignee.id.asc(),
        )
        .all()
    )
    referrals = (
        db.query(SubmissionReferral)
        .filter(SubmissionReferral.submission_id.in_(submission_ids))
        .order_by(
            SubmissionReferral.created_at.asc(),
            SubmissionReferral.id.asc(),
        )
        .all()
    )
    views = (
        db.query(SubmissionView)
        .filter(SubmissionView.submission_id.in_(submission_ids))
        .order_by(SubmissionView.first_viewed_at.asc(), SubmissionView.id.asc())
        .all()
    )
    histories = (
        db.query(SubmissionStatusHistory)
        .filter(SubmissionStatusHistory.submission_id.in_(submission_ids))
        .order_by(
            SubmissionStatusHistory.created_at.asc(),
            SubmissionStatusHistory.id.asc(),
        )
        .all()
        if include_history
        else []
    )

    initial_assignees_by_submission: dict[
        int, list[SubmissionInitialAssignee]
    ] = defaultdict(list)
    referrals_by_submission: dict[int, list[SubmissionReferral]] = defaultdict(list)
    views_by_submission: dict[int, list[SubmissionView]] = defaultdict(list)
    histories_by_submission: dict[int, list[SubmissionStatusHistory]] = defaultdict(list)
    for row in initial_assignees:
        initial_assignees_by_submission[row.submission_id].append(row)
    for row in referrals:
        referrals_by_submission[row.submission_id].append(row)
    for row in views:
        views_by_submission[row.submission_id].append(row)
    for row in histories:
        histories_by_submission[row.submission_id].append(row)

    user_ids = {item.user_id for item in submissions}
    user_ids.update(row.user_id for row in initial_assignees)
    user_ids.update(
        item.status_updated_by_id
        for item in submissions
        if item.status_updated_by_id is not None
    )
    for row in referrals:
        user_ids.update((row.from_user_id, row.to_user_id))
    user_ids.update(row.user_id for row in views)
    user_ids.update(row.changed_by_id for row in histories)
    users = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(user_ids)).all()
    }
    return SubmissionWorkflowContext(
        initial_assignees_by_submission=dict(
            initial_assignees_by_submission
        ),
        referrals_by_submission=dict(referrals_by_submission),
        views_by_submission=dict(views_by_submission),
        histories_by_submission=dict(histories_by_submission),
        users_by_id=users,
        viewer_user_id=viewer_user_id,
    )


def _initial_assignee_items(
    context: SubmissionWorkflowContext,
    submission_id: int,
) -> list[SubmissionAssigneeItem]:
    items: list[SubmissionAssigneeItem] = []
    for row in context.initial_assignees_by_submission.get(submission_id, []):
        user = context.users_by_id.get(row.user_id)
        items.append(
            SubmissionAssigneeItem(
                user_id=row.user_id,
                username=user.username if user else "",
                display_name=_user_display(user),
                assigned_at=_format_dt(row.assigned_at),
            )
        )
    return items


def _referral_items(
    context: SubmissionWorkflowContext,
    submission_id: int,
) -> list[SubmissionReferralItem]:
    return [
        SubmissionReferralItem(
            id=row.id,
            from_user_id=row.from_user_id,
            from_user_name=_user_display(context.users_by_id.get(row.from_user_id)),
            to_user_id=row.to_user_id,
            to_user_name=_user_display(context.users_by_id.get(row.to_user_id)),
            note=row.note or "",
            created_at=_format_dt(row.created_at),
        )
        for row in context.referrals_by_submission.get(submission_id, [])
    ]


def _status_updated_by_name(
    context: SubmissionWorkflowContext,
    submission: Submission,
) -> str | None:
    if not submission.status_updated_by_id:
        return None
    return _user_display(context.users_by_id.get(submission.status_updated_by_id))


def _workflow_fields(
    context: SubmissionWorkflowContext,
    submission: Submission,
) -> tuple[str, bool, str | None, str | None]:
    referrals = context.referrals_by_submission.get(submission.id, [])
    views = context.views_by_submission.get(submission.id, [])
    viewer_view = next(
        (
            item
            for item in views
            if item.user_id == context.viewer_user_id
        ),
        None,
    )
    has_unseen_referral = bool(
        viewer_view
        and context.viewer_user_id is not None
        and any(
            referral.to_user_id == context.viewer_user_id
            and referral.created_at > viewer_view.last_viewed_at
            for referral in referrals
        )
    )
    first_viewed_at = (
        _format_dt(min(item.first_viewed_at for item in views))
        if views
        else None
    )
    last_viewed_at = (
        _format_dt(viewer_view.last_viewed_at)
        if viewer_view is not None
        else None
    )
    return (
        derive_workflow_status(
            submission,
            has_referrals=bool(referrals),
            has_views=bool(views),
        ),
        viewer_view is not None and not has_unseen_referral,
        first_viewed_at,
        last_viewed_at,
    )


def _submission_timeline(
    context: SubmissionWorkflowContext,
    submission: Submission,
) -> list[SubmissionTimelineItem]:
    events: list[tuple[datetime, str, SubmissionTimelineItem]] = []
    submitter = context.users_by_id.get(submission.user_id)
    submitted_event = SubmissionTimelineItem(
        id=f"submission:{submission.id}",
        event_type="submitted",
        created_at=_format_dt(submission.created_at),
        actor_id=submission.user_id,
        actor_name=_user_display(submitter),
        to_status="submitted",
        to_progress_percent=0,
        progress_percent=0,
    )
    events.append((submission.created_at, submitted_event.id, submitted_event))

    for view in context.views_by_submission.get(submission.id, []):
        event = SubmissionTimelineItem(
            id=f"view:{view.id}",
            event_type="viewed",
            created_at=_format_dt(view.first_viewed_at),
            actor_id=view.user_id,
            actor_name=_user_display(context.users_by_id.get(view.user_id)),
        )
        events.append((view.first_viewed_at, event.id, event))

    for referral in context.referrals_by_submission.get(submission.id, []):
        event = SubmissionTimelineItem(
            id=f"referral:{referral.id}",
            event_type="referred",
            created_at=_format_dt(referral.created_at),
            actor_id=referral.from_user_id,
            actor_name=_user_display(
                context.users_by_id.get(referral.from_user_id)
            ),
            to_user_id=referral.to_user_id,
            to_user_name=_user_display(
                context.users_by_id.get(referral.to_user_id)
            ),
            note=referral.note or "",
        )
        events.append((referral.created_at, event.id, event))

    histories = context.histories_by_submission.get(submission.id, [])
    for history in histories:
        event = SubmissionTimelineItem(
            id=f"status:{history.id}",
            event_type="status_changed",
            created_at=_format_dt(history.created_at),
            actor_id=history.changed_by_id,
            actor_name=_user_display(
                context.users_by_id.get(history.changed_by_id)
            ),
            from_status=history.from_status,
            to_status=history.to_status,
            from_progress_percent=history.from_progress_percent,
            to_progress_percent=history.to_progress_percent,
            progress_percent=history.to_progress_percent,
            note=history.note or "",
        )
        events.append((history.created_at, event.id, event))

    if (
        not histories
        and submission.status != "submitted"
        and submission.status_updated_at is not None
    ):
        legacy_event = SubmissionTimelineItem(
            id=f"status:legacy:{submission.id}",
            event_type="status_changed",
            created_at=_format_dt(submission.status_updated_at),
            actor_id=submission.status_updated_by_id,
            actor_name=(
                _user_display(
                    context.users_by_id.get(submission.status_updated_by_id)
                )
                if submission.status_updated_by_id
                else None
            ),
            from_status="submitted",
            to_status=submission.status,
            from_progress_percent=0,
            to_progress_percent=int(submission.progress_percent or 0),
            progress_percent=int(submission.progress_percent or 0),
            note=submission.status_note or "",
        )
        events.append(
            (submission.status_updated_at, legacy_event.id, legacy_event)
        )

    events.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in events]


def _submission_to_list_item(
    submission: Submission,
    user: User | None,
    *,
    db: Session | None = None,
    workflow_context: SubmissionWorkflowContext | None = None,
    can_act: bool = False,
) -> SubmissionListItem:
    context = workflow_context
    if context is None:
        context = (
            build_submission_workflow_context(db, [submission])
            if db is not None
            else SubmissionWorkflowContext(
                initial_assignees_by_submission={},
                referrals_by_submission={},
                views_by_submission={},
                histories_by_submission={},
                users_by_id={user.id: user} if user is not None else {},
            )
        )
    department_title, section_title = _department_and_section_titles(
        submission.department_id,
        submission.section_id,
        submission.data,
    )
    initial_assignees = _initial_assignee_items(context, submission.id)
    referrals = _referral_items(context, submission.id)
    workflow_status, is_read, first_viewed_at, last_viewed_at = (
        _workflow_fields(context, submission)
    )
    return SubmissionListItem(
        id=submission.id,
        form_id=submission.form_id,
        form_title=_form_title(submission.form_id),
        department_id=submission.department_id,
        department_title=department_title,
        section_id=submission.section_id,
        section_title=section_title,
        subject=submission.subject,
        status=submission.status,
        workflow_status=workflow_status,
        progress_percent=int(submission.progress_percent or 0),
        is_read=is_read,
        first_viewed_at=first_viewed_at,
        last_viewed_at=last_viewed_at,
        submitted_by=(user.display_name or user.username) if user else "نامشخص",
        submitted_by_username=user.username if user else "",
        attachment_name=submission.attachment_name,
        attachment_names=_attachment_names(submission),
        report_id=_report_id_from_data(submission.data),
        created_at=_format_dt(submission.created_at),
        status_updated_by=_status_updated_by_name(context, submission),
        status_updated_at=(
            _format_dt(submission.status_updated_at)
            if submission.status_updated_at
            else None
        ),
        status_note=submission.status_note or "",
        initial_assignees=initial_assignees,
        referrals=referrals,
        can_act=can_act,
    )


def _submission_to_response(
    submission: Submission,
    user: User | None,
    *,
    db: Session | None = None,
    workflow_context: SubmissionWorkflowContext | None = None,
    can_act: bool = False,
) -> SubmissionResponse:
    context = workflow_context
    if context is None:
        context = (
            build_submission_workflow_context(
                db,
                [submission],
                include_history=True,
            )
            if db is not None
            else SubmissionWorkflowContext(
                initial_assignees_by_submission={},
                referrals_by_submission={},
                views_by_submission={},
                histories_by_submission={},
                users_by_id={user.id: user} if user is not None else {},
            )
        )
    department_title, section_title = _department_and_section_titles(
        submission.department_id,
        submission.section_id,
        submission.data,
    )
    initial_assignees = _initial_assignee_items(context, submission.id)
    referrals = _referral_items(context, submission.id)
    workflow_status, is_read, first_viewed_at, last_viewed_at = (
        _workflow_fields(context, submission)
    )
    return SubmissionResponse(
        id=submission.id,
        form_id=submission.form_id,
        form_title=_form_title(submission.form_id),
        department_id=submission.department_id,
        department_title=department_title,
        section_id=submission.section_id,
        section_title=section_title,
        subject=submission.subject,
        status=submission.status,
        workflow_status=workflow_status,
        progress_percent=int(submission.progress_percent or 0),
        is_read=is_read,
        first_viewed_at=first_viewed_at,
        last_viewed_at=last_viewed_at,
        submitted_by=(user.display_name or user.username) if user else "نامشخص",
        submitted_by_username=user.username if user else "",
        attachment_name=submission.attachment_name,
        attachment_names=_attachment_names(submission),
        report_id=_report_id_from_data(submission.data),
        created_at=_format_dt(submission.created_at),
        data=_parse_submission_data(submission.data),
        status_updated_by=_status_updated_by_name(context, submission),
        status_updated_at=(
            _format_dt(submission.status_updated_at)
            if submission.status_updated_at
            else None
        ),
        status_note=submission.status_note or "",
        initial_assignees=initial_assignees,
        referrals=referrals,
        timeline=_submission_timeline(context, submission),
        can_act=can_act,
    )


def require_api_key_or_user(
    x_api_key: str | None = Header(default=None),
    current_user: User | None = Depends(get_optional_user),
):
    if _verify_api_key(x_api_key):
        return None
    if current_user:
        return current_user
    raise HTTPException(status_code=401, detail="دسترسی غیرمجاز")
