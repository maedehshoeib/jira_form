from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.job_description import JobDescription
from app.models.user import User
from app.repositories.job_description import JobDescriptionRepository
from app.schemas.job_description import JobDescriptionFields, JobDescriptionResponse
from app.services.base import BaseService

PHOTO_MAX_BYTES = 10 * 1024 * 1024
ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024
PHOTO_MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}
ATTACHMENT_EXTENSIONS = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "txt": "text/plain",
    "zip": "application/zip",
}


class JobDescriptionService(BaseService):
    def __init__(self, db: Session) -> None:
        super().__init__(db)
        self.repo = JobDescriptionRepository(db)

    def list_items(self) -> list[JobDescriptionResponse]:
        return [self._serialize(item) for item in self.repo.list_all()]

    def get_item(self, item_id: int) -> JobDescriptionResponse:
        return self._serialize(self._require(item_id))

    def resolve_photo(self, item_id: int) -> tuple[Path, str, str]:
        item = self._require(item_id)
        path = self._safe_path(item.photo_path)
        if not path:
            raise HTTPException(status_code=404, detail="تصویر یافت نشد.")
        extension = path.suffix.lstrip(".").lower()
        media_type = PHOTO_MEDIA_TYPES.get(extension, "application/octet-stream")
        return path, item.photo_name or path.name, media_type

    def resolve_attachment(self, item_id: int) -> tuple[Path, str, str]:
        item = self._require(item_id)
        path = self._safe_path(item.attachment_path)
        if not path:
            raise HTTPException(status_code=404, detail="پیوست یافت نشد.")
        extension = path.suffix.lstrip(".").lower()
        media_type = ATTACHMENT_EXTENSIONS.get(extension, "application/octet-stream")
        return path, item.attachment_name or path.name, media_type

    async def create(
        self,
        actor: User,
        fields: JobDescriptionFields,
        photo: UploadFile | None,
        attachment: UploadFile | None,
    ) -> JobDescriptionResponse:
        photo_path, photo_name = await self._store_photo(photo)
        attachment_path, attachment_name, attachment_size = await self._store_attachment(
            attachment
        )
        item = JobDescription(
            **fields.model_dump(),
            photo_path=photo_path or "",
            photo_name=photo_name or "",
            attachment_path=attachment_path or "",
            attachment_name=attachment_name or "",
            attachment_size=attachment_size,
            uploaded_by_id=actor.id,
        )
        self.repo.add(item)
        self.db.commit()
        self.db.refresh(item)
        return self._serialize(item)

    async def update(
        self,
        item_id: int,
        fields: JobDescriptionFields,
        photo: UploadFile | None,
        attachment: UploadFile | None,
        *,
        remove_photo: bool = False,
        remove_attachment: bool = False,
    ) -> JobDescriptionResponse:
        item = self._require(item_id)
        old_photo, old_attachment = item.photo_path, item.attachment_path

        new_photo_path, new_photo_name = await self._store_photo(photo)
        new_attachment = await self._store_attachment(attachment)

        for key, value in fields.model_dump().items():
            setattr(item, key, value)

        if new_photo_path:
            item.photo_path = new_photo_path
            item.photo_name = new_photo_name or ""
        elif remove_photo:
            item.photo_path = ""
            item.photo_name = ""

        if new_attachment[0]:
            item.attachment_path = new_attachment[0]
            item.attachment_name = new_attachment[1] or ""
            item.attachment_size = new_attachment[2]
        elif remove_attachment:
            item.attachment_path = ""
            item.attachment_name = ""
            item.attachment_size = 0

        self.db.commit()
        self.db.refresh(item)

        if (new_photo_path or remove_photo) and old_photo and old_photo != item.photo_path:
            self._delete_file(old_photo)
        if (
            new_attachment[0] or remove_attachment
        ) and old_attachment and old_attachment != item.attachment_path:
            self._delete_file(old_attachment)
        return self._serialize(item)

    def delete(self, item_id: int) -> None:
        item = self._require(item_id)
        photo_path, attachment_path = item.photo_path, item.attachment_path
        self.repo.delete(item)
        self.db.commit()
        self._delete_file(photo_path)
        self._delete_file(attachment_path)

    def _require(self, item_id: int) -> JobDescription:
        item = self.repo.get(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="شرح وظایف یافت نشد.")
        return item

    @staticmethod
    def _serialize(item: JobDescription) -> JobDescriptionResponse:
        return JobDescriptionResponse(
            id=item.id,
            organizational_position=item.organizational_position,
            organizational_unit=item.organizational_unit,
            unit_responsibility=item.unit_responsibility,
            qualification_requirements=item.qualification_requirements,
            photo_url=(
                f"/api/v1/job-descriptions/{item.id}/photo" if item.photo_path else None
            ),
            photo_name=item.photo_name or "",
            has_attachment=bool(item.attachment_path),
            attachment_name=item.attachment_name or "",
            attachment_size=item.attachment_size or 0,
            uploaded_by_id=item.uploaded_by_id,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    def _upload_dir(self) -> Path:
        path = (Path(settings.UPLOAD_DIR) / "job-descriptions").resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _safe_path(self, stored: str) -> Path | None:
        if not stored:
            return None
        path = Path(stored).resolve()
        if path.parent != self._upload_dir() or not path.is_file():
            return None
        return path

    def _delete_file(self, stored: str) -> None:
        path = self._safe_path(stored)
        if not path:
            return
        try:
            path.unlink()
        except OSError:
            pass

    async def _store_photo(
        self, upload: UploadFile | None
    ) -> tuple[str | None, str | None]:
        if upload is None or not (upload.filename or "").strip():
            return None, None
        content = await upload.read(PHOTO_MAX_BYTES + 1)
        if len(content) > PHOTO_MAX_BYTES:
            raise HTTPException(
                status_code=413, detail="حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد."
            )
        extension = self._detect_photo_extension(content)
        destination = self._upload_dir() / f"{uuid.uuid4().hex}.{extension}"
        destination.write_bytes(content)
        return str(destination), (upload.filename or f"photo.{extension}")[:256]

    async def _store_attachment(
        self, upload: UploadFile | None
    ) -> tuple[str | None, str | None, int]:
        if upload is None or not (upload.filename or "").strip():
            return None, None, 0
        content = await upload.read(ATTACHMENT_MAX_BYTES + 1)
        if len(content) > ATTACHMENT_MAX_BYTES:
            raise HTTPException(
                status_code=413, detail="حجم پیوست نباید بیشتر از ۲۰ مگابایت باشد."
            )
        extension = self._detect_attachment_extension(upload.filename or "", content)
        destination = self._upload_dir() / f"{uuid.uuid4().hex}.{extension}"
        destination.write_bytes(content)
        name = (upload.filename or f"attachment.{extension}")[:256]
        return str(destination), name, len(content)

    @staticmethod
    def _detect_photo_extension(content: bytes) -> str:
        signatures = {
            "jpg": content.startswith(b"\xff\xd8\xff"),
            "png": content.startswith(b"\x89PNG\r\n\x1a\n"),
            "webp": len(content) >= 12
            and content.startswith(b"RIFF")
            and content[8:12] == b"WEBP",
        }
        extension = next((ext for ext, matches in signatures.items() if matches), None)
        if not extension:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="فرمت تصویر باید JPG، PNG یا WebP باشد.",
            )
        return extension

    @staticmethod
    def _detect_attachment_extension(filename: str, content: bytes) -> str:
        extension = Path(filename).suffix.lstrip(".").lower()
        if extension not in ATTACHMENT_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="فرمت پیوست مجاز نیست. PDF، Word، Excel، TXT یا ZIP ارسال کنید.",
            )
        if extension == "pdf" and not content.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="فایل PDF نامعتبر است.",
            )
        if extension in {"docx", "xlsx", "zip"} and not content.startswith(b"PK"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="فایل پیوست نامعتبر است.",
            )
        return extension
