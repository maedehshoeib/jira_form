"""Per-user unsent management letter drafts."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.submission import LetterDraft
from app.repositories.letter_drafts import LetterDraftRepository

MAX_DRAFT_SUBJECT_LENGTH = 512
DRAFT_PAYLOAD_KEYS = (
    "letter_number",
    "needs_reply",
    "needs_action",
    "due_date",
    "sender",
    "sender_detail",
    "recipient_ids",
    "cc_recipient_ids",
    "recipient_comments",
)


class LetterDraftNotFound(LookupError):
    pass


def _load_json(raw: str | None, fallback: Any) -> Any:
    try:
        value = json.loads(raw or "")
    except (json.JSONDecodeError, TypeError):
        return fallback
    return value if isinstance(value, type(fallback)) else fallback


class LetterDraftService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = LetterDraftRepository(db)

    def list_for_user(self, user_id: int) -> list[LetterDraft]:
        return self.repo.list_for_user(user_id)

    def get(self, draft_id: int, user_id: int) -> LetterDraft:
        draft = self.repo.get_for_user(draft_id, user_id)
        if draft is None:
            raise LetterDraftNotFound("پیش‌نویس یافت نشد")
        return draft

    @staticmethod
    def payload(draft: LetterDraft) -> dict[str, Any]:
        return _load_json(draft.payload, {})

    @staticmethod
    def attachments(draft: LetterDraft) -> list[dict[str, str]]:
        return [
            {"name": str(item["name"]), "path": str(item["path"])}
            for item in _load_json(draft.attachments, [])
            if isinstance(item, dict) and item.get("name") and item.get("path")
        ]

    def create(
        self,
        user_id: int,
        *,
        letter_type: str,
        subject: str,
        description: str,
        payload: dict[str, Any],
        new_attachments: list[dict[str, str]],
    ) -> LetterDraft:
        now = datetime.utcnow()
        draft = LetterDraft(user_id=user_id, created_at=now, updated_at=now)
        self._apply(draft, letter_type, subject, description, payload)
        draft.attachments = json.dumps(new_attachments, ensure_ascii=False)
        self.repo.add(draft)
        self.db.commit()
        self.db.refresh(draft)
        return draft

    def update(
        self,
        draft: LetterDraft,
        *,
        letter_type: str,
        subject: str,
        description: str,
        payload: dict[str, Any],
        new_attachments: list[dict[str, str]],
        remove_indexes: list[int],
    ) -> LetterDraft:
        self._apply(draft, letter_type, subject, description, payload)
        draft.attachments = json.dumps(
            self.merge_attachments(draft, new_attachments, remove_indexes),
            ensure_ascii=False,
        )
        draft.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(draft)
        return draft

    def merge_attachments(
        self,
        draft: LetterDraft,
        new_attachments: list[dict[str, str]],
        remove_indexes: list[int],
    ) -> list[dict[str, str]]:
        """Keep stored files not marked for removal; delete removed files."""
        kept, removed = self.split_attachments(draft, remove_indexes)
        for item in removed:
            self._unlink(item["path"])
        return [*kept, *new_attachments]

    def split_attachments(
        self, draft: LetterDraft, remove_indexes: list[int]
    ) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
        removed_set = set(remove_indexes)
        kept: list[dict[str, str]] = []
        removed: list[dict[str, str]] = []
        for index, item in enumerate(self.attachments(draft)):
            (removed if index in removed_set else kept).append(item)
        return kept, removed

    def finish_sent(self, draft: LetterDraft, removed: list[dict[str, str]]) -> None:
        """Drop the draft after sending; kept files now belong to the letters."""
        for item in removed:
            self._unlink(item["path"])
        self.repo.delete(draft)
        self.db.commit()

    def delete(self, draft: LetterDraft) -> None:
        for item in self.attachments(draft):
            self._unlink(item["path"])
        self.repo.delete(draft)
        self.db.commit()

    @staticmethod
    def _apply(
        draft: LetterDraft,
        letter_type: str,
        subject: str,
        description: str,
        payload: dict[str, Any],
    ) -> None:
        draft.letter_type = letter_type
        draft.subject = (subject or "").strip()[:MAX_DRAFT_SUBJECT_LENGTH]
        draft.description = description or ""
        draft.payload = json.dumps(
            {key: payload.get(key) for key in DRAFT_PAYLOAD_KEYS},
            ensure_ascii=False,
        )

    @staticmethod
    def _unlink(path: str) -> None:
        """Delete only files inside the upload directory."""
        upload_root = Path(settings.UPLOAD_DIR).resolve()
        target = Path(path).resolve()
        if upload_root not in target.parents:
            return
        target.unlink(missing_ok=True)
