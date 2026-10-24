import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi import HTTPException

from app.core.config import settings
from app.services.pdf_form_service import (
    delete_pdf_file,
    library_media_type,
    read_library_upload,
    save_library_file,
)


class _Upload:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.read = AsyncMock(return_value=content)


PNG = b"\x89PNG\r\n\x1a\n" + b"png"
JPEG = b"\xff\xd8\xff" + b"jpg"
OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"ole"
ZIP = b"PK\x03\x04" + b"zip"


class LibraryUploadTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.upload_root = tempfile.TemporaryDirectory()
        self._original_upload_dir = settings.UPLOAD_DIR
        settings.UPLOAD_DIR = self.upload_root.name

    def tearDown(self):
        settings.UPLOAD_DIR = self._original_upload_dir
        self.upload_root.cleanup()

    async def test_accepts_images_office_and_pdf(self):
        cases = [
            ("guide.PDF", b"%PDF-1.4 body", "pdf", "application/pdf"),
            ("photo.PNG", PNG, "png", "image/png"),
            ("scan.jpeg", JPEG, "jpeg", "image/jpeg"),
            ("brief.docx", ZIP, "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            ("sheet.xlsx", ZIP, "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            ("deck.pptx", ZIP, "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            ("legacy.doc", OLE, "doc", "application/msword"),
            ("legacy.xls", OLE, "xls", "application/vnd.ms-excel"),
            ("legacy.ppt", OLE, "ppt", "application/vnd.ms-powerpoint"),
            ("notes.txt", "متن".encode(), "txt", "text/plain"),
            ("bundle.zip", ZIP, "zip", "application/zip"),
        ]
        for filename, content, extension, media_type in cases:
            with self.subTest(filename=filename):
                data, stored_extension, name = await read_library_upload(
                    _Upload(filename, content)  # type: ignore[arg-type]
                )
                self.assertEqual(stored_extension, extension)
                self.assertEqual(name, filename)
                self.assertEqual(data, content)
                path = save_library_file("guidelines", data, stored_extension)
                self.assertEqual(path.suffix, f".{extension}")
                self.assertTrue(path.is_file())
                self.assertEqual(library_media_type(path.name), media_type)
                delete_pdf_file(str(path), "guidelines")
                self.assertFalse(path.exists())

    async def test_strips_directory_from_filename(self):
        _, extension, name = await read_library_upload(
            _Upload(r"..\..\secret.png", PNG)  # type: ignore[arg-type]
        )
        self.assertEqual(extension, "png")
        self.assertEqual(name, "secret.png")

    async def test_rejects_disguised_and_unknown_types(self):
        rejected = [
            ("fake.pdf", b"not a pdf"),
            ("photo.png", JPEG),
            ("sheet.xlsx", OLE),
            ("notes.txt", b"text\x00binary"),
            ("program.exe", b"MZ"),
            ("empty.pdf", b""),
        ]
        for filename, content in rejected:
            with self.subTest(filename=filename):
                with self.assertRaises(HTTPException) as caught:
                    await read_library_upload(_Upload(filename, content))  # type: ignore[arg-type]
                self.assertIn(caught.exception.status_code, {413, 415, 422})

    async def test_rejects_oversized_file(self):
        content = b"%PDF-" + (b"x" * (20 * 1024 * 1024))
        with self.assertRaises(HTTPException) as caught:
            await read_library_upload(_Upload("big.pdf", content))  # type: ignore[arg-type]
        self.assertEqual(caught.exception.status_code, 413)

    def test_refuses_to_save_unknown_extension(self):
        with self.assertRaises(HTTPException):
            save_library_file("forms", b"data", "exe")
        self.assertEqual(list(Path(self.upload_root.name).rglob("*.exe")), [])
