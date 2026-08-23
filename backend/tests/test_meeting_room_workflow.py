import json
import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.department import Department  # noqa: F401
from app.models.form_template import FormDutyAssignment  # noqa: F401
from app.models.submission import Submission, SubmissionReferral
from app.models.user import User
from app.services.meeting_room_workflow_service import (
    initialize_meeting_room_workflow,
    prepare_meeting_room_data,
)
from app.services.portal_service import (
    MEETING_ROOM_DEPARTMENT_ID,
    MEETING_ROOM_FORM_ID,
    MEETING_ROOM_SECTION_ID,
)
from app.services.task_workflow_service import (
    list_pending_task_ids,
    set_task_status,
    user_can_access_task,
)


class MeetingRoomWorkflowTests(unittest.TestCase):
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
        self.requester = self._user("requester", "درخواست کننده")
        self.panahi = self._user("s.panahi", "پناهی")
        self.bashiri = self._user("m.bashiri", "بشیری")
        self.abbasi = self._user("sa.abbasi", "عباسی")
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _user(self, username: str, display_name: str) -> User:
        user = User(
            username=username,
            display_name=display_name,
            is_active=True,
            is_admin=False,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def _form_data(self, needs_catering: str) -> dict:
        data = {
            "requester": "کاربر آزمایشی",
            "subject": "جلسه برنامه ریزی",
            "participant_scope": "داخلی",
            "participant_details": "علی رضایی - مدیر پروژه",
            "meeting_date": "1405/06/01",
            "start_time": "09:00",
            "end_time": "10:30",
            "needs_catering": needs_catering,
        }
        if needs_catering == "دارد":
            data["catering_type"] = "چای و شیرینی"
        return data

    def _submission(self, needs_catering: str) -> Submission:
        data, approvers = prepare_meeting_room_data(
            self.db, self._form_data(needs_catering)
        )
        submission = Submission(
            form_id=MEETING_ROOM_FORM_ID,
            department_id=MEETING_ROOM_DEPARTMENT_ID,
            section_id=MEETING_ROOM_SECTION_ID,
            user_id=self.requester.id,
            subject=data["subject"],
            data=json.dumps(data, ensure_ascii=False),
            status="submitted",
            created_at=datetime.utcnow(),
        )
        self.db.add(submission)
        self.db.flush()
        initialize_meeting_room_workflow(
            self.db, submission, self.requester, approvers
        )
        self.db.commit()
        self.db.refresh(submission)
        return submission

    def test_without_catering_finishes_after_panahi(self):
        submission = self._submission("ندارد")

        self.assertTrue(user_can_access_task(self.db, self.panahi, submission))
        self.assertFalse(user_can_access_task(self.db, self.bashiri, submission))
        set_task_status(self.db, self.panahi, submission.id, "approved")

        self.assertEqual(submission.status, "approved")
        self.assertEqual(submission.progress_percent, 100)

    def test_with_catering_advances_in_order(self):
        submission = self._submission("دارد")

        set_task_status(self.db, self.panahi, submission.id, "approved")
        self.assertEqual(submission.status, "in_progress")
        self.assertTrue(user_can_access_task(self.db, self.bashiri, submission))
        self.assertNotIn(submission.id, list_pending_task_ids(self.db, self.panahi.id))
        self.assertIn(submission.id, list_pending_task_ids(self.db, self.bashiri.id))

        set_task_status(self.db, self.bashiri, submission.id, "approved")
        self.assertTrue(user_can_access_task(self.db, self.abbasi, submission))

        set_task_status(self.db, self.abbasi, submission.id, "approved")
        self.assertEqual(submission.status, "approved")
        self.assertEqual(submission.progress_percent, 100)
        referrals = (
            self.db.query(SubmissionReferral)
            .filter(SubmissionReferral.submission_id == submission.id)
            .order_by(SubmissionReferral.id)
            .all()
        )
        self.assertEqual(
            [row.to_user_id for row in referrals],
            [self.panahi.id, self.bashiri.id, self.abbasi.id],
        )

    def test_rejection_stops_the_chain(self):
        submission = self._submission("دارد")
        set_task_status(self.db, self.panahi, submission.id, "rejected", "رد شد")

        self.assertEqual(submission.status, "rejected")
        self.assertFalse(user_can_access_task(self.db, self.bashiri, submission))
        self.assertEqual(
            self.db.query(SubmissionReferral)
            .filter(SubmissionReferral.submission_id == submission.id)
            .count(),
            1,
        )

    def test_rejects_invalid_time_range(self):
        data = self._form_data("ندارد")
        data["end_time"] = "08:30"
        with self.assertRaisesRegex(ValueError, "ساعت پایان"):
            prepare_meeting_room_data(self.db, data)


if __name__ == "__main__":
    unittest.main()
