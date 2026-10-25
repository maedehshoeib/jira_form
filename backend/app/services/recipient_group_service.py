"""Recipient groups used when sending or referring work."""

from collections.abc import Callable
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.recipient_group import RecipientGroup
from app.models.user import User
from app.repositories.recipient_groups import RecipientGroupRepository
from app.repositories.users import UserRepository
from app.schemas.recipient_groups import (
    RecipientGroupMemberResponse,
    RecipientGroupResponse,
    RecipientGroupWrite,
)
from app.services.base import BaseService

MAX_GROUPS_PER_USER = 30
MAX_GROUP_NAME_LENGTH = 80


class RecipientGroupService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.repo = RecipientGroupRepository(db)
        self.users = UserRepository(db)

    def list_groups(self, actor: User) -> list[RecipientGroupResponse]:
        groups = self.repo.list_visible(actor.id)
        members = self.repo.members_by_group([group.id for group in groups])
        return [self._serialize(group, members.get(group.id, [])) for group in groups]

    def create_group(
        self, actor: User, body: RecipientGroupWrite
    ) -> RecipientGroupResponse:
        name = self._clean_name(body.name)
        shared = bool(actor.is_admin)
        self._ensure_name_available(actor.id, name, shared=shared)
        if self.repo.count_for_owner(actor.id) >= MAX_GROUPS_PER_USER:
            raise HTTPException(status_code=400, detail="حداکثر ۳۰ گروه می‌توانید بسازید.")
        members = self._active_members(body.member_ids)
        now = datetime.utcnow()
        group = RecipientGroup(
            owner_id=actor.id,
            name=name,
            is_shared=shared,
            created_at=now,
            updated_at=now,
        )
        self.repo.add(group)
        self._flush()
        self.repo.replace_members(group.id, [user.id for user in members])
        self._commit()
        self.db.refresh(group)
        return self._serialize(group, members)

    def update_group(
        self, actor: User, group_id: int, body: RecipientGroupWrite
    ) -> RecipientGroupResponse:
        group = self._editable_group(actor, group_id)
        name = self._clean_name(body.name)
        self._ensure_name_available(
            group.owner_id, name, shared=group.is_shared, ignore_id=group.id
        )
        members = self._active_members(body.member_ids)
        group.name = name
        group.updated_at = datetime.utcnow()
        self.repo.replace_members(group.id, [user.id for user in members])
        self._commit()
        self.db.refresh(group)
        return self._serialize(group, members)

    def delete_group(self, actor: User, group_id: int) -> None:
        group = self._editable_group(actor, group_id)
        self.repo.delete(group)
        self._commit()

    def _editable_group(self, actor: User, group_id: int) -> RecipientGroup:
        group = self.repo.get_visible(group_id, actor.id)
        if group is None:
            raise HTTPException(status_code=404, detail="گروه پیدا نشد.")
        if group.is_shared and not actor.is_admin:
            raise HTTPException(
                status_code=403, detail="فقط مدیر می‌تواند گروه همگانی را تغییر دهد."
            )
        return group

    def _ensure_name_available(
        self,
        owner_id: int,
        name: str,
        *,
        shared: bool,
        ignore_id: int | None = None,
    ) -> None:
        if shared:
            shared_group = self.repo.get_shared_by_name(name)
            if shared_group is not None and shared_group.id != ignore_id:
                raise HTTPException(
                    status_code=409, detail="گروهی با این نام از قبل وجود دارد."
                )
        existing = self.repo.get_by_name(owner_id, name)
        if existing is not None and existing.id != ignore_id:
            raise HTTPException(
                status_code=409, detail="گروهی با این نام از قبل وجود دارد."
            )

    def _clean_name(self, name: str) -> str:
        cleaned = " ".join(name.split())
        if not cleaned or len(cleaned) > MAX_GROUP_NAME_LENGTH:
            raise HTTPException(
                status_code=400, detail="نام گروه باید بین ۱ تا ۸۰ نویسه باشد."
            )
        return cleaned

    def _active_members(self, member_ids: list[int]) -> list[User]:
        unique_ids = list(dict.fromkeys(member_ids))
        if not unique_ids:
            raise HTTPException(
                status_code=400, detail="حداقل یک نفر را برای گروه انتخاب کنید."
            )
        found = self.users.by_ids(set(unique_ids))
        inactive = [
            member_id
            for member_id in unique_ids
            if member_id not in found or not found[member_id].is_active
        ]
        if inactive:
            raise HTTPException(
                status_code=400, detail="فقط کاربران فعال را می‌توان به گروه اضافه کرد."
            )
        return [found[member_id] for member_id in unique_ids]

    def _flush(self) -> None:
        self._guard(self.db.flush)

    def _commit(self) -> None:
        self._guard(self.db.commit)

    def _guard(self, action: Callable[[], None]) -> None:
        try:
            action()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=409, detail="گروهی با این نام از قبل وجود دارد."
            ) from None

    def _serialize(
        self, group: RecipientGroup, members: list[User]
    ) -> RecipientGroupResponse:
        ordered = sorted(members, key=lambda user: (user.display_name or "", user.id))
        return RecipientGroupResponse(
            id=group.id,
            name=group.name,
            is_shared=bool(group.is_shared),
            members=[self._member(user) for user in ordered],
        )

    def _member(self, user: User) -> RecipientGroupMemberResponse:
        return RecipientGroupMemberResponse(
            id=user.id,
            username=user.username,
            display_name=user.display_name or "",
            department=user.department or "",
            job_title=user.job_title or "",
            is_active=bool(user.is_active),
        )
