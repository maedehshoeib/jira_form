"""Letters must behave like tasks: routing, sender close, and sender re-refer."""

from __future__ import annotations

import json
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.department import Department  # noqa: F401 - registers FK target
from app.models.submission import Submission, SubmissionReferral
from app.models.user import User
from app.services.management_letter_service import (
    create_management_letters,
    list_sent_letters,
    set_letter_batch_status,
)
from app.services.task_workflow_service import (
    list_pending_task_ids,
    list_task_submissions,
    list_unseen_task_ids,
    mark_task_viewed,
    refer_tasks,
    send_task_reminders,
    set_task_status,
    user_can_access_task,
)


class LetterTaskParityTests(unittest.TestCase):
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
        self.recipient = self._user("recipient", "گیرنده", letter=True)
        self.colleague = self._user("colleague", "همکار", letter=True)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _user(self, username, display_name, *, is_admin=False, letter=False) -> User:
        user = User(
            username=username,
            display_name=display_name,
            is_active=True,
            is_admin=is_admin,
            is_letter_recipient=letter,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def _send(self, needs_action: str = "دارد", **kwargs) -> Submission:
        return create_management_letters(
            self.db,
            actor=self.sender,
            subject="موضوع",
            description="متن",
            letter_number="۱",
            needs_reply="ندارد",
            needs_action=needs_action,
            due_date="1405/10/10" if needs_action == "دارد" else "",
            sender="بانک",
            recipient_ids=[self.recipient.id],
            **kwargs,
        )[0]

    def _demote_sender(self):
        """Make the sender a plain user so only ownership grants access."""
        self.sender.is_admin = False
        self.db.commit()

    def test_legacy_actionable_letter_is_in_tasks_even_without_new_fields(self):
        letter = self._send()
        data = json.loads(letter.data)
        for key in ("letter_type", "needs_action", "recipient_delivery_type"):
            data.pop(key, None)
        letter.data = json.dumps(data, ensure_ascii=False)
        self.db.commit()

        task_ids = [
            item.id for item in list_task_submissions(self.db, self.recipient.id)
        ]
        self.assertIn(letter.id, task_ids)
        self.assertIn(letter.id, list_pending_task_ids(self.db, self.recipient.id))

    def test_closed_letter_stays_in_recipient_tasks_as_done(self):
        letter = self._send()
        set_task_status(self.db, self.sender, letter.id, "approved", "تمام شد")

        tasks = {
            item.id: item
            for item in list_task_submissions(self.db, self.recipient.id)
        }
        self.assertEqual(tasks[letter.id].status, "approved")
        self.assertNotIn(letter.id, list_pending_task_ids(self.db, self.recipient.id))

    def test_only_sender_can_close_letter_regardless_of_progress(self):
        letter = self._send()
        with self.assertRaises(PermissionError):
            set_task_status(self.db, self.recipient, letter.id, "approved")

        self._demote_sender()
        closed = set_task_status(self.db, self.sender, letter.id, "approved")
        self.assertEqual(closed.status, "approved")
        self.assertEqual(closed.progress_percent, 100)

        row = list_sent_letters(self.db, None)[0]["recipients"][0]
        self.assertEqual(row["status"], "approved")

        reopened = set_task_status(self.db, self.sender, letter.id, "submitted")
        self.assertEqual(reopened.status, "submitted")

    def test_sender_can_re_refer_sent_letter_to_another_user(self):
        letter = self._send()
        self._demote_sender()
        self.assertFalse(user_can_access_task(self.db, self.sender, letter))

        with self.assertRaises(PermissionError):
            refer_tasks(self.db, self.sender, letter.id, [self.colleague.id])

        referrals = refer_tasks(
            self.db,
            self.sender,
            letter.id,
            [self.colleague.id],
            "لطفاً پیگیری کنید",
            allow_repeat=True,
            allow_submitter=True,
        )
        self.assertEqual(len(referrals), 1)
        self.assertEqual(referrals[0].from_user_id, self.sender.id)
        self.assertTrue(user_can_access_task(self.db, self.colleague, letter))
        self.assertIn(
            letter.id,
            [item.id for item in list_task_submissions(self.db, self.colleague.id)],
        )

        # The original recipient can be referred again too (ارجاع مجدد).
        again = refer_tasks(
            self.db,
            self.sender,
            letter.id,
            [self.recipient.id],
            allow_repeat=True,
            allow_submitter=True,
        )
        self.assertEqual(len(again), 1)
        self.assertEqual(
            self.db.query(SubmissionReferral)
            .filter(SubmissionReferral.submission_id == letter.id)
            .count(),
            3,
        )

        recipient_row = list_sent_letters(self.db, None)[0]["recipients"][0]
        self.assertEqual(recipient_row["status"], "referred")

    def test_closed_letter_cannot_be_re_referred_until_reopened(self):
        letter = self._send()
        set_task_status(self.db, self.sender, letter.id, "approved")
        with self.assertRaises(ValueError):
            refer_tasks(
                self.db,
                self.sender,
                letter.id,
                [self.colleague.id],
                allow_repeat=True,
                allow_submitter=True,
            )

        set_task_status(self.db, self.sender, letter.id, "submitted")
        referrals = refer_tasks(
            self.db,
            self.sender,
            letter.id,
            [self.colleague.id],
            allow_repeat=True,
            allow_submitter=True,
        )
        self.assertEqual(len(referrals), 1)

    def test_sender_closes_every_direct_copy_once_and_leaves_cc_untouched(self):
        cc_user = self._user("cc-user", "رونوشت", letter=True)
        self.db.commit()
        copies = create_management_letters(
            self.db,
            actor=self.sender,
            subject="موضوع",
            description="متن",
            letter_number="۲",
            needs_reply="ندارد",
            needs_action="دارد",
            due_date="1405/10/10",
            sender="بانک",
            recipient_ids=[self.recipient.id, self.colleague.id],
            cc_recipient_ids=[cc_user.id],
        )
        representative = copies[0]

        set_letter_batch_status(
            self.db, self.sender, representative.id, "approved", "تمام"
        )

        by_user = {
            json.loads(item.data)["recipient_id"]: item for item in copies
        }
        for item in copies:
            self.db.refresh(item)
        self.assertEqual(by_user[self.recipient.id].status, "approved")
        self.assertEqual(by_user[self.colleague.id].status, "approved")
        self.assertEqual(by_user[cc_user.id].status, "submitted")

        set_letter_batch_status(self.db, self.sender, representative.id, "submitted")
        for item in copies:
            self.db.refresh(item)
        self.assertEqual(by_user[self.recipient.id].status, "submitted")
        self.assertEqual(by_user[self.colleague.id].status, "submitted")

    def test_reminders_do_not_bump_sidebar_unseen_badges(self):
        letter = self._send()
        mark_task_viewed(self.db, self.recipient, letter)
        self.assertNotIn(
            letter.id, list_unseen_task_ids(self.db, self.recipient.id)
        )

        send_task_reminders(self.db, self.sender, letter, "یادآوری")

        self.assertNotIn(
            letter.id, list_unseen_task_ids(self.db, self.recipient.id)
        )


if __name__ == "__main__":
    unittest.main()
