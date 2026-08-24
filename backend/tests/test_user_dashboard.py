import json
import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.department import Department  # noqa: F401
from app.models.submission import (
    Submission,
    SubmissionInitialAssignee,
    SubmissionReferral,
)
from app.models.user import User
from app.services.portal_service import MANAGEMENT_LETTER_FORM_ID
from app.services.user_dashboard_builder import build_user_dashboard


class UserDashboardTests(unittest.TestCase):
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
        self.user = User(username="me", display_name="کاربر من", department="فناوری")
        self.alice = User(username="alice", display_name="آلیس", department="منابع انسانی")
        self.bob = User(username="bob", display_name="باب", department="مالی")
        self.db.add_all([self.user, self.alice, self.bob])
        self.db.flush()

        incoming = self._submission(self.alice.id, "درخواست ورودی", "submitted")
        incoming_letter = self._submission(
            self.alice.id,
            "نامه ورودی",
            "in_progress",
            form_id=MANAGEMENT_LETTER_FORM_ID,
            data={"recipient_id": self.user.id, "letter_batch_id": "in-1", "letter_type": "internal"},
        )
        outgoing = self._submission(self.user.id, "درخواست من", "approved")
        sent_first = self._submission(
            self.user.id,
            "نامه ارسالی",
            "approved",
            form_id=MANAGEMENT_LETTER_FORM_ID,
            data={"recipient_id": self.bob.id, "letter_batch_id": "out-1", "letter_type": "external"},
        )
        self._submission(
            self.user.id,
            "نامه ارسالی",
            "submitted",
            form_id=MANAGEMENT_LETTER_FORM_ID,
            data={"recipient_id": self.alice.id, "letter_batch_id": "out-1", "letter_type": "external"},
        )
        self.db.flush()
        self.db.add_all([
            SubmissionReferral(submission_id=incoming.id, from_user_id=self.alice.id, to_user_id=self.user.id),
            SubmissionReferral(submission_id=incoming_letter.id, from_user_id=self.alice.id, to_user_id=self.user.id),
            SubmissionInitialAssignee(submission_id=outgoing.id, user_id=self.bob.id),
            SubmissionInitialAssignee(submission_id=sent_first.id, user_id=self.bob.id),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _submission(self, user_id, subject, status, *, form_id="common-form", data=None):
        item = Submission(
            user_id=user_id,
            subject=subject,
            status=status,
            form_id=form_id,
            department_id="finance",
            section_id="purchase-request",
            data=json.dumps(data or {}, ensure_ascii=False),
            created_at=datetime(2026, 8, 1, 10, 0),
        )
        self.db.add(item)
        self.db.flush()
        return item

    def test_dashboard_is_scoped_and_deduplicates_sent_letter_batches(self):
        result = build_user_dashboard(self.db, self.user)

        self.assertEqual(result.summary.total_tasks, 2)
        self.assertEqual(result.summary.open_tasks, 2)
        self.assertEqual(result.summary.total_requests, 3)
        self.assertEqual(result.summary.sent_letters, 1)
        self.assertEqual(result.summary.received_letters, 1)
        self.assertEqual(result.top_requesters[0].label, "آلیس")
        self.assertEqual(result.top_requesters[0].value, 2)
        self.assertEqual(result.letters.sent_by_type[0].label, "برون‌سازمانی")
        self.assertEqual(result.letters.received_by_type[0].label, "درون‌سازمانی")


if __name__ == "__main__":
    unittest.main()
