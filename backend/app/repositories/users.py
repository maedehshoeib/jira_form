from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def by_ids(self, user_ids: set[int]) -> dict[int, User]:
        if not user_ids:
            return {}
        users = self.db.query(User).filter(User.id.in_(user_ids)).all()
        return {user.id: user for user in users}
