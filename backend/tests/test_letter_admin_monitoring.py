"""Letters behave like tasks over HTTP, and admins can monitor every detail."""

from __future__ import annotations

import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.portal import router as portal_router
from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.db.base import Base
from app.db.session import get_db
from app.models.department import Department  # noqa: F401 - registers FK target
from app.models.submission import Submission
from app.models.user import User
from app.services.management_letter_service import create_management_letters

API = "/api/v1"


class LetterAdminMonitoringTests(unittest.TestCase):
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

        self.sender = self._user("sender", "فرستنده", is_admin=True)
        self.recipient = self._user("recipient", "گیرنده")
        self.colleague = self._user("colleague", "همکار")
        self.outsider = self._user("outsider", "بیرونی")
        self.admin = self._user("monitor.admin", "ناظر", is_admin=True)
        self.db.commit()

        letter = create_management_letters(
            self.db,
            actor=self.sender,
            subject="نامه آزمایشی",
            description="متن نامه",
            letter_number="۱",
            needs_reply="ندارد",
            needs_action="دارد",
            due_date="1405/10/10",
            sender="بانک",
            recipient_ids=[self.recipient.id],
            attachments=[self._stored_file("letter.txt", b"letter-body")],
        )[0]
        self.letter_id = letter.id
        # After sending, the sender is a plain employee: only ownership applies.
        self.sender.is_admin = False
        self.db.commit()

        self._actor = self.sender
        app = FastAPI()
        app.include_router(portal_router, prefix=API)

        def override_db():
            yield self.db

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = lambda: self._actor
        app.dependency_overrides[get_optional_user] = lambda: self._actor
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.upload_patch.stop()
        self.tmp.cleanup()

    def _user(self, username, display_name, *, is_admin=False) -> User:
        user = User(
            username=username,
            display_name=display_name,
            is_active=True,
            is_admin=is_admin,
            is_letter_recipient=True,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def _stored_file(self, name: str, content: bytes) -> dict[str, str]:
        path = f"{self.tmp.name}/{name}"
        with open(path, "wb") as handle:
            handle.write(content)
        return {"name": name, "path": path}

    def _as(self, user: User):
        self._actor = user

    def _file(self, name="proof.txt", content=b"proof"):
        return ("attachments", (name, content, "text/plain"))

    def _detail(self):
        response = self.client.get(f"{API}/submissions/{self.letter_id}")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    # ---- the full task toolkit, applied to a letter ----

    def test_recipient_acts_like_on_a_task(self):
        self._as(self.recipient)
        opened = self.client.get(f"{API}/tasks/{self.letter_id}")
        self.assertEqual(opened.status_code, 200)
        self.assertTrue(opened.json()["can_act"])
        self.assertEqual(opened.json()["attachment_names"], ["letter.txt"])

        progress = self.client.patch(
            f"{API}/tasks/{self.letter_id}/status",
            data={"status": "in_progress", "progress_percent": "40", "note": "نیمه"},
            files=[("attachment", ("progress.txt", b"p", "text/plain"))],
        )
        self.assertEqual(progress.status_code, 200, progress.text)
        self.assertEqual(progress.json()["progress_percent"], 40)

        referred = self.client.post(
            f"{API}/tasks/{self.letter_id}/refer",
            data={"to_user_ids": str(self.colleague.id), "note": "لطفاً بررسی کنید"},
            files=[self._file("refer.txt")],
        )
        self.assertEqual(referred.status_code, 200, referred.text)
        # The letter's own delivery is the first referral; the re-refer is the second.
        self.assertEqual(len(referred.json()["referrals"]), 2)
        self.assertEqual(
            referred.json()["referrals"][-1]["to_user_id"], self.colleague.id
        )

        # A referred colleague can see and act on the letter like a task.
        self._as(self.colleague)
        self.assertEqual(
            self.client.get(f"{API}/tasks/{self.letter_id}").status_code, 200
        )
        self.assertTrue(
            any(
                item["id"] == self.letter_id
                for item in self.client.get(f"{API}/tasks").json()
            )
        )

        # Outsiders have no access at all.
        self._as(self.outsider)
        self.assertEqual(
            self.client.get(f"{API}/tasks/{self.letter_id}").status_code, 404
        )
        self.assertEqual(
            self.client.get(f"{API}/submissions/{self.letter_id}").status_code, 404
        )

    def test_sender_closes_rejects_reopens_and_re_refers(self):
        self._as(self.sender)
        refer = self.client.post(
            f"{API}/submissions/{self.letter_id}/refer",
            data={
                "to_user_ids": str(self.colleague.id),
                "note": "ارجاع مجدد",
                "allow_repeat": "true",
            },
            files=[self._file("again.txt")],
        )
        self.assertEqual(refer.status_code, 200, refer.text)

        closed = self.client.patch(
            f"{API}/submissions/{self.letter_id}/status",
            json={"status": "approved", "note": "انجام شد"},
        )
        self.assertEqual(closed.status_code, 200, closed.text)
        self.assertEqual(closed.json()["status"], "approved")

        blocked = self.client.post(
            f"{API}/submissions/{self.letter_id}/refer",
            json={"to_user_ids": [self.recipient.id], "allow_repeat": True},
        )
        self.assertEqual(blocked.status_code, 422)

        reopened = self.client.patch(
            f"{API}/submissions/{self.letter_id}/status", json={"status": "submitted"}
        )
        self.assertEqual(reopened.json()["status"], "submitted")

        rejected = self.client.patch(
            f"{API}/submissions/{self.letter_id}/status",
            json={"status": "rejected", "note": "انجام نشد"},
        )
        self.assertEqual(rejected.json()["status"], "rejected")

    def test_conversation_mentions_and_reminders_work_for_letters(self):
        self._as(self.sender)
        comment = self.client.post(
            f"{API}/submissions/{self.letter_id}/comments",
            json={
                "body": "@recipient لطفاً پیگیری کنید",
                "mention_user_ids": [self.recipient.id],
            },
        )
        self.assertEqual(comment.status_code, 200, comment.text)
        self.assertEqual(
            comment.json()["comments"][0]["mentions"][0]["id"], self.recipient.id
        )

        # Mentioning someone outside the conversation is rejected.
        denied = self.client.post(
            f"{API}/submissions/{self.letter_id}/comments",
            json={"body": "@outsider", "mention_user_ids": [self.outsider.id]},
        )
        self.assertEqual(denied.status_code, 422)

        reminder = self.client.post(
            f"{API}/submissions/{self.letter_id}/reminders",
            json={"message": "یادآوری"},
        )
        self.assertEqual(reminder.status_code, 200, reminder.text)
        self.assertEqual(
            reminder.json()["reminders"][0]["recipient_id"], self.recipient.id
        )

        self._as(self.recipient)
        reply = self.client.post(
            f"{API}/submissions/{self.letter_id}/comments",
            json={"body": "@sender انجام می‌دهم", "mention_user_ids": [self.sender.id]},
        )
        self.assertEqual(reply.status_code, 200, reply.text)
        self.assertEqual(len(reply.json()["comments"]), 2)

    # ---- admin monitoring ----

    def _build_history(self):
        self._as(self.recipient)
        self.client.patch(
            f"{API}/tasks/{self.letter_id}/status",
            data={"status": "in_progress", "progress_percent": "30", "note": "شروع"},
            files=[("attachment", ("progress.txt", b"progress-data", "text/plain"))],
        )
        self.client.post(
            f"{API}/tasks/{self.letter_id}/refer",
            data={"to_user_ids": str(self.colleague.id), "note": "ارجاع"},
            files=[self._file("refer.txt", b"refer-data")],
        )

    def test_admin_sees_flow_attachments_and_progress_of_other_users_letter(self):
        self._build_history()
        self._as(self.admin)

        detail = self._detail()
        self.assertEqual(detail["attachment_names"], ["letter.txt"])
        events = {item["event_type"] for item in detail["timeline"]}
        self.assertTrue({"submitted", "referred", "status_changed"} <= events)
        self.assertEqual(len(detail["referrals"]), 2)
        self.assertEqual(detail["assignee_progress"][0]["progress_percent"], 30)

        referral = next(
            item
            for item in detail["referrals"]
            if item["to_user_id"] == self.colleague.id
        )
        status_event = next(
            item
            for item in detail["timeline"]
            if item["event_type"] == "status_changed" and item.get("attachment_name")
        )
        history_id = status_event["id"].split(":")[1]

        letter_file = self.client.get(
            f"{API}/submissions/{self.letter_id}/attachment", params={"index": 0}
        )
        self.assertEqual(letter_file.status_code, 200)
        self.assertEqual(letter_file.content, b"letter-body")

        referral_file = self.client.get(
            f"{API}/submissions/{self.letter_id}/referrals/{referral['id']}/attachment",
            params={"index": 0},
        )
        self.assertEqual(referral_file.status_code, 200)
        self.assertEqual(referral_file.content, b"refer-data")

        progress_file = self.client.get(
            f"{API}/submissions/{self.letter_id}/status-history/{history_id}/attachment"
        )
        self.assertEqual(progress_file.status_code, 200)
        self.assertEqual(progress_file.content, b"progress-data")

    def test_admin_joins_conversation_refers_again_and_reminds(self):
        self._build_history()
        self._as(self.admin)

        conversation = self.client.get(
            f"{API}/submissions/{self.letter_id}/conversation"
        )
        self.assertEqual(conversation.status_code, 200)
        participant_ids = {item["id"] for item in conversation.json()["participants"]}
        self.assertTrue({self.recipient.id, self.colleague.id} <= participant_ids)

        comment = self.client.post(
            f"{API}/submissions/{self.letter_id}/comments",
            json={"body": "@colleague نظر شما؟", "mention_user_ids": [self.colleague.id]},
        )
        self.assertEqual(comment.status_code, 200, comment.text)

        again = self.client.post(
            f"{API}/submissions/{self.letter_id}/refer",
            json={"to_user_ids": [self.colleague.id], "allow_repeat": True},
        )
        self.assertEqual(again.status_code, 200, again.text)
        self.assertEqual(len(again.json()["referrals"]), 3)

        reminder = self.client.post(
            f"{API}/submissions/{self.letter_id}/reminders", json={"message": "پیگیری"}
        )
        self.assertEqual(reminder.status_code, 200, reminder.text)

    def test_admin_cannot_close_letter_only_the_sender_can(self):
        self._as(self.admin)
        response = self.client.patch(
            f"{API}/submissions/{self.letter_id}/status", json={"status": "approved"}
        )
        self.assertEqual(response.status_code, 403)
        submission = self.db.get(Submission, self.letter_id)
        self.assertEqual(submission.status, "submitted")


if __name__ == "__main__":
    unittest.main()
