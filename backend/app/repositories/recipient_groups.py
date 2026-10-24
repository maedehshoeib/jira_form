from sqlalchemy.orm import Session

from app.models.recipient_group import RecipientGroup, RecipientGroupMember
from app.models.user import User
from app.repositories.base import BaseRepository


class RecipientGroupRepository(BaseRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_for_owner(self, owner_id: int) -> list[RecipientGroup]:
        return (
            self.db.query(RecipientGroup)
            .filter(RecipientGroup.owner_id == owner_id)
            .order_by(RecipientGroup.id.asc())
            .all()
        )

    def count_for_owner(self, owner_id: int) -> int:
        return (
            self.db.query(RecipientGroup)
            .filter(RecipientGroup.owner_id == owner_id)
            .count()
        )

    def get_for_owner(self, group_id: int, owner_id: int) -> RecipientGroup | None:
        return (
            self.db.query(RecipientGroup)
            .filter(
                RecipientGroup.id == group_id,
                RecipientGroup.owner_id == owner_id,
            )
            .first()
        )

    def get_by_name(self, owner_id: int, name: str) -> RecipientGroup | None:
        return (
            self.db.query(RecipientGroup)
            .filter(RecipientGroup.owner_id == owner_id, RecipientGroup.name == name)
            .first()
        )

    def add(self, group: RecipientGroup) -> RecipientGroup:
        self.db.add(group)
        return group

    def delete(self, group: RecipientGroup) -> None:
        self.db.delete(group)

    def replace_members(self, group_id: int, user_ids: list[int]) -> None:
        self.db.query(RecipientGroupMember).filter(
            RecipientGroupMember.group_id == group_id
        ).delete(synchronize_session=False)
        for user_id in user_ids:
            self.db.add(RecipientGroupMember(group_id=group_id, user_id=user_id))

    def members_by_group(self, group_ids: list[int]) -> dict[int, list[User]]:
        grouped: dict[int, list[User]] = {group_id: [] for group_id in group_ids}
        if not group_ids:
            return grouped
        rows = (
            self.db.query(RecipientGroupMember.group_id, User)
            .join(User, User.id == RecipientGroupMember.user_id)
            .filter(RecipientGroupMember.group_id.in_(group_ids))
            .order_by(User.display_name.asc(), User.id.asc())
            .all()
        )
        for group_id, user in rows:
            grouped.setdefault(group_id, []).append(user)
        return grouped
