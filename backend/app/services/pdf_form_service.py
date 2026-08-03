from pathlib import Path
import uuid

from fastapi import HTTPException, UploadFile

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


async def read_pdf_upload(pdf: UploadFile) -> bytes:
    content = await pdf.read(20 * 1024 * 1024 + 1)
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="حجم فایل PDF نباید بیشتر از ۲۰ مگابایت باشد.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="فایل انتخاب‌شده باید با فرمت PDF باشد.")
    return content


def save_pdf_file(category: str, content: bytes) -> Path:
    destination = category_upload_dir(category) / f"{uuid.uuid4().hex}.pdf"
    destination.write_bytes(content)
    return destination


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
