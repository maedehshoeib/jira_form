"""Validated file storage for portal card logos and document attachments."""

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

LOGO_MAX_BYTES = 5 * 1024 * 1024
FILE_MAX_BYTES = 20 * 1024 * 1024
LOGO_MEDIA_TYPES = {
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}
FILE_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt": "text/plain",
    "zip": "application/zip",
    **LOGO_MEDIA_TYPES,
}
_OOXML_EXTENSIONS = {"docx", "xlsx", "pptx", "zip"}
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


class PortalCardStorage:
    """Stores uploads under ``UPLOAD_DIR/portal-cards`` with generated names."""

    @staticmethod
    def upload_dir() -> Path:
        path = (Path(settings.UPLOAD_DIR) / "portal-cards").resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    def safe_path(self, stored: str) -> Path | None:
        if not stored:
            return None
        path = Path(stored).resolve()
        if path.parent != self.upload_dir() or not path.is_file():
            return None
        return path

    def delete(self, stored: str) -> None:
        path = self.safe_path(stored)
        if not path:
            return
        try:
            path.unlink()
        except OSError:
            pass

    async def store_logo(self, upload: UploadFile | None) -> tuple[str, str] | None:
        if upload is None or not (upload.filename or "").strip():
            return None
        content = await upload.read(LOGO_MAX_BYTES + 1)
        if len(content) > LOGO_MAX_BYTES:
            raise HTTPException(
                status_code=413, detail="حجم لوگو نباید بیشتر از ۵ مگابایت باشد."
            )
        extension = self._detect_image_extension(content)
        if not extension:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="فرمت لوگو باید JPG، PNG یا WebP باشد.",
            )
        return self._write(content, extension), (upload.filename or "logo")[:256]

    async def store_file(
        self, upload: UploadFile | None
    ) -> tuple[str, str, int] | None:
        if upload is None or not (upload.filename or "").strip():
            return None
        content = await upload.read(FILE_MAX_BYTES + 1)
        if len(content) > FILE_MAX_BYTES:
            raise HTTPException(
                status_code=413, detail="حجم فایل نباید بیشتر از ۲۰ مگابایت باشد."
            )
        extension = Path(upload.filename or "").suffix.lstrip(".").lower()
        if extension not in FILE_MEDIA_TYPES or not self._signature_matches(
            extension, content
        ):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    "فرمت فایل مجاز نیست. PDF، Word، Excel، PowerPoint، تصویر، "
                    "TXT یا ZIP ارسال کنید."
                ),
            )
        name = (upload.filename or f"file.{extension}")[:256]
        return self._write(content, extension), name, len(content)

    def media_type(self, path: Path) -> str:
        return FILE_MEDIA_TYPES.get(path.suffix.lstrip(".").lower(), "application/octet-stream")

    def _write(self, content: bytes, extension: str) -> str:
        destination = self.upload_dir() / f"{uuid.uuid4().hex}.{extension}"
        destination.write_bytes(content)
        return str(destination)

    @staticmethod
    def _detect_image_extension(content: bytes) -> str | None:
        if content.startswith(b"\xff\xd8\xff"):
            return "jpg"
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            return "png"
        if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
            return "webp"
        return None

    def _signature_matches(self, extension: str, content: bytes) -> bool:
        if extension == "pdf":
            return content.startswith(b"%PDF-")
        if extension in _OOXML_EXTENSIONS:
            return content.startswith(b"PK")
        if extension in {"doc", "xls", "ppt"}:
            return content.startswith(_OLE_MAGIC)
        if extension in LOGO_MEDIA_TYPES:
            return self._detect_image_extension(content) is not None
        return True  # txt: no reliable signature
