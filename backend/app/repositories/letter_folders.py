from sqlalchemy.orm import Session

from app.models.letter_folder import LetterFolder, LetterFolderItem
from app.repositories.base import BaseRepository


class LetterFolderRepository(BaseRepository):
    def list_for_user(
        self, user_id: int, *, scope: str | None = None
    ) -> list[LetterFolder]:
        query = self.db.query(LetterFolder).filter(LetterFolder.user_id == user_id)
        if scope:
            query = query.filter(LetterFolder.scope == scope)
        return query.order_by(
            LetterFolder.sort_order.asc(),
            LetterFolder.id.asc(),
        ).all()

    def get_for_user(self, folder_id: int, user_id: int) -> LetterFolder | None:
        return (
            self.db.query(LetterFolder)
            .filter(LetterFolder.id == folder_id, LetterFolder.user_id == user_id)
            .first()
        )

    def get_by_name(
        self, user_id: int, scope: str, name: str
    ) -> LetterFolder | None:
        return (
            self.db.query(LetterFolder)
            .filter(
                LetterFolder.user_id == user_id,
                LetterFolder.scope == scope,
                LetterFolder.name == name,
            )
            .first()
        )

    def add(self, folder: LetterFolder) -> LetterFolder:
        self.db.add(folder)
        return folder

    def delete(self, folder: LetterFolder) -> None:
        self.db.delete(folder)

    def list_items(self, folder_id: int) -> list[LetterFolderItem]:
        return (
            self.db.query(LetterFolderItem)
            .filter(LetterFolderItem.folder_id == folder_id)
            .order_by(LetterFolderItem.id.asc())
            .all()
        )

    def list_items_for_folders(
        self, folder_ids: list[int]
    ) -> list[LetterFolderItem]:
        if not folder_ids:
            return []
        return (
            self.db.query(LetterFolderItem)
            .filter(LetterFolderItem.folder_id.in_(folder_ids))
            .order_by(LetterFolderItem.id.asc())
            .all()
        )

    def get_item(self, item_id: int, folder_id: int) -> LetterFolderItem | None:
        return (
            self.db.query(LetterFolderItem)
            .filter(
                LetterFolderItem.id == item_id,
                LetterFolderItem.folder_id == folder_id,
            )
            .first()
        )

    def find_item(
        self,
        folder_id: int,
        *,
        submission_id: int | None = None,
        batch_id: str | None = None,
    ) -> LetterFolderItem | None:
        query = self.db.query(LetterFolderItem).filter(
            LetterFolderItem.folder_id == folder_id
        )
        if submission_id is not None:
            query = query.filter(LetterFolderItem.submission_id == submission_id)
        elif batch_id is not None:
            query = query.filter(LetterFolderItem.batch_id == batch_id)
        else:
            return None
        return query.first()

    def add_item(self, item: LetterFolderItem) -> LetterFolderItem:
        self.db.add(item)
        return item

    def delete_item(self, item: LetterFolderItem) -> None:
        self.db.delete(item)

    def next_sort_order(self, user_id: int, scope: str) -> int:
        row = (
            self.db.query(LetterFolder.sort_order)
            .filter(LetterFolder.user_id == user_id, LetterFolder.scope == scope)
            .order_by(LetterFolder.sort_order.desc())
            .first()
        )
        return (row[0] + 1) if row else 0
