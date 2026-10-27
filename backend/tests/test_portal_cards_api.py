"""HTTP-level tests for portal cards and their custom-form submission flow."""

import json
import tempfile
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.router import api_router
from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.db.base import Base
from app.db.session import get_db
from app.models import submission as submission_models  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.submission import Submission
from app.models.user import User

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


class PortalCardApiTests(unittest.TestCase):
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
            username="admin", display_name="مدیر", is_active=True, is_admin=True,
            must_change_password=False,
        )
        self.employee = User(
            username="emp", display_name="کارمند", is_active=True, is_admin=False,
            must_change_password=False,
        )
        self.db.add_all([self.admin, self.employee])
        self.db.commit()

        self.current = self.admin
        app = FastAPI()
        app.include_router(api_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.current
        app.dependency_overrides[get_optional_user] = lambda: self.current
        self.client = TestClient(app)

    def tearDown(self):
        settings.UPLOAD_DIR = self._original_upload_dir
        self.db.close()
        self.upload_root.cleanup()

    def _create(self, kind: str, title: str, parent_id: int | None = None, **extra):
        data = {"kind": kind, "title": title, **extra}
        if parent_id is not None:
            data["parent_id"] = str(parent_id)
        response = self.client.post("/api/v1/admin/portal-cards", data=data)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def _leave_request_form(self):
        group = self._create("group", "منابع انسانی")
        form = self._create("form", "درخواست مرخصی", group["id"])
        schema = {
            "sections": [
                {
                    "id": "main",
                    "title": "اطلاعات",
                    "fields": [
                        {"name": "reason", "label": "دلیل", "type": "text", "required": True},
                        {
                            "name": "kind", "label": "نوع", "type": "select",
                            "options": [{"label": "استحقاقی", "value": "paid"}],
                        },
                    ],
                }
            ]
        }
        response = self.client.put(
            f"/api/v1/admin/portal-cards/{form['id']}/form", json=schema
        )
        self.assertEqual(response.status_code, 200, response.text)
        return group, form

    def test_admin_builds_card_and_employee_submits_custom_form(self):
        group, form = self._leave_request_form()
        form_id = f"custom-{form['id']}"

        self.current = self.employee
        root = self.client.get("/api/v1/portal-cards").json()
        self.assertEqual([c["title"] for c in root], ["منابع انسانی"])
        children = self.client.get(f"/api/v1/portal-cards/{group['id']}").json()["children"]
        self.assertEqual([c["kind"] for c in children], ["form"])

        template = self.client.get(
            f"/api/v1/forms/{form_id}", params={"department": "x", "section": "y"}
        )
        self.assertEqual(template.status_code, 200, template.text)
        self.assertEqual(template.json()["department_id"], "custom")

        missing = self.client.post(
            "/api/v1/submissions",
            data={"form_id": form_id, "department_id": "x", "section_id": "y"},
        )
        self.assertEqual(missing.status_code, 422)
        self.assertEqual(self.db.query(Submission).count(), 0)

        created = self.client.post(
            "/api/v1/submissions",
            data={
                "form_id": form_id, "department_id": "spoofed", "section_id": "spoofed",
                "reason": "سفر خانوادگی", "kind": "paid", "extra": "dropped",
            },
        )
        self.assertEqual(created.status_code, 200, created.text)
        saved = self.db.query(Submission).one()
        self.assertEqual(saved.department_id, "custom")
        self.assertEqual(saved.section_id, f"card-{form['id']}")
        self.assertEqual(saved.subject, "سفر خانوادگی")
        self.assertEqual(json.loads(saved.data), {"reason": "سفر خانوادگی", "kind": "paid"})

        listed = self.client.get("/api/v1/submissions").json()
        self.assertEqual(listed[0]["form_title"], "درخواست مرخصی")
        self.assertEqual(listed[0]["department_title"], "منابع انسانی")

    def test_unpublished_or_deleted_forms_reject_submissions(self):
        _, form = self._leave_request_form()
        form_id = f"custom-{form['id']}"
        self.client.put(
            f"/api/v1/admin/portal-cards/{form['id']}",
            data={"title": "درخواست مرخصی", "is_published": "false"},
        )
        self.current = self.employee
        payload = {"form_id": form_id, "reason": "x"}
        self.assertEqual(self.client.post("/api/v1/submissions", data=payload).status_code, 403)
        self.assertEqual(self.client.get(f"/api/v1/forms/{form_id}").status_code, 403)

        self.current = self.admin
        self.assertEqual(self.client.delete(f"/api/v1/admin/portal-cards/{form['id']}").status_code, 204)
        self.current = self.employee
        self.assertEqual(self.client.post("/api/v1/submissions", data=payload).status_code, 403)

    def test_employee_cannot_use_admin_endpoints(self):
        self.current = self.employee
        client = self.client
        self.assertEqual(client.get("/api/v1/admin/portal-cards").status_code, 403)
        self.assertEqual(
            client.post("/api/v1/admin/portal-cards", data={"kind": "group", "title": "x"}).status_code,
            403,
        )
        self.assertEqual(client.post("/api/v1/admin/portal-cards/reorder", json={"ordered_ids": []}).status_code, 403)

    def test_logo_is_served_and_document_files_download(self):
        card = self._create("document", "مستند")
        updated = self.client.put(
            f"/api/v1/admin/portal-cards/{card['id']}",
            data={"title": "مستند"},
            files={"logo": ("logo.png", PNG, "image/png")},
        )
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertTrue(updated.json()["logo_url"])
        self.assertEqual(self.client.get(f"/api/v1/portal-cards/{card['id']}/logo").status_code, 200)

        uploaded = self.client.post(
            f"/api/v1/admin/portal-cards/{card['id']}/files",
            data={"title": "راهنما"},
            files={"file": ("guide.pdf", b"%PDF-1.4 body", "application/pdf")},
        )
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        file_id = uploaded.json()["files"][0]["id"]

        self.current = self.employee
        download = self.client.get(f"/api/v1/portal-cards/{card['id']}/files/{file_id}")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.content, b"%PDF-1.4 body")

    def test_reorder_route_is_not_shadowed_by_card_id_route(self):
        first = self._create("group", "الف")
        second = self._create("group", "ب")
        response = self.client.post(
            "/api/v1/admin/portal-cards/reorder",
            json={"parent_id": None, "ordered_ids": [second["id"], first["id"]]},
        )
        self.assertEqual(response.status_code, 204, response.text)
        titles = [c["title"] for c in self.client.get("/api/v1/portal-cards").json()]
        self.assertEqual(titles, ["ب", "الف"])

    def test_invalid_form_schema_is_rejected_with_422(self):
        form = self._create("form", "فرم")
        bad = {"sections": [{"id": "s", "title": "", "fields": [
            {"name": "a", "label": "الف", "type": "select", "options": []}]}]}
        response = self.client.put(f"/api/v1/admin/portal-cards/{form['id']}/form", json=bad)
        self.assertEqual(response.status_code, 422)

    def test_grant_and_duty_make_every_card_usable(self):
        group = self._create("group", "گروه", is_published="false")
        first = self._create("form", "فرم اول", group["id"], is_published="false")
        second = self._create("form", "فرم دوم", is_published="false")
        self._create("document", "مستند", group["id"], is_published="false")
        handler = User(
            username="handler", display_name="مسئول", is_active=True, is_admin=False,
            must_change_password=False,
        )
        self.db.add(handler)
        self.db.commit()

        def target_key(item: dict) -> str:
            return f"{item['portal_department_id']}:{item['section_id']}:{item['form_id']}"

        catalog = self.client.get("/api/v1/admin/form-access/catalog")
        self.assertEqual(catalog.status_code, 200, catalog.text)
        custom = [item for item in catalog.json() if item["portal_department_id"] == "custom"]
        self.assertEqual(
            sorted(item["kind"] for item in custom),
            ["document", "form", "form", "group"],
        )
        self.assertTrue(all(item["is_published"] is False for item in custom))

        self.current = self.employee
        self.assertEqual(self.client.get("/api/v1/portal-cards").json(), [])

        self.current = self.admin
        form_keys = [target_key(item) for item in custom if item["kind"] == "form"]
        document_key = next(target_key(item) for item in custom if item["kind"] == "document")
        group_key = next(target_key(item) for item in custom if item["kind"] == "group")
        granted = self.client.put(
            f"/api/v1/admin/users/{self.employee.id}/form-access",
            json={"configured": True, "targets": [*form_keys, document_key]},
        )
        self.assertEqual(granted.status_code, 200, granted.text)
        routed = self.client.put(
            "/api/v1/admin/form-duties",
            json={"assignments": [{"user_id": handler.id, "target_key": group_key}]},
        )
        self.assertEqual(routed.status_code, 200, routed.text)

        self.current = self.employee
        root = [card["title"] for card in self.client.get("/api/v1/portal-cards").json()]
        self.assertEqual(root, ["گروه", "فرم دوم"])
        children = [
            card["title"]
            for card in self.client.get(f"/api/v1/portal-cards/{group['id']}").json()["children"]
        ]
        self.assertEqual(children, ["فرم اول", "مستند"])
        opened = self.client.get(f"/api/v1/portal-cards/{first['id']}")
        self.assertEqual(opened.status_code, 200, opened.text)
        submitted = self.client.post(
            "/api/v1/submissions",
            data={"form_id": f"custom-{first['id']}"},
        )
        self.assertEqual(submitted.status_code, 200, submitted.text)

        self.current = handler
        tasks = self.client.get("/api/v1/tasks")
        self.assertEqual(tasks.status_code, 200, tasks.text)
        self.assertEqual([item["id"] for item in tasks.json()], [submitted.json()["id"]])
        self.assertEqual(
            [card["title"] for card in self.client.get("/api/v1/portal-cards").json()],
            ["گروه"],
        )

    def test_direct_card_route_reloads_and_delivers_the_filled_form(self):
        form = self._create("form", "فرم تازه")
        schema = {"sections": [{"id": "main", "title": "اطلاعات", "fields": [
            {"name": "reason", "label": "دلیل", "type": "text", "required": True}
        ]}]}
        saved_form = self.client.put(f"/api/v1/admin/portal-cards/{form['id']}/form", json=schema)
        self.assertEqual(saved_form.status_code, 200, saved_form.text)
        handler = User(
            username="direct-handler", display_name="مسئول فرم", is_active=True,
            is_admin=False, must_change_password=False,
        )
        self.db.add(handler)
        self.db.commit()

        catalog = self.client.get("/api/v1/admin/form-access/catalog")
        form_key = next(
            f"{item['portal_department_id']}:{item['section_id']}:{item['form_id']}"
            for item in catalog.json()
            if item["kind"] == "form" and item["section_title"] == "فرم تازه"
        )
        routed = self.client.put(
            "/api/v1/admin/form-duties",
            json={"assignments": [
                {"user_id": handler.id, "target_key": "custom:card-99999:custom-99999"},
                {"user_id": handler.id, "target_key": form_key},
            ]},
        )
        self.assertEqual(routed.status_code, 200, routed.text)
        self.assertEqual(
            [item["target_key"] for item in routed.json()["assignments"]],
            [form_key],
        )
        reloaded = self.client.get("/api/v1/admin/form-duties")
        self.assertEqual(
            [item["target_key"] for item in reloaded.json()["assignments"]],
            [form_key],
        )

        self.current = self.employee
        submitted = self.client.post(
            "/api/v1/submissions",
            data={"form_id": f"custom-{form['id']}", "reason": "متن درخواست"},
        )
        self.assertEqual(submitted.status_code, 200, submitted.text)

        self.current = handler
        tasks = self.client.get("/api/v1/tasks")
        self.assertEqual(tasks.status_code, 200, tasks.text)
        self.assertEqual([item["id"] for item in tasks.json()], [submitted.json()["id"]])
        detail = self.client.get(f"/api/v1/tasks/{submitted.json()['id']}")
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["data"]["reason"], "متن درخواست")


if __name__ == "__main__":
    unittest.main()
