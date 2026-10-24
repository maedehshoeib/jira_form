"""Write side of admin-managed portal cards."""

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.form_template import (
    DepartmentFormAccess,
    FormDutyAssignment,
    UserFormAccess,
)
from app.models.portal_card import PortalCard, PortalCardFile
from app.models.user import User
from app.schemas.portal_card import (
    CardFormSchema,
    CardKind,
    PortalCardAdminDetail,
    PortalCardFields,
)
from app.services.base import BaseService
from app.services.portal_card_service import PortalCardService
from app.services.portal_card_targets import CUSTOM_DEPARTMENT_ID, custom_form_id

MAX_DEPTH = 5
MAX_FILES_PER_CARD = 30


class PortalCardAdminService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.reader = PortalCardService(db)
        self.repo = self.reader.repo
        self.storage = self.reader.storage

    # ------------------------------------------------------------------- cards

    async def create(
        self,
        actor: User,
        kind: CardKind,
        parent_id: int | None,
        fields: PortalCardFields,
        logo: UploadFile | None,
    ) -> PortalCardAdminDetail:
        if parent_id is not None:
            self._require_group_parent(parent_id)
        logo_info = await self.storage.store_logo(logo)
        card = PortalCard(
            parent_id=parent_id,
            kind=kind,
            sort_order=self.repo.next_sort_order(parent_id),
            created_by_id=actor.id,
            logo_path=logo_info[0] if logo_info else "",
            logo_name=logo_info[1] if logo_info else "",
            **fields.model_dump(),
        )
        self.repo.add(card)
        self.db.commit()
        self.db.refresh(card)
        return self.reader.get_admin_detail(card.id)

    async def update(
        self,
        card_id: int,
        fields: PortalCardFields,
        logo: UploadFile | None,
        *,
        remove_logo: bool = False,
    ) -> PortalCardAdminDetail:
        card = self.reader.require(card_id)
        logo_info = await self.storage.store_logo(logo)
        old_logo = card.logo_path
        for key, value in fields.model_dump().items():
            setattr(card, key, value)
        if logo_info:
            card.logo_path, card.logo_name = logo_info
        elif remove_logo:
            card.logo_path, card.logo_name = "", ""
        self.db.commit()
        if old_logo and old_logo != card.logo_path:
            self.storage.delete(old_logo)
        return self.reader.get_admin_detail(card.id)

    def delete(self, card_id: int) -> None:
        card = self.reader.require(card_id)
        subtree = self._subtree(card)
        stored_paths = [item.logo_path for item in subtree if item.logo_path]
        stored_paths += [file.file_path for item in subtree for file in item.files]
        form_ids = [custom_form_id(item.id) for item in subtree if item.kind == "form"]
        if form_ids:
            self._drop_form_targets(form_ids)
        self.db.delete(card)  # ORM cascade removes descendants and their files
        self.db.commit()
        for stored in stored_paths:
            self.storage.delete(stored)

    def reorder(self, parent_id: int | None, ordered_ids: list[int]) -> None:
        siblings = self.repo.list_children(parent_id)
        if sorted(card.id for card in siblings) != sorted(ordered_ids):
            raise HTTPException(
                status_code=422, detail="فهرست مرتب‌سازی با کارت‌های موجود مطابقت ندارد."
            )
        by_id = {card.id: card for card in siblings}
        for position, card_id in enumerate(ordered_ids):
            by_id[card_id].sort_order = position
        self.db.commit()

    def move(self, card_id: int, parent_id: int | None) -> PortalCardAdminDetail:
        card = self.reader.require(card_id)
        if parent_id is not None:
            parent = self._require_group_parent(parent_id)
            subtree_ids = {item.id for item in self._subtree(card)}
            if parent.id in subtree_ids:
                raise HTTPException(
                    status_code=422, detail="کارت را نمی‌توان داخل خودش یا زیرمجموعه‌اش منتقل کرد."
                )
            depth = self._depth(parent) + self._height(card)
            if depth > MAX_DEPTH:
                raise HTTPException(status_code=422, detail=self._depth_message())
        if card.parent_id != parent_id:
            card.parent_id = parent_id
            card.sort_order = self.repo.next_sort_order(parent_id)
            self.db.commit()
        return self.reader.get_admin_detail(card.id)

    # ----------------------------------------------------------------- content

    def set_form(self, card_id: int, schema: CardFormSchema) -> PortalCardAdminDetail:
        card = self._require_kind(card_id, "form")
        card.form_schema = schema.model_dump_json()
        self.db.commit()
        return self.reader.get_admin_detail(card.id)

    def set_content(self, card_id: int, content: str) -> PortalCardAdminDetail:
        card = self._require_kind(card_id, "document")
        card.content = content
        self.db.commit()
        return self.reader.get_admin_detail(card.id)

    async def add_file(
        self, card_id: int, title: str, upload: UploadFile | None
    ) -> PortalCardAdminDetail:
        card = self._require_kind(card_id, "document")
        if len(card.files) >= MAX_FILES_PER_CARD:
            raise HTTPException(
                status_code=422,
                detail=f"حداکثر {MAX_FILES_PER_CARD} فایل برای هر مستند مجاز است.",
            )
        stored = await self.storage.store_file(upload)
        if not stored:
            raise HTTPException(status_code=422, detail="فایلی انتخاب نشده است.")
        path, name, size = stored
        next_order = max((item.sort_order for item in card.files), default=-1) + 1
        card.files.append(
            PortalCardFile(
                title=(title.strip() or name)[:256],
                file_path=path,
                file_name=name,
                file_size=size,
                sort_order=next_order,
            )
        )
        self.db.commit()
        return self.reader.get_admin_detail(card.id)

    def delete_file(self, card_id: int, file_id: int) -> PortalCardAdminDetail:
        card = self._require_kind(card_id, "document")
        item = self.repo.get_file(card_id, file_id)
        if item is None:
            raise HTTPException(status_code=404, detail="فایل یافت نشد.")
        stored = item.file_path
        card.files.remove(item)
        self.db.commit()
        self.storage.delete(stored)
        return self.reader.get_admin_detail(card.id)

    # ----------------------------------------------------------------- helpers

    def _require_kind(self, card_id: int, kind: str) -> PortalCard:
        card = self.reader.require(card_id)
        if card.kind != kind:
            raise HTTPException(
                status_code=422, detail="این عملیات برای این نوع کارت مجاز نیست."
            )
        return card

    def _require_group_parent(self, parent_id: int) -> PortalCard:
        parent = self.reader.require(parent_id)
        if parent.kind != "group":
            raise HTTPException(
                status_code=422, detail="فقط داخل کارت‌های گروهی می‌توان کارت اضافه کرد."
            )
        if self._depth(parent) >= MAX_DEPTH:
            raise HTTPException(status_code=422, detail=self._depth_message())
        return parent

    @staticmethod
    def _depth_message() -> str:
        return f"عمق کارت‌ها نمی‌تواند از {MAX_DEPTH} سطح بیشتر باشد."

    def _depth(self, card: PortalCard) -> int:
        depth, seen, current = 1, {card.id}, card
        while current.parent_id is not None and current.parent_id not in seen:
            parent = self.repo.get(current.parent_id)
            if parent is None:
                break
            seen.add(parent.id)
            depth += 1
            current = parent
        return depth

    def _height(self, card: PortalCard) -> int:
        children = self.repo.list_children(card.id)
        return 1 + max((self._height(child) for child in children), default=0)

    def _subtree(self, card: PortalCard) -> list[PortalCard]:
        """Return the card and all descendants, parents before children."""
        result, queue = [card], [card]
        while queue:
            current = queue.pop(0)
            for child in self.repo.list_children(current.id):
                result.append(child)
                queue.append(child)
        return result

    def _drop_form_targets(self, form_ids: list[str]) -> None:
        for model in (DepartmentFormAccess, UserFormAccess, FormDutyAssignment):
            self.db.query(model).filter(
                model.portal_department_id == CUSTOM_DEPARTMENT_ID,
                model.form_id.in_(form_ids),
            ).delete(synchronize_session=False)
