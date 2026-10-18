"""Personal letter folder CRUD and membership rules."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.letter_folders import router as folders_router
from app.api.routes.management_letters import router as letters_router
from app.api.routes.portal import router as portal_router
from app.core.deps import get_current_user, get_optional_user
from app.db.base import Base
from app.db.session import get_db
from app.models.department import Department  # noqa: F401
from app.models.letter_folder import LetterFolder, LetterFolderItem  # noqa: F401
from app.models.submission import Submission, SubmissionView  # noqa: F401
from app.models.user import User
from app.services.management_letter_service import create_management_letters


class LetterFolderTests(unittest.TestCase):
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
        self.sender = self._user("sender", "فرستنده", is_admin=True)
        self.recipient = self._user("recipient", "گیرنده", is_letter_recipient=True)
        self.other = self._user("other", "دیگری")
        self.db.commit()
        for user in (self.sender, self.recipient, self.other):
            self.db.refresh(user)

        self._actor = self.sender
        app = FastAPI()
        app.include_router(portal_router, prefix="/api/v1")
        app.include_router(letters_router, prefix="/api/v1")
        app.include_router(folders_router, prefix="/api/v1")

        def override_db():
            yield self.db

        def override_user():
            return self._actor

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_optional_user] = override_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()

    def _user(self, username: str, name: str, **flags) -> User:
        user = User(username=username, display_name=name, is_active=True, **flags)
        self.db.add(user)
        self.db.flush()
        return user

    def _letter(self) -> Submission:
        return create_management_letters(
            self.db,
            actor=self.sender,
            subject="نامه پوشه",
            description="متن",
            letter_number="۱",
            needs_reply="دارد",
            needs_action="دارد",
            due_date="1404/07/20",
            sender="بانک",
            recipient_ids=[self.recipient.id],
        )[0]

    def test_create_list_rename_delete_received_folder(self):
        created = self.client.post(
            "/api/v1/management-letters/folders",
            json={"name": " پروژه‌ها ", "scope": "received"},
        )
        self.assertEqual(created.status_code, 201, created.text)
        body = created.json()
        self.assertEqual(body["name"], "پروژه‌ها")
        self.assertEqual(body["scope"], "received")
        self.assertEqual(body["item_count"], 0)

        listing = self.client.get(
            "/api/v1/management-letters/folders",
            params={"scope": "received"},
        )
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()), 1)

        renamed = self.client.patch(
            f"/api/v1/management-letters/folders/{body['id']}",
            json={"name": "پیگیری"},
        )
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.json()["name"], "پیگیری")

        deleted = self.client.delete(
            f"/api/v1/management-letters/folders/{body['id']}"
        )
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(
            self.client.get("/api/v1/management-letters/folders").json(),
            [],
        )

    def test_add_received_and_sent_items_and_isolate_by_owner(self):
        letter = self._letter()
        received = self.client.post(
            "/api/v1/management-letters/folders",
            json={"name": "کاری", "scope": "received"},
        ).json()
        sent = self.client.post(
            "/api/v1/management-letters/folders",
            json={"name": "پیگیری ارسالی", "scope": "sent"},
        ).json()

        # Sender cannot put another user's received copy into received folders.
        denied = self.client.post(
            f"/api/v1/management-letters/folders/{received['id']}/items",
            json={"submission_id": letter.id},
        )
        self.assertEqual(denied.status_code, 404)

        self._actor = self.recipient
        added_received = self.client.post(
            f"/api/v1/management-letters/folders/{received['id']}/items",
            json={"submission_id": letter.id},
        )
        # Folder belongs to sender; recipient gets 404.
        self.assertEqual(added_received.status_code, 404)

        recipient_folder = self.client.post(
            "/api/v1/management-letters/folders",
            json={"name": "صندوق من", "scope": "received"},
        ).json()
        ok_received = self.client.post(
            f"/api/v1/management-letters/folders/{recipient_folder['id']}/items",
            json={"submission_id": letter.id},
        )
        self.assertEqual(ok_received.status_code, 201, ok_received.text)
        self.assertEqual(ok_received.json()["submission_id"], letter.id)

        self._actor = self.sender
        report = self.client.get(
            "/api/v1/management-letters/report",
            params={"letter_type": "external", "mine": True},
        )
        self.assertEqual(report.status_code, 200, report.text)
        batch_id = report.json()[0]["batch_id"]
        progress = report.json()[0]["recipients"][0].get("progress_percent")
        self.assertEqual(progress, 0)

        ok_sent = self.client.post(
            f"/api/v1/management-letters/folders/{sent['id']}/items",
            json={"batch_id": batch_id},
        )
        self.assertEqual(ok_sent.status_code, 201, ok_sent.text)
        folders = self.client.get(
            "/api/v1/management-letters/folders",
            params={"scope": "sent"},
        ).json()
        self.assertEqual(folders[0]["batch_ids"], [batch_id])
        self.assertEqual(folders[0]["item_count"], 1)

        self._actor = self.other
        other_denied = self.client.post(
            f"/api/v1/management-letters/folders/{sent['id']}/items",
            json={"batch_id": batch_id},
        )
        self.assertEqual(other_denied.status_code, 404)


if __name__ == "__main__":
    unittest.main()
