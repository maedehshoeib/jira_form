import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.models.department import Department  # noqa: F401
from app.models.job_description import JobDescription  # noqa: F401
from app.models.user import User
from app.schemas.job_description import JobDescriptionFields
from app.services.job_description_service import JobDescriptionService


class _Upload:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.read = AsyncMock(return_value=content)


class JobDescriptionServiceTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.upload_root = tempfile.TemporaryDirectory()
        self._original_upload_dir = settings.UPLOAD_DIR
        settings.UPLOAD_DIR = self.upload_root.name
        self.admin = User(
            username="admin",
            display_name="مدیر",
            is_active=True,
            is_admin=True,
            must_change_password=False,
        )
        self.db.add(self.admin)
        self.db.commit()
        self.service = JobDescriptionService(self.db)
        self.fields = JobDescriptionFields(
            organizational_position="کارشناس منابع انسانی",
            organizational_unit="معاونت توسعه منابع",
            unit_responsibility="پشتیبانی فرآیندهای منابع انسانی",
            qualification_requirements="حداقل مدرک کارشناسی مرتبط",
        )

    def tearDown(self):
        settings.UPLOAD_DIR = self._original_upload_dir
        self.db.close()
        self.upload_root.cleanup()

    async def test_create_list_and_delete(self):
        photo = _Upload("avatar.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32)
        attachment = _Upload("spec.pdf", b"%PDF-1.4 sample")
        created = await self.service.create(
            self.admin, self.fields, photo, attachment  # type: ignore[arg-type]
        )
        self.assertEqual(created.organizational_position, self.fields.organizational_position)
        self.assertTrue(created.photo_url)
        self.assertTrue(created.has_attachment)
        self.assertEqual(len(self.service.list_items()), 1)

        photo_path, _, media_type = self.service.resolve_photo(created.id)
        self.assertTrue(photo_path.is_file())
        self.assertEqual(media_type, "image/png")

        self.service.delete(created.id)
        self.assertEqual(self.service.list_items(), [])
        self.assertFalse(photo_path.exists())

    async def test_rejects_invalid_photo(self):
        bad_photo = _Upload("notes.txt", b"not-an-image")
        with self.assertRaises(HTTPException) as raised:
            await self.service.create(
                self.admin, self.fields, bad_photo, None  # type: ignore[arg-type]
            )
        self.assertEqual(raised.exception.status_code, 415)

    async def test_update_can_remove_attachment(self):
        attachment = _Upload("notes.txt", b"plain text file")
        created = await self.service.create(
            self.admin, self.fields, None, attachment  # type: ignore[arg-type]
        )
        stored = Path(self.service._require(created.id).attachment_path)
        self.assertTrue(stored.is_file())

        updated = await self.service.update(
            created.id,
            self.fields,
            None,
            None,
            remove_attachment=True,
        )
        self.assertFalse(updated.has_attachment)
        self.assertFalse(stored.exists())


if __name__ == "__main__":
    unittest.main()
