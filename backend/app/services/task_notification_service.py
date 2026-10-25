"""Inbox notifications for task reminders, deadlines, and completions."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.timezone import format_tehran_datetime, utc_now
from app.models.submission import (
    Submission,
    SubmissionComment,
    SubmissionReferral,
    SubmissionReminder,
    SubmissionStatusHistory,
    SubmissionView,
)
from app.models.user import User
from app.schemas.submission import (
    TaskInboxNotificationItem,
    TaskInboxNotificationResponse,
)
from app.services.base import BaseService
from app.services.task_workflow_service import (
    _task_view_conditions,
    is_letter_inbox_item,
)


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


def _person_name(user: User | None) -> str:
    if user is None:
        return "کاربر"
    return (user.display_name or user.username or "کاربر").strip() or "کاربر"


def _subject(submission: Submission) -> str:
    return (submission.subject or "").strip() or submission.form_id


def _inbox_item(
    *,
    item_id: str,
    kind: str,
    submission: Submission,
    message: str,
    created_at: datetime,
) -> TaskInboxNotificationItem:
    return TaskInboxNotificationItem(
        id=item_id,
        kind=kind,
        submission_id=submission.id,
        subject=_subject(submission),
        message=message,
        created_at=format_tehran_datetime(created_at),
        area="letter" if is_letter_inbox_item(submission) else "task",
    )


class TaskNotificationService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_inbox(
        self, user_id: int, *, limit: int = 40
    ) -> TaskInboxNotificationResponse:
        ranked: list[tuple[datetime, TaskInboxNotificationItem]] = []
        ranked.extend(self._unread_reminders(user_id, limit=limit))
        ranked.extend(self._unread_referrals(user_id, limit=limit))
        ranked.extend(self._unread_comments(user_id, limit=limit))
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
            subject = _subject(submission)
            items.append(
                (
                    reminder.created_at,
                    _inbox_item(
                        item_id=f"reminder:{reminder.id}",
                        kind=_reminder_kind(reminder.message),
                        submission=submission,
                        message=_reminder_message(reminder.message, subject),
                        created_at=reminder.created_at,
                    ),
                )
            )
        return items

    def _unread_referrals(
        self, user_id: int, *, limit: int
    ) -> list[tuple[datetime, TaskInboxNotificationItem]]:
        """Referrals that arrived after the assignee opened the task.

        The first delivery still uses the «وظایف من» badge. A later referral
        is a home-tab notification, same as a reminder.
        """
        rows = (
            self.db.query(SubmissionReferral, Submission, User)
            .join(Submission, Submission.id == SubmissionReferral.submission_id)
            .join(User, User.id == SubmissionReferral.from_user_id)
            .join(
                SubmissionView,
                and_(
                    SubmissionView.submission_id == Submission.id,
                    SubmissionView.user_id == user_id,
                ),
            )
            .filter(
                SubmissionReferral.to_user_id == user_id,
                SubmissionReferral.created_at > SubmissionView.last_viewed_at,
            )
            .order_by(SubmissionReferral.created_at.desc())
            .limit(limit)
            .all()
        )
        items: list[tuple[datetime, TaskInboxNotificationItem]] = []
        seen_submissions: set[int] = set()
        for referral, submission, sender in rows:
            if submission.id in seen_submissions or is_letter_inbox_item(submission):
                continue
            seen_submissions.add(submission.id)
            note = (referral.note or "").strip()
            message = f"{_person_name(sender)} این وظیفه را دوباره به شما ارجاع داد."
            if note:
                message = f"{message} {note}"
            items.append(
                (
                    referral.created_at,
                    _inbox_item(
                        item_id=f"referral:{referral.id}",
                        kind="referral",
                        submission=submission,
                        message=message,
                        created_at=referral.created_at,
                    ),
                )
            )
        return items

    def _unread_comments(
        self, user_id: int, *, limit: int
    ) -> list[tuple[datetime, TaskInboxNotificationItem]]:
        """Comments that arrived after the user opened the task."""
        conditions = _task_view_conditions(self.db, user_id)
        if not conditions:
            return []
        rows = (
            self.db.query(SubmissionComment, Submission, User)
            .join(Submission, Submission.id == SubmissionComment.submission_id)
            .join(User, User.id == SubmissionComment.author_id)
            .join(
                SubmissionView,
                and_(
                    SubmissionView.submission_id == Submission.id,
                    SubmissionView.user_id == user_id,
                ),
            )
            .filter(
                or_(*conditions),
                SubmissionComment.author_id != user_id,
                SubmissionComment.created_at > SubmissionView.last_viewed_at,
            )
            .order_by(SubmissionComment.created_at.desc())
            .limit(limit)
            .all()
        )
        items: list[tuple[datetime, TaskInboxNotificationItem]] = []
        seen_submissions: set[int] = set()
        for comment, submission, author in rows:
            if submission.id in seen_submissions or is_letter_inbox_item(submission):
                continue
            seen_submissions.add(submission.id)
            body = (comment.body or "").strip()
            author_name = _person_name(author)
            message = f"{author_name}: {body}" if body else f"پیام جدید از {author_name}"
            items.append(
                (
                    comment.created_at,
                    _inbox_item(
                        item_id=f"comment:{comment.id}",
                        kind="comment",
                        submission=submission,
                        message=message,
                        created_at=comment.created_at,
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
            subject = _subject(submission)
            items.append(
                (
                    history.created_at,
                    _inbox_item(
                        item_id=f"completed:{history.id}",
                        kind="completed",
                        submission=submission,
                        message=f"وظیفه «{subject}» انجام شد.",
                        created_at=history.created_at,
                    ),
                )
            )
        return items
