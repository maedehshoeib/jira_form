"""Inbox notifications for task reminders, deadlines, and completions."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.timezone import format_tehran_datetime, utc_now
from app.models.submission import (
    Submission,
    SubmissionReminder,
    SubmissionStatusHistory,
    SubmissionView,
)
from app.schemas.submission import (
    TaskInboxNotificationItem,
    TaskInboxNotificationResponse,
)
from app.services.base import BaseService
from app.services.task_workflow_service import _task_view_conditions


def _reminder_kind(message: str) -> str:
    text = (message or "").strip()
    if "مهلت" in text:
        return "deadline"
    return "reminder"


def _reminder_message(message: str, subject: str) -> str:
    cleaned = (message or "").strip()
    if cleaned:
        return cleaned
    label = subject.strip() or "وظیفه"
    return f"یادآوری برای پیگیری «{label}»"


class TaskNotificationService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_inbox(
        self, user_id: int, *, limit: int = 40
    ) -> TaskInboxNotificationResponse:
        ranked: list[tuple[datetime, TaskInboxNotificationItem]] = []
        ranked.extend(self._unread_reminders(user_id, limit=limit))
        ranked.extend(self._unread_completions(user_id, limit=limit))
        ranked.sort(key=lambda row: row[0], reverse=True)
        items = [item for _created_at, item in ranked[:limit]]
        return TaskInboxNotificationResponse(count=len(items), items=items)

    def _unread_reminders(
        self, user_id: int, *, limit: int
    ) -> list[tuple[datetime, TaskInboxNotificationItem]]:
        now = utc_now()
        rows = (
            self.db.query(SubmissionReminder, Submission, SubmissionView)
            .join(Submission, Submission.id == SubmissionReminder.submission_id)
            .outerjoin(
                SubmissionView,
                and_(
                    SubmissionView.submission_id == Submission.id,
                    SubmissionView.user_id == user_id,
                ),
            )
            .filter(
                SubmissionReminder.recipient_id == user_id,
                SubmissionReminder.created_at <= now,
                or_(
                    SubmissionView.id.is_(None),
                    SubmissionReminder.created_at > SubmissionView.last_viewed_at,
                ),
            )
            .order_by(SubmissionReminder.created_at.desc())
            .limit(limit)
            .all()
        )
        items: list[tuple[datetime, TaskInboxNotificationItem]] = []
        for reminder, submission, _view in rows:
            subject = (submission.subject or "").strip() or submission.form_id
            items.append(
                (
                    reminder.created_at,
                    TaskInboxNotificationItem(
                        id=f"reminder:{reminder.id}",
                        kind=_reminder_kind(reminder.message),
                        submission_id=submission.id,
                        subject=subject,
                        message=_reminder_message(reminder.message, subject),
                        created_at=format_tehran_datetime(reminder.created_at),
                    ),
                )
            )
        return items

    def _unread_completions(
        self, user_id: int, *, limit: int
    ) -> list[tuple[datetime, TaskInboxNotificationItem]]:
        conditions = _task_view_conditions(self.db, user_id)
        if not conditions:
            return []
        rows = (
            self.db.query(SubmissionStatusHistory, Submission, SubmissionView)
            .join(Submission, Submission.id == SubmissionStatusHistory.submission_id)
            .outerjoin(
                SubmissionView,
                and_(
                    SubmissionView.submission_id == Submission.id,
                    SubmissionView.user_id == user_id,
                ),
            )
            .filter(
                or_(*conditions),
                SubmissionStatusHistory.to_status == "approved",
                SubmissionStatusHistory.changed_by_id != user_id,
                or_(
                    SubmissionView.id.is_(None),
                    SubmissionStatusHistory.created_at > SubmissionView.last_viewed_at,
                ),
            )
            .order_by(SubmissionStatusHistory.created_at.desc())
            .limit(limit)
            .all()
        )
        items: list[tuple[datetime, TaskInboxNotificationItem]] = []
        seen_submissions: set[int] = set()
        for history, submission, _view in rows:
            if submission.id in seen_submissions:
                continue
            seen_submissions.add(submission.id)
            subject = (submission.subject or "").strip() or submission.form_id
            items.append(
                (
                    history.created_at,
                    TaskInboxNotificationItem(
                        id=f"completed:{history.id}",
                        kind="completed",
                        submission_id=submission.id,
                        subject=subject,
                        message=f"وظیفه «{subject}» انجام شد.",
                        created_at=format_tehran_datetime(history.created_at),
                    ),
                )
            )
        return items
