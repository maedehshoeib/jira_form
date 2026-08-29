from sqlalchemy.orm import Session

from app.models.submission import Submission, SubmissionInitialAssignee
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
