"""Read side of admin-managed portal cards: visibility, detail, files, form lookup."""

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.portal_card import PortalCard
from app.models.user import User
from app.repositories.portal_card import PortalCardRepository
from app.schemas.portal import FormTemplate
from app.schemas.portal_card import (
    CardFormSchema,
    PortalCardAdminDetail,
    PortalCardBreadcrumb,
    PortalCardDetail,
    PortalCardFileItem,
    PortalCardSummary,
)
from app.services.base import BaseService
from app.services.form_access_service import allowed_target_keys
from app.services.form_duty_service import list_user_duty_assignments
from app.services.portal_card_visibility import visible_card_ids
from app.services.portal_card_form import build_template, parse_schema
from app.services.portal_card_storage import PortalCardStorage
from app.services.portal_card_targets import (
    CUSTOM_DEPARTMENT_ID,
    CUSTOM_DEPARTMENT_TITLE,
    parse_custom_form_id,
    parse_custom_section_id,
)

NOT_FOUND = "کارت یافت نشد."


@dataclass(frozen=True)
class CustomFormContext:
    card: PortalCard
    template: FormTemplate
    schema: CardFormSchema


def custom_form_titles(db: Session, form_id: str) -> tuple[str, str] | None:
    """Return ``(department_title, form_title)`` for ``custom-<id>`` forms.

    Returns ``None`` for non-custom ids and for cards that were deleted, so
    callers fall back to the raw identifiers for historical submissions.
    """
    card_id = parse_custom_form_id(form_id)
    card = db.get(PortalCard, card_id) if card_id is not None else None
    if card is None:
        return None
    parent = db.get(PortalCard, card.parent_id) if card.parent_id else None
    return (parent.title if parent else CUSTOM_DEPARTMENT_TITLE), card.title


