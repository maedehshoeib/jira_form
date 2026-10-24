from sqlalchemy import func

from app.models.portal_card import PortalCard, PortalCardFile
from app.repositories.base import BaseRepository


class PortalCardRepository(BaseRepository):
    def list_all(self) -> list[PortalCard]:
        return (
            self.db.query(PortalCard)
            .order_by(PortalCard.sort_order, PortalCard.id)
            .all()
        )

    def get(self, card_id: int) -> PortalCard | None:
        return self.db.get(PortalCard, card_id)

    def list_children(self, parent_id: int | None) -> list[PortalCard]:
        query = self.db.query(PortalCard)
        if parent_id is None:
            query = query.filter(PortalCard.parent_id.is_(None))
        else:
            query = query.filter(PortalCard.parent_id == parent_id)
        return query.order_by(PortalCard.sort_order, PortalCard.id).all()

    def next_sort_order(self, parent_id: int | None) -> int:
        query = self.db.query(func.max(PortalCard.sort_order))
        if parent_id is None:
            query = query.filter(PortalCard.parent_id.is_(None))
        else:
            query = query.filter(PortalCard.parent_id == parent_id)
        current = query.scalar()
        return 0 if current is None else int(current) + 1

    def get_file(self, card_id: int, file_id: int) -> PortalCardFile | None:
        return (
            self.db.query(PortalCardFile)
            .filter(PortalCardFile.card_id == card_id, PortalCardFile.id == file_id)
            .first()
        )

    def add(self, item: PortalCard) -> PortalCard:
        self.db.add(item)
        return item

    def delete(self, item: PortalCard) -> None:
        self.db.delete(item)

    def flush(self) -> None:
        self.db.flush()
