from app.models.submission import LetterDraft
from app.repositories.base import BaseRepository


class LetterDraftRepository(BaseRepository):
    def list_for_user(self, user_id: int) -> list[LetterDraft]:
        return (
            self.db.query(LetterDraft)
            .filter(LetterDraft.user_id == user_id)
            .order_by(LetterDraft.updated_at.desc(), LetterDraft.id.desc())
            .all()
        )

    def get_for_user(self, draft_id: int, user_id: int) -> LetterDraft | None:
        return (
            self.db.query(LetterDraft)
            .filter(LetterDraft.id == draft_id, LetterDraft.user_id == user_id)
            .first()
        )

    def add(self, draft: LetterDraft) -> LetterDraft:
        self.db.add(draft)
        return draft

    def delete(self, draft: LetterDraft) -> None:
        self.db.delete(draft)
