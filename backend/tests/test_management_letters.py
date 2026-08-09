from __future__ import annotations

from datetime import datetime
import json
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.management_letters import _format_report_dt
from app.db.base import Base
from app.models.department import Department  # noqa: F401 - registers FK target
from app.models.submission import Submission, SubmissionInitialAssignee
from app.models.user import User
from app.services.form_duty_service import backfill_submission_initial_assignees
from app.services.management_letter_service import (
    create_management_letters,
    list_sent_letters,
)


class ManagementLetterServiceTests(unittest.TestCase):
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

        self.actor = self._user("manager", "مدیر", is_admin=True)
        self.first_recipient = self._user(
            "recipient-one",
            "گیرنده اول",
            is_letter_recipient=True,
        )
        self.second_recipient = self._user(
            "recipient-two",
            "گیرنده دوم",
            is_letter_recipient=True,
        )
        self.db.commit()
        for user in (self.actor, self.first_recipient, self.second_recipient):
            self.db.refresh(user)

    def tearDown(self):
        self.db.close()

    def _user(
        self,
        username: str,
        display_name: str,
        *,
        is_admin: bool = False,
        is_letter_recipient: bool = False,
    ) -> User:
        user = User(
            username=username,
            display_name=display_name,
            is_active=True,
            is_admin=is_admin,
            is_letter_recipient=is_letter_recipient,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def _create_letters(
        self,
        *,
        needs_action: str,
        recipient_ids: list[int] | None = None,
        recipient_comments: dict[int, str] | None = None,
        letter_number: str = "نامه-۱",
    ) -> list[Submission]:
        return create_management_letters(
            self.db,
            actor=self.actor,
            subject="موضوع آزمایشی",
            description="توضیحات آزمایشی",
            letter_number=letter_number,
            needs_reply="ندارد",
            needs_action=needs_action,
            due_date="",
            sender="بانک",
            sender_detail="",
            recipient_ids=recipient_ids or [self.first_recipient.id],
            recipient_comments=recipient_comments,
        )

    def _initial_recipient_ids(self, submission_id: int) -> list[int]:
        return [
            row.user_id
            for row in (
                self.db.query(SubmissionInitialAssignee)
                .filter(
                    SubmissionInitialAssignee.submission_id == submission_id
                )
                .order_by(SubmissionInitialAssignee.id.asc())
                .all()
            )
        ]

    def test_every_letter_copy_snapshots_all_batch_recipients(self):
        submissions = self._create_letters(
            needs_action="\u062f\u0627\u0631\u062f",
            recipient_ids=[self.first_recipient.id, self.second_recipient.id],
        )
        expected_ids = [self.first_recipient.id, self.second_recipient.id]

        for submission in submissions:
            self.assertEqual(
                self._initial_recipient_ids(submission.id),
                expected_ids,
            )

    def test_backfill_expands_existing_incomplete_letter_batch_snapshots(self):
        submissions = self._create_letters(
            needs_action="\u062f\u0627\u0631\u062f",
            recipient_ids=[self.first_recipient.id, self.second_recipient.id],
        )
        submission_ids = [submission.id for submission in submissions]
        self.db.query(SubmissionInitialAssignee).filter(
            SubmissionInitialAssignee.submission_id.in_(submission_ids)
        ).delete(synchronize_session=False)
        for submission in submissions:
            recipient_id = int(json.loads(submission.data)["recipient_id"])
            self.db.add(
                SubmissionInitialAssignee(
                    submission_id=submission.id,
                    user_id=recipient_id,
                    assigned_at=submission.created_at,
                )
            )
        self.db.flush()

        self.assertEqual(backfill_submission_initial_assignees(self.db), 2)
        expected_ids = {self.first_recipient.id, self.second_recipient.id}
        for submission in submissions:
            self.assertEqual(
                set(self._initial_recipient_ids(submission.id)),
                expected_ids,
            )
        self.assertEqual(backfill_submission_initial_assignees(self.db), 0)

    def test_report_datetime_is_converted_from_utc_to_iran_time(self):
        self.assertEqual(
            _format_report_dt(datetime(2026, 3, 20, 21, 0)),
            "2026/03/21 00:30",
        )

    def test_generated_number_is_shared_per_batch_unique_across_batches_and_reported(self):
        first_batch = self._create_letters(
            needs_action="دارد",
            recipient_ids=[self.first_recipient.id, self.second_recipient.id],
        )

        self.assertEqual(len(first_batch), 2)
        first_payloads = [json.loads(item.data) for item in first_batch]
        first_numbers = {
            str(payload.get("system_letter_number") or "")
            for payload in first_payloads
        }
        self.assertEqual(len(first_numbers), 1)
        first_number = first_numbers.pop()
        self.assertTrue(first_number)
        self.assertTrue(
            all(payload.get("needs_action") == "دارد" for payload in first_payloads)
        )

        second_batch = self._create_letters(
            needs_action="ندارد(جهت اطلاع)",
            letter_number="نامه-۲",
        )
        second_payload = json.loads(second_batch[0].data)
        second_number = str(second_payload.get("system_letter_number") or "")
        self.assertTrue(second_number)
        self.assertNotEqual(second_number, first_number)
        self.assertEqual(second_payload.get("needs_action"), "ندارد(جهت اطلاع)")

        report_by_number = {
            str(item.get("system_letter_number") or ""): item
            for item in list_sent_letters(self.db, self.actor)
        }
        self.assertIn(first_number, report_by_number)
        self.assertIn(second_number, report_by_number)
        self.assertEqual(report_by_number[first_number]["needs_action"], "دارد")
        self.assertEqual(
            report_by_number[second_number]["needs_action"],
            "ندارد(جهت اطلاع)",
        )
        self.assertEqual(len(report_by_number[first_number]["recipients"]), 2)

    def test_recipient_comments_are_isolated_per_submission_and_reported(self):
        first_comment = "یادداشت مشترک\nخط دوم"
        second_comment = "یادداشت متفاوت برای گیرنده دوم"
        submissions = self._create_letters(
            needs_action="دارد",
            recipient_ids=[self.first_recipient.id, self.second_recipient.id],
            recipient_comments={
                self.first_recipient.id: f"  {first_comment}  ",
                self.second_recipient.id: second_comment,
            },
        )

        payloads_by_recipient = {
            payload["recipient_id"]: payload
            for payload in (json.loads(item.data) for item in submissions)
        }
        first_payload = payloads_by_recipient[self.first_recipient.id]
        second_payload = payloads_by_recipient[self.second_recipient.id]

        self.assertEqual(first_payload["recipient_comment"], first_comment)
        self.assertEqual(second_payload["recipient_comment"], second_comment)
        self.assertNotIn("recipient_comments", first_payload)
        self.assertNotIn("recipient_comments", second_payload)
        self.assertNotIn(second_comment, json.dumps(first_payload, ensure_ascii=False))
        self.assertNotIn(first_comment, json.dumps(second_payload, ensure_ascii=False))

        report = list_sent_letters(self.db, self.actor)
        comments_by_recipient = {
            recipient["user_id"]: recipient["comment"]
            for recipient in report[0]["recipients"]
        }
        self.assertEqual(
            comments_by_recipient,
            {
                self.first_recipient.id: first_comment,
                self.second_recipient.id: second_comment,
            },
        )

    def test_blank_comments_are_omitted(self):
        submissions = self._create_letters(
            needs_action="دارد",
            recipient_ids=[self.first_recipient.id, self.second_recipient.id],
            recipient_comments={
                self.first_recipient.id: "یادداشت نفر اول",
                self.second_recipient.id: "   ",
            },
        )
        payloads = [json.loads(item.data) for item in submissions]
        payload_by_recipient = {
            payload["recipient_id"]: payload for payload in payloads
        }
        self.assertEqual(
            payload_by_recipient[self.first_recipient.id]["recipient_comment"],
            "یادداشت نفر اول",
        )
        self.assertNotIn(
            "recipient_comment",
            payload_by_recipient[self.second_recipient.id],
        )

    def test_invalid_recipient_comment_mappings_are_rejected(self):
        invalid_mappings = (
            {self.second_recipient.id: "گیرنده انتخاب نشده"},
            {self.first_recipient.id: 123},
            {self.first_recipient.id: "x" * 4001},
        )
        for comments in invalid_mappings:
            with self.subTest(comments=comments):
                with self.assertRaises(ValueError):
                    self._create_letters(
                        needs_action="دارد",
                        recipient_comments=comments,  # type: ignore[arg-type]
                    )

        self.assertEqual(self.db.query(Submission).count(), 0)

    def test_needs_action_is_required_and_rejects_values_outside_the_contract(self):
        for invalid_value in ("", "ندارد", "جهت اطلاع", "بله"):
            with self.subTest(needs_action=invalid_value):
                with self.assertRaises(ValueError):
                    self._create_letters(needs_action=invalid_value)

        self.assertEqual(self.db.query(Submission).count(), 0)


if __name__ == "__main__":
    unittest.main()
