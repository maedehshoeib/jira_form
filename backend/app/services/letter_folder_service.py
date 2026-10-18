"""Personal letter folder CRUD and membership rules."""

import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.letter_folder import LetterFolder, LetterFolderItem
from app.models.submission import Submission
from app.models.user import User
from app.repositories.letter_folders import LetterFolderRepository
from app.schemas.letter_folders import (
    LetterFolderCreate,
    LetterFolderItemCreate,
    LetterFolderItemResponse,
    LetterFolderResponse,
    LetterFolderUpdate,
)
from app.services.base import BaseService
from app.services.management_letter_service import MANAGEMENT_LETTER_FORM_ID
from app.services.task_workflow_service import (
    user_is_cc_recipient,
    user_is_referral_recipient,
)

FOLDER_SCOPES = frozenset({"received", "sent"})
MAX_FOLDER_NAME_LENGTH = 80


class LetterFolderService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.repo = LetterFolderRepository(db)

    def list_folders(
        self, actor: User, *, scope: str | None = None
    ) -> list[LetterFolderResponse]:
        if scope is not None and scope not in FOLDER_SCOPES:
            raise HTTPException(status_code=400, detail="محدوده پوشه نامعتبر است.")
        folders = self.repo.list_for_user(actor.id, scope=scope)
        items = self.repo.list_items_for_folders([folder.id for folder in folders])
        by_folder: dict[int, list[LetterFolderItem]] = {}
        for item in items:
            by_folder.setdefault(item.folder_id, []).append(item)
        return [self._serialize(folder, by_folder.get(folder.id, [])) for folder in folders]

    def create_folder(
        self, actor: User, body: LetterFolderCreate
    ) -> LetterFolderResponse:
        name = self._clean_name(body.name)
        if body.scope not in FOLDER_SCOPES:
            raise HTTPException(status_code=400, detail="محدوده پوشه نامعتبر است.")
        if self.repo.get_by_name(actor.id, body.scope, name):
            raise HTTPException(
                status_code=409, detail="پوشه‌ای با این نام از قبل وجود دارد."
            )
        now = datetime.utcnow()
        folder = LetterFolder(
            user_id=actor.id,
            name=name,
            scope=body.scope,
            sort_order=self.repo.next_sort_order(actor.id, body.scope),
            created_at=now,
            updated_at=now,
        )
        self.repo.add(folder)
        self.db.commit()
        self.db.refresh(folder)
        return self._serialize(folder, [])

    def rename_folder(
        self, actor: User, folder_id: int, body: LetterFolderUpdate
    ) -> LetterFolderResponse:
        folder = self._owned_folder(actor, folder_id)
        name = self._clean_name(body.name)
        existing = self.repo.get_by_name(actor.id, folder.scope, name)
        if existing and existing.id != folder.id:
            raise HTTPException(
                status_code=409, detail="پوشه‌ای با این نام از قبل وجود دارد."
            )
        folder.name = name
        folder.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(folder)
        return self._serialize(folder, self.repo.list_items(folder.id))

    def delete_folder(self, actor: User, folder_id: int) -> None:
        folder = self._owned_folder(actor, folder_id)
        self.repo.delete(folder)
        self.db.commit()

    def add_item(
        self, actor: User, folder_id: int, body: LetterFolderItemCreate
    ) -> LetterFolderItemResponse:
        folder = self._owned_folder(actor, folder_id)
        submission_id = body.submission_id
        batch_id = (body.batch_id or "").strip() or None
        if folder.scope == "received":
            if submission_id is None or batch_id is not None:
                raise HTTPException(
                    status_code=400,
                    detail="برای پوشه دریافتی فقط شناسه نامه لازم است.",
                )
            self._ensure_can_organize_received(actor, submission_id)
            existing = self.repo.find_item(folder.id, submission_id=submission_id)
            if existing:
                return LetterFolderItemResponse(
                    id=existing.id,
                    submission_id=existing.submission_id,
                    batch_id=existing.batch_id,
                )
            item = LetterFolderItem(
                folder_id=folder.id,
                user_id=actor.id,
                submission_id=submission_id,
            )
        else:
            if batch_id is None or submission_id is not None:
                raise HTTPException(
                    status_code=400,
                    detail="برای پوشه ارسالی فقط شناسه دسته نامه لازم است.",
                )
            self._ensure_can_organize_sent(actor, batch_id)
            existing = self.repo.find_item(folder.id, batch_id=batch_id)
            if existing:
                return LetterFolderItemResponse(
                    id=existing.id,
                    submission_id=existing.submission_id,
                    batch_id=existing.batch_id,
                )
            item = LetterFolderItem(
                folder_id=folder.id,
                user_id=actor.id,
                batch_id=batch_id,
            )
        self.repo.add_item(item)
        folder.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(item)
        return LetterFolderItemResponse(
            id=item.id,
            submission_id=item.submission_id,
            batch_id=item.batch_id,
        )

    def remove_item(self, actor: User, folder_id: int, item_id: int) -> None:
        folder = self._owned_folder(actor, folder_id)
        item = self.repo.get_item(item_id, folder.id)
        if item is None:
            raise HTTPException(status_code=404, detail="آیتم پوشه یافت نشد.")
        self.repo.delete_item(item)
        folder.updated_at = datetime.utcnow()
        self.db.commit()

    def _owned_folder(self, actor: User, folder_id: int) -> LetterFolder:
        folder = self.repo.get_for_user(folder_id, actor.id)
        if folder is None:
            raise HTTPException(status_code=404, detail="پوشه یافت نشد.")
        return folder

    def _ensure_can_organize_received(self, actor: User, submission_id: int) -> None:
        submission = (
            self.db.query(Submission).filter(Submission.id == submission_id).first()
        )
        if submission is None or submission.form_id != MANAGEMENT_LETTER_FORM_ID:
            raise HTTPException(status_code=404, detail="نامه یافت نشد.")
        # Received folders are for the caller's inbox copies only (direct or CC).
        is_inbox_copy = user_is_referral_recipient(
            self.db, actor.id, submission.id
        ) or user_is_cc_recipient(self.db, actor.id, submission.id)
        if not is_inbox_copy:
            raise HTTPException(status_code=404, detail="نامه یافت نشد.")

    def _ensure_can_organize_sent(self, actor: User, batch_id: str) -> None:
        query = self.db.query(Submission).filter(
            Submission.form_id == MANAGEMENT_LETTER_FORM_ID
        )
        if not actor.is_admin:
            query = query.filter(Submission.user_id == actor.id)
        if batch_id.startswith("single-"):
            try:
                submission_id = int(batch_id.removeprefix("single-"))
            except ValueError as exc:
                raise HTTPException(
                    status_code=404, detail="نامه ارسالی یافت نشد."
                ) from exc
            query = query.filter(Submission.id == submission_id)
        else:
            query = query.filter(Submission.data.contains(batch_id))
        matched = [row for row in query.limit(50).all() if self._batch_id(row) == batch_id]
        if not matched:
            raise HTTPException(status_code=404, detail="نامه ارسالی یافت نشد.")

    @staticmethod
    def _batch_id(submission: Submission) -> str:
        try:
            data = json.loads(submission.data or "{}")
        except (json.JSONDecodeError, TypeError):
            data = {}
        if not isinstance(data, dict):
            data = {}
        return str(data.get("letter_batch_id") or f"single-{submission.id}")

    @staticmethod
    def _clean_name(raw: str) -> str:
        name = " ".join((raw or "").strip().split())
        if not name:
            raise HTTPException(status_code=400, detail="نام پوشه الزامی است.")
        if len(name) > MAX_FOLDER_NAME_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"نام پوشه حداکثر می‌تواند {MAX_FOLDER_NAME_LENGTH} نویسه باشد.",
            )
        return name

    @staticmethod
    def _serialize(
        folder: LetterFolder, items: list[LetterFolderItem]
    ) -> LetterFolderResponse:
        submission_ids = [
            item.submission_id for item in items if item.submission_id is not None
        ]
        batch_ids = [item.batch_id for item in items if item.batch_id]
        return LetterFolderResponse(
            id=folder.id,
            name=folder.name,
            scope=folder.scope,  # type: ignore[arg-type]
            sort_order=folder.sort_order,
            item_count=len(items),
            submission_ids=submission_ids,
            batch_ids=batch_ids,
        )
