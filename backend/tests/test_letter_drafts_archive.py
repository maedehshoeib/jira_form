"""Letter drafts folder and per-user archive behaviour."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.management_letter_drafts import router as drafts_router
from app.api.routes.management_letters import router as letters_router
from app.api.routes.portal import router as portal_router
from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.db.base import Base
from app.db.session import get_db
from app.models.department import Department  # noqa: F401
from app.models.submission import LetterDraft, Submission, SubmissionView
from app.models.user import User
from app.services.management_letter_service import create_management_letters
from app.services.task_workflow_service import list_unseen_letter_ids


class LetterDraftsArchiveTests(unittest.TestCase):
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
        self.tmp = tempfile.TemporaryDirectory()
        self.upload_patch = patch.object(settings, "UPLOAD_DIR", self.tmp.name)
        self.upload_patch.start()

        self.author = self._user("author", "نویسنده", is_admin=True)
        self.recipient = self._user("recipient", "گیرنده", is_letter_recipient=True)
        self.other = self._user("other", "دیگری")
        self.db.commit()
        for user in (self.author, self.recipient, self.other):
            self.db.refresh(user)

        self._actor = self.author
        app = FastAPI()
        app.include_router(portal_router, prefix="/api/v1")
        app.include_router(letters_router, prefix="/api/v1")
        app.include_router(drafts_router, prefix="/api/v1")

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
        self.upload_patch.stop()
        self.tmp.cleanup()

    def _user(self, username: str, name: str, **flags) -> User:
        user = User(username=username, display_name=name, is_active=True, **flags)
        self.db.add(user)
        self.db.flush()
        return user

    def _letter(self) -> Submission:
        return create_management_letters(
            self.db,
            actor=self.author,
            subject="نامه بایگانی",
            description="متن",
            letter_number="۱",
            needs_reply="ندارد",
            needs_action="ندارد(جهت اطلاع)",
            sender="بانک",
            recipient_ids=[self.recipient.id],
        )[0]

    def _draft_form(self, **overrides) -> dict:
        data = {
            "letter_type": "external",
            "subject": "پیش‌نویس",
            "description": "متن پیش‌نویس",
            "letter_number": "۱۲",
            "needs_reply": "ندارد",
            "needs_action": "ندارد(جهت اطلاع)",
            "sender": "بانک",
            "recipient_ids": json.dumps([self.recipient.id]),
        }
        data.update(overrides)
        return data

    def test_archive_hides_letter_from_unseen_and_round_trips(self):
        letter = self._letter()
        self.assertIn(letter.id, list_unseen_letter_ids(self.db, self.recipient.id))

        self._actor = self.recipient
        response = self.client.patch(
            f"/api/v1/tasks/{letter.id}/archive", json={"archived": True}
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_archived"])
        self.assertNotIn(letter.id, list_unseen_letter_ids(self.db, self.recipient.id))

        listed = self.client.get("/api/v1/tasks").json()
        self.assertTrue(next(i for i in listed if i["id"] == letter.id)["is_archived"])

        response = self.client.patch(
            f"/api/v1/tasks/{letter.id}/archive", json={"archived": False}
        )
        self.assertFalse(response.json()["is_archived"])
        view = (
            self.db.query(SubmissionView)
            .filter_by(submission_id=letter.id, user_id=self.recipient.id)
            .one()
        )
        self.assertFalse(view.is_archived)

    def test_archive_requires_visibility(self):
        letter = self._letter()
        self._actor = self.other
        response = self.client.patch(
            f"/api/v1/tasks/{letter.id}/archive", json={"archived": True}
        )
        self.assertEqual(response.status_code, 404)

    def test_draft_crud_is_owner_only(self):
        created = self.client.post(
            "/api/v1/management-letters/drafts",
            data=self._draft_form(),
            files=[("attachments", ("a.txt", b"hello", "text/plain"))],
        )
        self.assertEqual(created.status_code, 200, created.text)
        draft = created.json()
        self.assertEqual(draft["recipient_ids"], [self.recipient.id])
        self.assertEqual(draft["attachment_names"], ["a.txt"])

        listing = self.client.get("/api/v1/management-letters/drafts").json()
        self.assertEqual([item["id"] for item in listing], [draft["id"]])

        self._actor = self.other
        url = f"/api/v1/management-letters/drafts/{draft['id']}"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(self.client.get("/api/v1/management-letters/drafts").json(), [])

        self._actor = self.author
        updated = self.client.put(
            url,
            data=self._draft_form(subject="ویرایش‌شده", remove_attachments="[0]"),
        )
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["subject"], "ویرایش‌شده")
        self.assertEqual(updated.json()["attachment_names"], [])
        self.assertEqual(list(Path(self.tmp.name).iterdir()), [])

        self.assertEqual(self.client.delete(url).status_code, 200)
        self.assertEqual(self.db.query(LetterDraft).count(), 0)

    def test_send_from_draft_creates_letter_and_removes_draft(self):
        created = self.client.post(
            "/api/v1/management-letters/drafts",
            data=self._draft_form(),
            files=[("attachments", ("a.txt", b"hello", "text/plain"))],
        ).json()

        sent = self.client.post(
            f"/api/v1/management-letters/drafts/{created['id']}/send",
            data=self._draft_form(),
        )
        self.assertEqual(sent.status_code, 200, sent.text)
        self.assertEqual(sent.json()["count"], 1)
        self.assertEqual(self.db.query(LetterDraft).count(), 0)

        submission = self.db.get(Submission, sent.json()["ids"][0])
        stored = json.loads(submission.data)["_attachments"]
        self.assertEqual([item["name"] for item in stored], ["a.txt"])
        self.assertTrue(Path(stored[0]["path"]).exists())

    def test_sent_report_mine_filter_and_read_state(self):
        letter = self._letter()
        url = "/api/v1/management-letters/report?letter_type=external&mine=true"

        report = self.client.get(url).json()
        self.assertEqual(len(report), 1)
        self.assertFalse(report[0]["recipients"][0]["is_read"])

        self._actor = self.recipient
        self.assertEqual(self.client.get(f"/api/v1/tasks/{letter.id}").status_code, 200)
        self._actor = self.author
        report = self.client.get(url).json()
        self.assertTrue(report[0]["recipients"][0]["is_read"])

        self._actor = self._user("boss", "مدیر", is_admin=True)
        self.db.commit()
        all_rows = "/api/v1/management-letters/report?letter_type=external"
        self.assertEqual(len(self.client.get(all_rows).json()), 1)
        self.assertEqual(self.client.get(url).json(), [])

    def test_failed_send_keeps_draft(self):
        created = self.client.post(
            "/api/v1/management-letters/drafts",
            data=self._draft_form(subject=""),
        ).json()
        response = self.client.post(
            f"/api/v1/management-letters/drafts/{created['id']}/send",
            data=self._draft_form(subject=""),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.db.query(LetterDraft).count(), 1)


if __name__ == "__main__":
    unittest.main()
