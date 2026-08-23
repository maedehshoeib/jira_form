"""End-to-end mock-data checks for form duties, tasks, approve/reject, ارجاع."""

from __future__ import annotations

import json
import unittest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_current_user, get_optional_user
from app.core.security import hash_password
from app.db.base import Base
from app.db import init_db as init_db_module
from app.db.session import get_db
from app.models.department import Department  # noqa: F401
from app.models.form_template import FormDutyAssignment  # noqa: F401
from app.models.submission import (
    Submission,
    SubmissionCcRecipient,
    SubmissionComment,
    SubmissionCommentMention,
    SubmissionInitialAssignee,
    SubmissionReferral,
    SubmissionReminder,
    SubmissionStatusHistory,
    SubmissionView,
)
from app.models.user import User
from app.api.routes.portal import router as portal_router
from app.api.routes.admin import router as admin_router
from app.services.form_duty_service import (
    backfill_submission_initial_assignees,
    replace_assignments,
    snapshot_submission_initial_assignees,
)
from app.services.management_letter_service import create_management_letters
from app.services.task_workflow_service import (
    list_task_submissions,
    refer_task,
    set_task_status,
    user_can_access_task,
)


class TaskWorkflowMockTests(unittest.TestCase):
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

        self.submitter = self._user("submitter", "ثبت‌کننده تست")
        self.handler = self._user("ma.shoeib", "شعیب")
        self.colleague = self._user("colleague", "همکار تست")
        self.outsider = self._user("outsider", "کاربر بی‌ربط")
        self.admin = self._user("vosouq.admin", "ادمین", is_admin=True)
        self.db.commit()

        for user in (
            self.submitter,
            self.handler,
            self.colleague,
            self.outsider,
            self.admin,
        ):
            self.db.refresh(user)

        # Handler owns مالی / درخواست تنخواه
        replace_assignments(
            self.db,
            [(self.handler.id, "finance:petty-cash:common-form")],
        )

        self.submission = Submission(
            form_id="common-form",
            department_id="finance",
            section_id="petty-cash",
            user_id=self.submitter.id,
            subject="درخواست تنخواه آزمایشی",
            data=json.dumps(
                {"subject": "درخواست تنخواه آزمایشی", "amount": "500000"},
                ensure_ascii=False,
            ),
            status="submitted",
            created_at=datetime.utcnow(),
        )
        self.other_submission = Submission(
            form_id="common-form",
            department_id="hr",
            section_id="leave-request",
            user_id=self.submitter.id,
            subject="مرخصی آزمایشی",
            data=json.dumps({"subject": "مرخصی آزمایشی"}, ensure_ascii=False),
            status="submitted",
            created_at=datetime.utcnow(),
        )
        self.db.add_all([self.submission, self.other_submission])
        self.db.commit()
        self.db.refresh(self.submission)
        self.db.refresh(self.other_submission)
        snapshot_submission_initial_assignees(self.db, self.submission)
        self.db.commit()

        self._actor = self.handler
        app = FastAPI()
        app.include_router(portal_router, prefix="/api/v1")
        app.include_router(admin_router, prefix="/api/v1/admin")

        def override_db():
            try:
                yield self.db
            finally:
                pass

        def override_user():
            return self._actor

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_optional_user] = override_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()

    def _user(self, username: str, display_name: str, *, is_admin: bool = False):
        user = User(
            username=username,
            password_hash=hash_password("Secure@1234567"),
            must_change_password=False,
            display_name=display_name,
            is_active=True,
            is_admin=is_admin,
            department="مالی" if not is_admin else "",
            job_title="کارشناس",
        )
        self.db.add(user)
        self.db.flush()
        return user

    def _as(self, user: User):
        self._actor = user

    # ---- service layer ----

    def test_handler_sees_duty_submission_only(self):
        tasks = list_task_submissions(self.db, self.handler.id)
        ids = {item.id for item in tasks}
        self.assertIn(self.submission.id, ids)
        self.assertNotIn(self.other_submission.id, ids)

    def test_outsider_sees_nothing(self):
        tasks = list_task_submissions(self.db, self.outsider.id)
        self.assertEqual(tasks, [])

    def test_requester_can_ring_assignees_and_receiver_sees_reminder(self):
        self._as(self.handler)
        opened = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(opened.status_code, 200)

        self._as(self.submitter)
        response = self.client.post(
            f"/api/v1/submissions/{self.submission.id}/reminders",
            json={"message": "Please follow up"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["reminders"]), 1)
        self.assertEqual(response.json()["reminders"][0]["recipient_id"], self.handler.id)
        self.assertEqual(self.db.query(SubmissionReminder).count(), 1)

        self._as(self.handler)
        unseen = self.client.get("/api/v1/tasks/unseen-count")
        self.assertIn(self.submission.id, unseen.json()["ids"])

    def test_participants_can_comment_and_mention_each_other(self):
        self._as(self.handler)
        response = self.client.post(
            f"/api/v1/submissions/{self.submission.id}/comments",
            json={
                "body": "@submitter please check",
                "mention_user_ids": [self.submitter.id],
            },
        )
        self.assertEqual(response.status_code, 200)
        comment = response.json()["comments"][0]
        self.assertEqual(comment["author_id"], self.handler.id)
        self.assertEqual(comment["mentions"][0]["id"], self.submitter.id)
        self.assertEqual(self.db.query(SubmissionComment).count(), 1)
        self.assertEqual(self.db.query(SubmissionCommentMention).count(), 1)

        self._as(self.outsider)
        denied = self.client.post(
            f"/api/v1/submissions/{self.submission.id}/comments",
            json={"body": "not allowed", "mention_user_ids": []},
        )
        self.assertEqual(denied.status_code, 403)

    def test_cc_recipient_can_join_task_conversation(self):
        refer_task(
            self.db,
            self.handler,
            self.submission.id,
            self.colleague.id,
            cc_user_ids=[self.outsider.id],
        )
        self._as(self.outsider)
        response = self.client.post(
            f"/api/v1/submissions/{self.submission.id}/comments",
            json={"body": "CC response", "mention_user_ids": [self.colleague.id]},
        )
        self.assertEqual(response.status_code, 200)

    def test_referral_only_inbox_without_duty(self):
        # Clear duties so handler no longer owns the form; colleague gets it only via ارجاع
        replace_assignments(self.db, [])
        self.db.add(
            FormDutyAssignment(
                user_id=self.handler.id,
                portal_department_id="finance",
                section_id="petty-cash",
                form_id="common-form",
            )
        )
        self.db.commit()
        refer_task(
            self.db, self.handler, self.submission.id, self.colleague.id, "فقط ارجاع"
        )
        replace_assignments(self.db, [])
        self.assertEqual(list_task_submissions(self.db, self.handler.id), [])
        colleague_tasks = list_task_submissions(self.db, self.colleague.id)
        self.assertEqual([item.id for item in colleague_tasks], [self.submission.id])

    def test_refer_adds_recipient_and_keeps_handler(self):
        refer_task(
            self.db,
            self.handler,
            self.submission.id,
            self.colleague.id,
            "لطفاً بررسی کنید",
        )
        handler_ids = {s.id for s in list_task_submissions(self.db, self.handler.id)}
        colleague_ids = {
            s.id for s in list_task_submissions(self.db, self.colleague.id)
        }
        self.assertIn(self.submission.id, handler_ids)
        self.assertIn(self.submission.id, colleague_ids)
        self.assertTrue(
            user_can_access_task(self.db, self.colleague, self.submission)
        )

    def test_duplicate_refer_rejected(self):
        refer_task(
            self.db, self.handler, self.submission.id, self.colleague.id, ""
        )
        with self.assertRaises(ValueError):
            refer_task(
                self.db, self.handler, self.submission.id, self.colleague.id, ""
            )
        self.assertEqual(
            self.db.query(SubmissionReferral)
            .filter(
                SubmissionReferral.submission_id == self.submission.id,
                SubmissionReferral.to_user_id == self.colleague.id,
            )
            .count(),
            1,
        )

    def test_allow_repeat_refer_appends_same_recipient_history(self):
        first = refer_task(
            self.db,
            self.handler,
            self.submission.id,
            self.colleague.id,
            "first referral",
        )
        repeated = refer_task(
            self.db,
            self.handler,
            self.submission.id,
            self.colleague.id,
            "repeat referral",
            allow_repeat=True,
        )

        referrals = (
            self.db.query(SubmissionReferral)
            .filter(
                SubmissionReferral.submission_id == self.submission.id,
                SubmissionReferral.to_user_id == self.colleague.id,
            )
            .order_by(SubmissionReferral.created_at, SubmissionReferral.id)
            .all()
        )
        self.assertEqual([row.id for row in referrals], [first.id, repeated.id])
        self.assertEqual(
            [row.note for row in referrals],
            ["first referral", "repeat referral"],
        )
        self.assertNotEqual(first.id, repeated.id)

    def test_self_refer_rejected(self):
        with self.assertRaises(ValueError):
            refer_task(
                self.db, self.handler, self.submission.id, self.handler.id, ""
            )

    def test_approve_and_status_edit(self):
        updated = set_task_status(
            self.db, self.handler, self.submission.id, "approved", "انجام شد با موفقیت"
        )
        self.assertEqual(updated.status, "approved")
        self.assertEqual(updated.status_updated_by_id, self.handler.id)
        self.assertEqual(updated.status_note, "انجام شد با موفقیت")
        self.assertIsNotNone(updated.status_updated_at)

        # Status can be corrected after a mistaken approve/reject.
        corrected = set_task_status(
            self.db, self.handler, self.submission.id, "rejected", "اشتباه بود"
        )
        self.assertEqual(corrected.status, "rejected")
        self.assertEqual(corrected.status_note, "اشتباه بود")

        # Referral stays blocked while approved/rejected.
        with self.assertRaises(ValueError):
            refer_task(
                self.db, self.handler, self.submission.id, self.colleague.id, ""
            )

        restored = set_task_status(
            self.db, self.handler, self.submission.id, "submitted"
        )
        self.assertEqual(restored.status, "submitted")
        self.assertEqual(restored.status_note, "")
        refer_task(
            self.db, self.handler, self.submission.id, self.colleague.id, "بعد از اصلاح"
        )

    def test_reject_by_referral_recipient(self):
        refer_task(
            self.db, self.handler, self.submission.id, self.colleague.id, "ارجاع"
        )
        updated = set_task_status(
            self.db, self.colleague, self.submission.id, "rejected"
        )
        self.assertEqual(updated.status, "rejected")
        self.assertEqual(updated.status_updated_by_id, self.colleague.id)

    def test_outsider_cannot_act(self):
        with self.assertRaises(PermissionError):
            set_task_status(
                self.db, self.outsider, self.submission.id, "approved"
            )
        with self.assertRaises(PermissionError):
            refer_task(
                self.db, self.outsider, self.submission.id, self.colleague.id, ""
            )

    # ---- HTTP API ----

    def test_http_list_and_detail(self):
        self._as(self.handler)
        response = self.client.get("/api/v1/tasks")
        self.assertEqual(response.status_code, 200, response.text)
        rows = response.json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], self.submission.id)
        self.assertTrue(rows[0]["can_act"])
        self.assertEqual(rows[0]["status"], "submitted")

        pending = self.client.get("/api/v1/tasks/pending-count")
        self.assertEqual(pending.status_code, 200, pending.text)
        pending_body = pending.json()
        self.assertEqual(pending_body["count"], 1)
        self.assertEqual(pending_body["ids"], [self.submission.id])

        detail = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(detail.status_code, 200, detail.text)
        body = detail.json()
        self.assertEqual(body["subject"], "درخواست تنخواه آزمایشی")
        self.assertEqual(body["data"]["amount"], "500000")
        self.assertTrue(body["can_act"])

    def test_sender_sees_stable_initial_assignee_in_list_and_detail(self):
        self._as(self.submitter)
        sender_rows = self.client.get("/api/v1/submissions").json()
        sender_row = next(
            row for row in sender_rows if row["id"] == self.submission.id
        )
        self.assertEqual(len(sender_row["initial_assignees"]), 1)
        self.assertEqual(
            sender_row["initial_assignees"][0]["user_id"],
            self.handler.id,
        )
        self.assertEqual(
            sender_row["initial_assignees"][0]["username"],
            self.handler.username,
        )
        self.assertEqual(
            sender_row["initial_assignees"][0]["display_name"],
            self.handler.display_name,
        )
        self.assertTrue(sender_row["initial_assignees"][0]["assigned_at"])
        self.assertNotIn("assignees", sender_row)

        detail = self.client.get(
            f"/api/v1/submissions/{self.submission.id}"
        ).json()
        self.assertEqual(
            detail["initial_assignees"],
            sender_row["initial_assignees"],
        )

        replace_assignments(
            self.db,
            [(self.colleague.id, "finance:petty-cash:common-form")],
        )
        after_change = self.client.get(
            f"/api/v1/submissions/{self.submission.id}"
        ).json()
        self.assertEqual(
            [item["user_id"] for item in after_change["initial_assignees"]],
            [self.handler.id],
        )
        self.assertEqual(
            self.db.query(SubmissionInitialAssignee)
            .filter(
                SubmissionInitialAssignee.submission_id == self.submission.id
            )
            .count(),
            1,
        )

    def test_legacy_initial_assignee_backfill_uses_route_and_explicit_recipient(self):
        from app.services.portal_service import (
            MANAGEMENT_LETTER_FORM_ID,
            MANAGEMENT_LETTER_SECTION,
            MANAGEMENT_WORKFLOW_ID,
        )

        legacy_general = Submission(
            form_id="common-form",
            department_id="finance",
            section_id="petty-cash",
            user_id=self.submitter.id,
            subject="legacy general",
            data="{}",
        )
        legacy_letter = Submission(
            form_id=MANAGEMENT_LETTER_FORM_ID,
            department_id=MANAGEMENT_WORKFLOW_ID,
            section_id=MANAGEMENT_LETTER_SECTION,
            user_id=self.submitter.id,
            subject="legacy letter",
            data=json.dumps({"recipient_id": self.colleague.id}),
        )
        self.db.add_all([legacy_general, legacy_letter])
        self.db.commit()

        self.assertEqual(backfill_submission_initial_assignees(self.db), 2)
        self.db.commit()
        by_submission = {
            row.submission_id: row.user_id
            for row in self.db.query(SubmissionInitialAssignee)
            .filter(
                SubmissionInitialAssignee.submission_id.in_(
                    [legacy_general.id, legacy_letter.id]
                )
            )
            .all()
        }
        self.assertEqual(by_submission[legacy_general.id], self.handler.id)
        self.assertEqual(by_submission[legacy_letter.id], self.colleague.id)
        self.assertEqual(backfill_submission_initial_assignees(self.db), 0)

    def test_http_outsider_404(self):
        self._as(self.outsider)
        self.assertEqual(self.client.get("/api/v1/tasks").json(), [])
        response = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(response.status_code, 404)

    def test_http_refer_and_approve_flow(self):
        self._as(self.handler)
        colleagues = self.client.get("/api/v1/tasks/colleagues")
        self.assertEqual(colleagues.status_code, 200, colleagues.text)
        ids = {item["id"] for item in colleagues.json()}
        self.assertIn(self.colleague.id, ids)
        self.assertNotIn(self.handler.id, ids)
        self.assertNotIn(self.admin.id, ids)

        referred = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_id": self.colleague.id, "note": "بررسی فوری"},
        )
        self.assertEqual(referred.status_code, 200, referred.text)
        payload = referred.json()
        self.assertEqual(len(payload["referrals"]), 1)
        self.assertEqual(payload["referrals"][0]["to_user_id"], self.colleague.id)
        self.assertEqual(payload["referrals"][0]["note"], "بررسی فوری")
        self.assertTrue(payload["can_act"])

        self._as(self.colleague)
        tasks = self.client.get("/api/v1/tasks").json()
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["id"], self.submission.id)

        approved = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "approved"},
        )
        self.assertEqual(approved.status_code, 200, approved.text)
        body = approved.json()
        self.assertEqual(body["status"], "approved")
        self.assertTrue(body["can_act"])
        self.assertEqual(body["status_updated_by"], "همکار تست")

        pending_after = self.client.get("/api/v1/tasks/pending-count").json()
        self.assertEqual(pending_after["count"], 0)
        self.assertEqual(pending_after["ids"], [])

        # Handler can still edit status after approve.
        self._as(self.handler)
        again = self.client.get(f"/api/v1/tasks/{self.submission.id}").json()
        self.assertEqual(again["status"], "approved")
        self.assertTrue(again["can_act"])

        restored = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "submitted"},
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertEqual(restored.json()["status"], "submitted")
        self.assertTrue(restored.json()["can_act"])

        # Re-approve so referral remains blocked for the next check.
        self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "approved"},
        )
        blocked = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_id": self.outsider.id, "note": "late"},
        )
        self.assertEqual(blocked.status_code, 422)

    def test_http_reject_flow(self):
        self._as(self.handler)
        rejected = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "rejected", "note": "ناقص است"},
        )
        self.assertEqual(rejected.status_code, 200, rejected.text)
        body = rejected.json()
        self.assertEqual(body["status"], "rejected")
        self.assertEqual(body["status_note"], "ناقص است")
        self.assertTrue(body["can_act"])

    def test_http_multi_refer(self):
        second = self._user("colleague2", "همکار دوم")
        self._as(self.handler)
        referred = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={
                "to_user_ids": [self.colleague.id, second.id],
                "note": "بررسی مشترک",
            },
        )
        self.assertEqual(referred.status_code, 200, referred.text)
        payload = referred.json()
        self.assertEqual(len(payload["referrals"]), 2)
        targets = {item["to_user_id"] for item in payload["referrals"]}
        self.assertEqual(targets, {self.colleague.id, second.id})
        self.assertTrue(all(item["note"] == "بررسی مشترک" for item in payload["referrals"]))

        self._as(second)
        tasks = self.client.get("/api/v1/tasks").json()
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["id"], self.submission.id)
        self.assertEqual(
            {item["to_user_id"] for item in tasks[0]["referrals"]},
            {self.colleague.id, second.id},
        )

        detail = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(
            {item["to_user_id"] for item in detail.json()["referrals"]},
            {self.colleague.id, second.id},
        )

    def test_http_referral_cc_recipient_has_read_only_visibility(self):
        self._as(self.handler)
        save_attachment = AsyncMock(return_value=("C:/fake/brief.pdf", "brief.pdf"))
        with patch(
            "app.api.routes.portal._save_task_action_attachment",
            new=save_attachment,
        ):
            referred = self.client.post(
                f"/api/v1/tasks/{self.submission.id}/refer",
                data={
                    "to_user_ids": str(self.colleague.id),
                    "cc_user_ids": str(self.outsider.id),
                    "note": "Please review with @outsider in CC",
                },
                files={
                    "attachment": ("brief.pdf", b"test-pdf", "application/pdf")
                },
            )
        self.assertEqual(referred.status_code, 200, referred.text)
        save_attachment.assert_awaited_once()
        self.assertEqual(referred.json()["referrals"][0]["attachment_name"], "brief.pdf")
        self.assertEqual(
            [item["user_id"] for item in referred.json()["cc_recipients"]],
            [self.outsider.id],
        )
        self.assertEqual(
            self.db.query(SubmissionCcRecipient)
            .filter(SubmissionCcRecipient.submission_id == self.submission.id)
            .count(),
            1,
        )

        self._as(self.outsider)
        tasks = self.client.get("/api/v1/tasks")
        self.assertEqual(tasks.status_code, 200, tasks.text)
        self.assertEqual([item["id"] for item in tasks.json()], [self.submission.id])
        self.assertFalse(tasks.json()[0]["can_act"])

        detail = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertFalse(detail.json()["can_act"])

        pending = self.client.get("/api/v1/tasks/pending-count")
        self.assertEqual(pending.json(), {"count": 0, "ids": []})

        forbidden_status = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "approved"},
        )
        self.assertEqual(forbidden_status.status_code, 403, forbidden_status.text)

        forbidden_refer = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_ids": [self.colleague.id]},
        )
        self.assertEqual(forbidden_refer.status_code, 403, forbidden_refer.text)

    def test_http_repeat_refer_accepts_mixed_old_and_new_recipients(self):
        second = self._user("colleague2", "همکار دوم")
        self._as(self.handler)
        first = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_id": self.colleague.id, "note": "first referral"},
        )
        self.assertEqual(first.status_code, 200, first.text)

        rejected_without_opt_in = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={
                "to_user_ids": [self.colleague.id, second.id],
                "note": "should not be saved",
            },
        )
        self.assertEqual(
            rejected_without_opt_in.status_code,
            422,
            rejected_without_opt_in.text,
        )
        self.assertEqual(
            self.db.query(SubmissionReferral)
            .filter(SubmissionReferral.submission_id == self.submission.id)
            .count(),
            1,
        )

        repeated = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={
                "to_user_ids": [self.colleague.id, second.id],
                "note": "repeat round",
                "allow_repeat": True,
            },
        )
        self.assertEqual(repeated.status_code, 200, repeated.text)
        body = repeated.json()
        expected_history = [
            (self.colleague.id, "first referral"),
            (self.colleague.id, "repeat round"),
            (second.id, "repeat round"),
        ]
        self.assertEqual(
            [
                (item["to_user_id"], item["note"])
                for item in body["referrals"]
            ],
            expected_history,
        )

        referral_events = [
            event
            for event in body["timeline"]
            if event["event_type"] == "referred"
        ]
        self.assertEqual(
            [
                (event["to_user_id"], event["note"])
                for event in referral_events
            ],
            expected_history,
        )
        self.assertEqual(
            [event["id"] for event in referral_events],
            [f"referral:{item['id']}" for item in body["referrals"]],
        )
        self.assertEqual(
            [event["event_type"] for event in body["timeline"]],
            ["submitted", "referred", "referred", "referred"],
        )

    def test_letter_recipient_sees_all_names_without_sibling_access(self):
        self.handler.is_letter_recipient = True
        self.colleague.is_letter_recipient = True
        self.db.commit()
        letters = create_management_letters(
            self.db,
            actor=self.admin,
            subject="letter subject",
            description="letter description",
            letter_number="L-1",
            needs_reply="\u0646\u062f\u0627\u0631\u062f",
            needs_action="\u062f\u0627\u0631\u062f",
            due_date="1405/10/10",
            sender="\u0628\u0627\u0646\u06a9",
            sender_detail="",
            recipient_ids=[self.handler.id, self.colleague.id],
            recipient_comments={
                self.handler.id: "private-handler-note",
                self.colleague.id: "private-colleague-note",
            },
        )
        expected_recipient_ids = {self.handler.id, self.colleague.id}
        cases = (
            (
                self.handler,
                letters[0],
                letters[1],
                "private-colleague-note",
            ),
            (
                self.colleague,
                letters[1],
                letters[0],
                "private-handler-note",
            ),
        )

        for actor, own_letter, sibling_letter, sibling_note in cases:
            with self.subTest(actor=actor.username):
                self._as(actor)
                rows = self.client.get("/api/v1/tasks").json()
                own_row = next(row for row in rows if row["id"] == own_letter.id)
                self.assertNotIn(sibling_letter.id, {row["id"] for row in rows})
                self.assertEqual(
                    {
                        item["user_id"]
                        for item in own_row["initial_assignees"]
                    },
                    expected_recipient_ids,
                )

                detail = self.client.get(f"/api/v1/tasks/{own_letter.id}")
                self.assertEqual(detail.status_code, 200, detail.text)
                detail_body = detail.json()
                self.assertEqual(
                    {
                        item["user_id"]
                        for item in detail_body["initial_assignees"]
                    },
                    expected_recipient_ids,
                )
                self.assertNotIn(sibling_note, json.dumps(detail_body["data"]))

    def test_http_invalid_status(self):
        self._as(self.handler)
        response = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "unknown-status"},
        )
        self.assertEqual(response.status_code, 422)

    def test_task_view_tracking_is_per_user_and_visible_to_sender(self):
        self._as(self.handler)
        initial = self.client.get("/api/v1/tasks").json()[0]
        self.assertEqual(initial["workflow_status"], "unseen")
        self.assertFalse(initial["is_read"])
        self.assertIsNone(initial["first_viewed_at"])

        unseen = self.client.get("/api/v1/tasks/unseen-count").json()
        self.assertEqual(unseen, {"count": 1, "ids": [self.submission.id]})

        opened = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(opened.status_code, 200, opened.text)
        opened_body = opened.json()
        self.assertTrue(opened_body["is_read"])
        self.assertEqual(opened_body["workflow_status"], "seen")
        self.assertIsNotNone(opened_body["first_viewed_at"])
        self.assertIsNotNone(opened_body["last_viewed_at"])
        self.assertEqual(
            [event["event_type"] for event in opened_body["timeline"]],
            ["submitted", "viewed"],
        )
        self.assertTrue(
            all(event["id"] for event in opened_body["timeline"])
        )

        first_viewed_at = opened_body["first_viewed_at"]
        self.client.get(f"/api/v1/tasks/{self.submission.id}")
        views = (
            self.db.query(SubmissionView)
            .filter(SubmissionView.submission_id == self.submission.id)
            .all()
        )
        self.assertEqual(len(views), 1)
        reopened = self.client.get("/api/v1/tasks").json()[0]
        self.assertEqual(reopened["first_viewed_at"], first_viewed_at)
        self.assertTrue(reopened["is_read"])
        self.assertEqual(
            self.client.get("/api/v1/tasks/unseen-count").json(),
            {"count": 0, "ids": []},
        )

        self.db.add(
            FormDutyAssignment(
                user_id=self.colleague.id,
                portal_department_id="finance",
                section_id="petty-cash",
                form_id="common-form",
            )
        )
        self.db.commit()
        self._as(self.colleague)
        colleague_row = self.client.get("/api/v1/tasks").json()[0]
        self.assertFalse(colleague_row["is_read"])
        self.assertEqual(colleague_row["workflow_status"], "seen")
        self.assertEqual(colleague_row["first_viewed_at"], first_viewed_at)
        self.assertEqual(
            self.client.get("/api/v1/tasks/unseen-count").json(),
            {"count": 1, "ids": [self.submission.id]},
        )

        self._as(self.submitter)
        sender_rows = self.client.get("/api/v1/submissions").json()
        sender_row = next(
            row for row in sender_rows if row["id"] == self.submission.id
        )
        self.assertEqual(sender_row["status"], "submitted")
        self.assertEqual(sender_row["workflow_status"], "seen")
        self.assertEqual(sender_row["first_viewed_at"], first_viewed_at)
        self.assertIsNone(sender_row["status_updated_at"])

    def test_referral_takes_precedence_over_seen(self):
        self._as(self.handler)
        self.client.get(f"/api/v1/tasks/{self.submission.id}")
        referred = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_id": self.colleague.id, "note": "forward"},
        )
        self.assertEqual(referred.status_code, 200, referred.text)
        body = referred.json()
        self.assertEqual(body["status"], "submitted")
        self.assertEqual(body["workflow_status"], "referred")
        self.assertEqual(
            [event["event_type"] for event in body["timeline"]],
            ["submitted", "viewed", "referred"],
        )

        self._as(self.submitter)
        sender_row = next(
            row
            for row in self.client.get("/api/v1/submissions").json()
            if row["id"] == self.submission.id
        )
        self.assertEqual(
            sender_row["referrals"][0]["to_user_name"],
            self.colleague.display_name,
        )
        sender_detail = self.client.get(
            f"/api/v1/submissions/{self.submission.id}"
        ).json()
        self.assertEqual(sender_detail["workflow_status"], "referred")
        self.assertEqual(
            sender_detail["referrals"][0]["to_user_name"],
            self.colleague.display_name,
        )
        referral_event = next(
            item
            for item in sender_detail["timeline"]
            if item["event_type"] == "referred"
        )
        self.assertEqual(referral_event["to_user_id"], self.colleague.id)
        self.assertEqual(referral_event["note"], "forward")

    def test_repeat_referral_marks_recipient_unread_until_reopened(self):
        self._as(self.handler)
        referred = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_id": self.colleague.id, "note": "first referral"},
        )
        self.assertEqual(referred.status_code, 200, referred.text)

        self._as(self.colleague)
        opened = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(opened.status_code, 200, opened.text)
        self.assertTrue(opened.json()["is_read"])
        self.assertEqual(
            self.client.get("/api/v1/tasks/unseen-count").json(),
            {"count": 0, "ids": []},
        )

        self._as(self.handler)
        repeated = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={
                "to_user_id": self.colleague.id,
                "note": "please review again",
                "allow_repeat": True,
            },
        )
        self.assertEqual(repeated.status_code, 200, repeated.text)

        self._as(self.colleague)
        row = self.client.get("/api/v1/tasks").json()[0]
        self.assertFalse(row["is_read"])
        self.assertEqual(len(row["referrals"]), 2)
        self.assertEqual(
            self.client.get("/api/v1/tasks/unseen-count").json(),
            {"count": 1, "ids": [self.submission.id]},
        )

        reopened = self.client.get(f"/api/v1/tasks/{self.submission.id}")
        self.assertEqual(reopened.status_code, 200, reopened.text)
        self.assertTrue(reopened.json()["is_read"])
        self.assertEqual(
            self.client.get("/api/v1/tasks/unseen-count").json(),
            {"count": 0, "ids": []},
        )
        self.assertEqual(
            self.db.query(SubmissionView)
            .filter(
                SubmissionView.submission_id == self.submission.id,
                SubmissionView.user_id == self.colleague.id,
            )
            .count(),
            1,
        )

    def test_in_progress_updates_progress_history_and_terminal_precedence(self):
        self._as(self.handler)
        progress = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={
                "status": "in_progress",
                "progress_percent": 45,
                "note": "working",
            },
        )
        self.assertEqual(progress.status_code, 200, progress.text)
        body = progress.json()
        self.assertEqual(body["status"], "in_progress")
        self.assertEqual(body["workflow_status"], "in_progress")
        self.assertEqual(body["progress_percent"], 45)
        self.assertEqual(
            self.client.get("/api/v1/tasks/pending-count").json(),
            {"count": 1, "ids": [self.submission.id]},
        )

        history = self.db.query(SubmissionStatusHistory).all()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].from_status, "submitted")
        self.assertEqual(history[0].to_status, "in_progress")
        self.assertEqual(history[0].from_progress_percent, 0)
        self.assertEqual(history[0].to_progress_percent, 45)

        referred = self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_id": self.colleague.id, "note": "continue"},
        )
        self.assertEqual(referred.status_code, 200, referred.text)
        self.assertEqual(referred.json()["workflow_status"], "in_progress")

        finished = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "approved", "progress_percent": 45},
        )
        self.assertEqual(finished.status_code, 200, finished.text)
        finished_body = finished.json()
        self.assertEqual(finished_body["status"], "approved")
        self.assertEqual(finished_body["workflow_status"], "completed")
        self.assertEqual(finished_body["progress_percent"], 100)
        self.assertEqual(
            self.client.get("/api/v1/tasks/pending-count").json(),
            {"count": 0, "ids": []},
        )

        status_events = [
            event
            for event in finished_body["timeline"]
            if event["event_type"] == "status_changed"
        ]
        self.assertEqual(len(status_events), 2)
        self.assertEqual(status_events[0]["progress_percent"], 45)
        self.assertEqual(status_events[1]["progress_percent"], 100)
        self.assertTrue(
            all(event["id"].startswith("status:") for event in status_events)
        )

    def test_in_progress_rejects_one_hundred_percent(self):
        self._as(self.handler)
        response = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "in_progress", "progress_percent": 100},
        )
        self.assertEqual(response.status_code, 422)

        out_of_range = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "in_progress", "progress_percent": 101},
        )
        self.assertEqual(out_of_range.status_code, 422)
        self.assertEqual(
            self.db.query(SubmissionStatusHistory).count(),
            0,
        )

    def test_rejected_is_terminal_even_with_progress_and_referral(self):
        self._as(self.handler)
        self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "in_progress", "progress_percent": 60},
        )
        self.client.post(
            f"/api/v1/tasks/{self.submission.id}/refer",
            json={"to_user_id": self.colleague.id},
        )
        rejected = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "rejected", "note": "blocked"},
        )
        self.assertEqual(rejected.status_code, 200, rejected.text)
        body = rejected.json()
        self.assertEqual(body["status"], "rejected")
        self.assertEqual(body["workflow_status"], "rejected")
        self.assertEqual(body["progress_percent"], 60)

    def test_form_access_for_referral_recipient(self):
        refer_task(
            self.db, self.handler, self.submission.id, self.colleague.id, ""
        )
        self._as(self.colleague)
        response = self.client.get(
            "/api/v1/forms/common-form",
            params={"department": "finance", "section": "petty-cash"},
        )
        self.assertEqual(response.status_code, 200, response.text)

    def test_admin_form_duties_roundtrip(self):
        self._as(self.admin)
        listed = self.client.get("/api/v1/admin/form-duties")
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertEqual(len(listed.json()["assignments"]), 1)

        saved = self.client.put(
            "/api/v1/admin/form-duties",
            json={
                "assignments": [
                    {
                        "user_id": self.handler.id,
                        "target_key": "finance:petty-cash:common-form",
                    },
                    {
                        "user_id": self.colleague.id,
                        "target_key": "finance:purchase-request:common-form",
                    },
                ]
            },
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        keys = {
            (item["user_id"], item["target_key"])
            for item in saved.json()["assignments"]
        }
        self.assertIn(
            (self.handler.id, "finance:petty-cash:common-form"), keys
        )
        self.assertIn(
            (self.colleague.id, "finance:purchase-request:common-form"), keys
        )


class SubmissionWorkflowMigrationTests(unittest.TestCase):
    def test_legacy_referral_unique_constraint_is_removed_idempotently(self):
        old_engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.addCleanup(old_engine.dispose)
        with old_engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE submission_referrals ("
                    "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "
                    "submission_id INTEGER NOT NULL, "
                    "from_user_id INTEGER NOT NULL, "
                    "to_user_id INTEGER NOT NULL, "
                    "note VARCHAR(512) NOT NULL DEFAULT '', "
                    "created_at DATETIME NOT NULL, "
                    "CONSTRAINT uq_submission_referral_target "
                    "UNIQUE (submission_id, to_user_id)"
                    ")"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO submission_referrals "
                    "(submission_id, from_user_id, to_user_id, note, created_at) "
                    "VALUES (7, 2, 3, 'legacy referral', "
                    "'2026-08-10 12:00:00')"
                )
            )

        with patch.object(init_db_module, "engine", old_engine):
            init_db_module._migrate_submission_referrals_db()
            init_db_module._migrate_submission_referrals_db()

        unique_column_sets = {
            frozenset(item.get("column_names") or [])
            for item in inspect(old_engine).get_unique_constraints(
                "submission_referrals"
            )
        }
        self.assertNotIn(
            frozenset({"submission_id", "to_user_id"}),
            unique_column_sets,
        )
        with old_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO submission_referrals "
                    "(submission_id, from_user_id, to_user_id, note, created_at) "
                    "VALUES (7, 4, 3, 'repeat referral', "
                    "'2026-08-10 13:00:00')"
                )
            )
            rows = connection.execute(
                text(
                    "SELECT submission_id, from_user_id, to_user_id, note "
                    "FROM submission_referrals ORDER BY id"
                )
            ).all()
        self.assertEqual(
            rows,
            [
                (7, 2, 3, "legacy referral"),
                (7, 4, 3, "repeat referral"),
            ],
        )

    def test_progress_column_is_added_and_approved_rows_are_backfilled(self):
        old_engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        with old_engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TABLE submissions ("
                    "id INTEGER PRIMARY KEY, "
                    "status VARCHAR(32) NOT NULL DEFAULT 'submitted'"
                    ")"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO submissions (id, status) VALUES "
                    "(1, 'approved'), (2, 'submitted')"
                )
            )

        with patch.object(init_db_module, "engine", old_engine):
            init_db_module._migrate_submissions_db()
            init_db_module._migrate_submissions_db()

        columns = {
            item["name"] for item in inspect(old_engine).get_columns("submissions")
        }
        self.assertIn("progress_percent", columns)
        with old_engine.connect() as connection:
            rows = connection.execute(
                text(
                    "SELECT id, progress_percent FROM submissions ORDER BY id"
                )
            ).all()
        self.assertEqual(rows, [(1, 100), (2, 0)])
        old_engine.dispose()


if __name__ == "__main__":
    unittest.main()
