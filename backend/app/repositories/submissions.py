from sqlalchemy.orm import Session

from app.models.submission import (
    Submission,
    SubmissionAssigneeProgress,
    SubmissionInitialAssignee,
)
from app.models.user import User


class SubmissionRepository:
    """Keep submission query construction out of HTTP and presentation code."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def owned_by(self, user_id: int) -> list[Submission]:
        return self.db.query(Submission).filter(Submission.user_id == user_id).all()

    def assignees_for(self, submission_ids: set[int]):
        if not submission_ids:
            return []
        return (
            self.db.query(SubmissionInitialAssignee, User)
            .join(User, User.id == SubmissionInitialAssignee.user_id)
            .filter(SubmissionInitialAssignee.submission_id.in_(submission_ids))
            .all()
        )

    def assignee_progress_for(self, submission_ids: set[int]):
        if not submission_ids:
            return []
        return (
            self.db.query(SubmissionAssigneeProgress)
            .filter(SubmissionAssigneeProgress.submission_id.in_(submission_ids))
            .order_by(
                SubmissionAssigneeProgress.updated_at.asc(),
                SubmissionAssigneeProgress.id.asc(),
            )
            .all()
        )

    def assignee_progress(self, submission_id: int, user_id: int):
        return (
            self.db.query(SubmissionAssigneeProgress)
            .filter(
                SubmissionAssigneeProgress.submission_id == submission_id,
                SubmissionAssigneeProgress.user_id == user_id,
            )
            .first()
        )

    def clear_assignee_progress(self, submission_id: int) -> None:
        (
            self.db.query(SubmissionAssigneeProgress)
            .filter(SubmissionAssigneeProgress.submission_id == submission_id)
            .delete(synchronize_session=False)
        )
