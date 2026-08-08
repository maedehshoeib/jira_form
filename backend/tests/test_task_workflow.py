"""End-to-end mock-data checks for form duties, tasks, approve/reject, ارجاع."""

from __future__ import annotations

import json
import unittest
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_current_user
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.models.department import Department  # noqa: F401
from app.models.form_template import FormDutyAssignment  # noqa: F401
from app.models.submission import Submission, SubmissionReferral
from app.models.user import User
from app.api.routes.portal import router as portal_router
from app.api.routes.admin import router as admin_router
from app.services.form_duty_service import replace_assignments
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

    def test_http_invalid_status(self):
        self._as(self.handler)
        response = self.client.patch(
            f"/api/v1/tasks/{self.submission.id}/status",
            json={"status": "unknown-status"},
        )
        self.assertEqual(response.status_code, 422)

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


if __name__ == "__main__":
    unittest.main()