class PortalCardService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.repo = PortalCardRepository(db)
        self.storage = PortalCardStorage()

    # ------------------------------------------------------------------ browse

    def list_children(
        self, user: User, parent_id: int | None
    ) -> list[PortalCardSummary]:
        cards, _, visible = self._snapshot(user)
        if parent_id is not None and parent_id not in visible:
            raise HTTPException(status_code=404, detail=NOT_FOUND)
        return self._visible_children(cards, parent_id, visible)

    def get_detail(self, user: User, card_id: int) -> PortalCardDetail:
        cards, by_id, visible = self._snapshot(user)
        card = by_id.get(card_id)
        if card is None or card.id not in visible:
            raise HTTPException(status_code=404, detail=NOT_FOUND)
        return self._detail(card, cards, by_id, visible)

    def get_admin_detail(self, card_id: int) -> PortalCardAdminDetail:
        card = self.require(card_id)
        cards = self.repo.list_all()
        by_id = {item.id: item for item in cards}
        visible = set(by_id)
        base = self._detail(card, cards, by_id, visible)
        schema = parse_schema(card.form_schema) if card.kind == "form" else None
        return PortalCardAdminDetail(**base.model_dump(), form_schema=schema)

    def list_all_for_admin(self) -> list[PortalCardSummary]:
        cards = self.repo.list_all()
        counts = self._child_counts(cards, {card.id for card in cards})
        return [self._summary(card, counts.get(card.id, 0)) for card in cards]

    def require(self, card_id: int) -> PortalCard:
        card = self.repo.get(card_id)
        if card is None:
            raise HTTPException(status_code=404, detail=NOT_FOUND)
        return card

    # ------------------------------------------------------------------- files

    def resolve_logo(self, card_id: int) -> tuple[Path, str, str]:
        card = self.require(card_id)
        path = self.storage.safe_path(card.logo_path)
        if not path:
            raise HTTPException(status_code=404, detail="لوگو یافت نشد.")
        return path, card.logo_name or path.name, self.storage.media_type(path)

    def resolve_file(
        self, user: User, card_id: int, file_id: int
    ) -> tuple[Path, str, str]:
        _, by_id, visible = self._snapshot(user)
        card = by_id.get(card_id)
        if card is None or card.id not in visible or card.kind != "document":
            raise HTTPException(status_code=404, detail=NOT_FOUND)
        item = self.repo.get_file(card_id, file_id)
        path = self.storage.safe_path(item.file_path) if item else None
        if not item or not path:
            raise HTTPException(status_code=404, detail="فایل یافت نشد.")
        return path, item.file_name or path.name, self.storage.media_type(path)

    # -------------------------------------------------------- form integration

    def resolve_form(self, form_id: str) -> CustomFormContext | None:
        """Return the custom form behind ``custom-<id>`` or ``None``."""
        card_id = parse_custom_form_id(form_id)
        card = self.repo.get(card_id) if card_id is not None else None
        if card is None or card.kind != "form":
            return None
        return CustomFormContext(
            card=card, template=build_template(card), schema=parse_schema(card.form_schema)
        )

    def is_visible(self, user: User, card: PortalCard) -> bool:
        _, _, visible = self._snapshot(user)
        return card.id in visible

    # ----------------------------------------------------------------- helpers

    def _snapshot(
        self, user: User
    ) -> tuple[list[PortalCard], dict[int, PortalCard], set[int]]:
        cards = self.repo.list_all()
        by_id = {card.id: card for card in cards}
        return cards, by_id, self._visible_ids(user, cards)

    def _visible_ids(self, user: User, cards: list[PortalCard]) -> set[int]:
        if user.is_admin:
            return {card.id for card in cards}
        allowed = allowed_target_keys(self.db, user)
        return visible_card_ids(
            cards,
            open_access=allowed is None,
            explicit=self._explicit_custom_ids(user, allowed),
        )

    def _explicit_custom_ids(self, user: User, allowed: set[str] | None) -> set[int]:
        """Cards granted to this user, including duty assignments."""
        explicit: set[int] = set()
        if allowed is not None:
            for key in allowed:
                parts = key.split(":")
                if len(parts) < 2 or parts[0] != CUSTOM_DEPARTMENT_ID:
                    continue
                card_id = parse_custom_section_id(parts[1])
                if card_id is not None:
                    explicit.add(card_id)
        for row in list_user_duty_assignments(self.db, user.id):
            if row.portal_department_id != CUSTOM_DEPARTMENT_ID:
                continue
            card_id = parse_custom_section_id(row.section_id)
            if card_id is not None:
                explicit.add(card_id)
        return explicit

    @staticmethod
    def _child_counts(cards: list[PortalCard], visible: set[int]) -> dict[int, int]:
        counts: dict[int, int] = defaultdict(int)
        for card in cards:
            if card.parent_id is not None and card.id in visible:
                counts[card.parent_id] += 1
        return counts

    def _visible_children(
        self, cards: list[PortalCard], parent_id: int | None, visible: set[int]
    ) -> list[PortalCardSummary]:
        counts = self._child_counts(cards, visible)
        return [
            self._summary(card, counts.get(card.id, 0))
            for card in cards
            if card.parent_id == parent_id and card.id in visible
        ]

    def _detail(
        self,
        card: PortalCard,
        cards: list[PortalCard],
        by_id: dict[int, PortalCard],
        visible: set[int],
    ) -> PortalCardDetail:
        counts = self._child_counts(cards, visible)
        summary = self._summary(card, counts.get(card.id, 0))
        return PortalCardDetail(
            **summary.model_dump(),
            breadcrumbs=self._breadcrumbs(card, by_id),
            children=(
                self._visible_children(cards, card.id, visible)
                if card.kind == "group"
                else []
            ),
            form=build_template(card) if card.kind == "form" else None,
            content=(card.content or "") if card.kind == "document" else "",
            files=(
                [self._file_item(item) for item in card.files]
                if card.kind == "document"
                else []
            ),
            updated_at=card.updated_at,
        )

    @staticmethod
    def _breadcrumbs(
        card: PortalCard, by_id: dict[int, PortalCard]
    ) -> list[PortalCardBreadcrumb]:
        trail: list[PortalCardBreadcrumb] = []
        seen = {card.id}
        parent = by_id.get(card.parent_id) if card.parent_id else None
        while parent is not None and parent.id not in seen:
            trail.append(PortalCardBreadcrumb(id=parent.id, title=parent.title))
            seen.add(parent.id)
            parent = by_id.get(parent.parent_id) if parent.parent_id else None
        return list(reversed(trail))

    @staticmethod
    def _summary(card: PortalCard, child_count: int) -> PortalCardSummary:
        version = int(card.updated_at.timestamp()) if card.updated_at else 0
        return PortalCardSummary(
            id=card.id,
            parent_id=card.parent_id,
            kind=card.kind,  # type: ignore[arg-type]
            title=card.title,
            description=card.description or "",
            logo_url=(
                f"/api/v1/portal-cards/{card.id}/logo?v={version}"
                if card.logo_path
                else None
            ),
            sort_order=card.sort_order,
            is_published=card.is_published,
            child_count=child_count,
        )

    @staticmethod
    def _file_item(item) -> PortalCardFileItem:
        return PortalCardFileItem(
            id=item.id,
            title=item.title or item.file_name,
            file_name=item.file_name,
            file_size=item.file_size or 0,
            is_pdf=item.file_name.lower().endswith(".pdf"),
        )
