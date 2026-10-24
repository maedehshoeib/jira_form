from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.models.pdf_form import DEFAULT_PDF_CATEGORY, PDF_CATEGORIES


CATEGORY_LABELS = {
    "forms": "فرم",
    "training": "آموزش",
    "guidelines": "دستورالعمل",
    "documents": "مستندات",
}


def normalize_pdf_category(category: str | None) -> str:
    value = (category or DEFAULT_PDF_CATEGORY).strip().lower()
    if value not in PDF_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail="دسته محتوا نامعتبر است.",
        )
    return value


def category_upload_dir(category: str) -> Path:
    path = (Path(settings.UPLOAD_DIR) / category).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


LIBRARY_MAX_BYTES = 20 * 1024 * 1024
LIBRARY_TYPE_ERROR = (
    "فرمت فایل مجاز نیست. PDF، Word، Excel، PowerPoint، JPG، PNG، WebP، "
    "GIF، TXT، CSV یا ZIP ارسال کنید."
)
LIBRARY_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
    "txt": "text/plain",
    "csv": "text/csv",
    "zip": "application/zip",
}
_OOXML_EXTENSIONS = {"docx", "xlsx", "pptx", "zip"}
_OLE_EXTENSIONS = {"doc", "xls", "ppt"}
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def library_media_type(file_name: str) -> str:
    extension = Path(file_name).suffix.lstrip(".").lower()
    return LIBRARY_MEDIA_TYPES.get(extension, "application/octet-stream")


def _display_name(filename: str | None, extension: str) -> str:
    raw = (filename or "").replace("\\", "/").replace("\x00", "").split("/")[-1].strip()
    if not raw or raw in {".", ".."}:
        raw = f"file.{extension}"
    return raw[:256]


def _extension_of(filename: str | None) -> str:
    return Path(_display_name(filename, "")).suffix.lstrip(".").lower()


async def read_library_upload(upload: UploadFile) -> tuple[bytes, str, str]:
    content = await upload.read(LIBRARY_MAX_BYTES + 1)
    if len(content) > LIBRARY_MAX_BYTES:
        raise HTTPException(status_code=413, detail="حجم فایل نباید بیشتر از ۲۰ مگابایت باشد.")
    if not content:
        raise HTTPException(status_code=422, detail="فایل خالی است.")
    extension = _extension_of(upload.filename)
    if extension not in LIBRARY_MEDIA_TYPES or not _signature_matches(extension, content):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=LIBRARY_TYPE_ERROR,
        )
    return content, extension, _display_name(upload.filename, extension)


def save_library_file(category: str, content: bytes, extension: str) -> Path:
    normalized = extension.lower().lstrip(".")
    if normalized not in LIBRARY_MEDIA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=LIBRARY_TYPE_ERROR,
        )
    destination = category_upload_dir(category) / f"{uuid.uuid4().hex}.{normalized}"
    destination.write_bytes(content)
    return destination


def _image_kind(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "webp"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    return None


def _signature_matches(extension: str, content: bytes) -> bool:
    if extension == "pdf":
        return content.startswith(b"%PDF-")
    if extension in _OOXML_EXTENSIONS:
        return content.startswith(b"PK")
    if extension in _OLE_EXTENSIONS:
        return content.startswith(_OLE_MAGIC)
    if extension in {"jpg", "jpeg"}:
        return _image_kind(content) == "jpg"
    if extension in {"png", "webp", "gif"}:
        return _image_kind(content) == extension
    if extension in {"txt", "csv"}:
        return b"\x00" not in content[:8192]
    return False


def delete_pdf_file(file_path: str, category: str) -> None:
    path = Path(file_path).resolve()
    upload_dir = category_upload_dir(category)
    # Also allow legacy files that lived under uploads/forms.
    forms_dir = category_upload_dir("forms")
    if path.parent in {upload_dir, forms_dir} and path.is_file():
        try:
            path.unlink()
        except OSError:
            pass


def validate_pdf_metadata(title: str, description: str, category: str) -> tuple[str, str]:
    normalized_title = title.strip()
    label = CATEGORY_LABELS.get(category, "محتوا")
    if not normalized_title:
        raise HTTPException(status_code=422, detail=f"عنوان {label} الزامی است.")
    if len(normalized_title) > 256 or len(description) > 2000:
        raise HTTPException(status_code=422, detail="عنوان یا توضیحات بیش از حد طولانی است.")
    return normalized_title, description.strip()
