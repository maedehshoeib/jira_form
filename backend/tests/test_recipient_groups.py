"""Personal recipient group ownership, validation, and membership."""

from __future__ import annotations

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.recipient_groups import router as groups_router
from app.core.deps import get_current_user
from app.db.base import Base
from app.db.session import get_db
from app.models.department import Department  # noqa: F401
from app.models.recipient_group import RecipientGroup, RecipientGroupMember  # noqa: F401
from app.models.user import User


class RecipientGroupTests(unittest.TestCase):
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
        self.owner = self._user("owner", "مالک")
        self.manager = self._user("manager", "مدیر یک", department="مالی", job_title="مدیر")
        self.other_manager = self._user("manager2", "مدیر دو")
        self.inactive = self._user("inactive", "غیرفعال", is_active=False)
        self.stranger = self._user("stranger", "غریبه")
        self.db.commit()
        for user in (
            self.owner,
            self.manager,
            self.other_manager,
            self.inactive,
            self.stranger,
        ):
            self.db.refresh(user)

        self._actor = self.owner
        app = FastAPI()
        app.include_router(groups_router, prefix="/api/v1")

        def override_db():
            yield self.db

        def override_user():
            return self._actor

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()

    def _user(self, username: str, name: str, **flags) -> User:
        user = User(
            username=username,
            display_name=name,
            is_active=True,
        )
        for key, value in flags.items():
            setattr(user, key, value)
        self.db.add(user)
        self.db.flush()
        return user

    def test_create_list_update_and_delete_own_group(self):
        created = self.client.post(
            "/api/v1/recipient-groups",
            json={
                "name": "  مدیران  ",
                "member_ids": [self.manager.id, self.manager.id, self.other_manager.id],
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        body = created.json()
        self.assertEqual(body["name"], "مدیران")
        self.assertEqual(
            [member["id"] for member in body["members"]],
            sorted(
                [self.manager.id, self.other_manager.id],
                key=lambda user_id: (
                    self.db.get(User, user_id).display_name,
                    user_id,
                ),
            ),
        )
        manager = next(member for member in body["members"] if member["id"] == self.manager.id)
        self.assertNotIn("email", manager)
        self.assertEqual(manager["department"], "مالی")
        self.assertEqual(manager["job_title"], "مدیر")

        listing = self.client.get("/api/v1/recipient-groups")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.json()), 1)

        updated = self.client.put(
            f"/api/v1/recipient-groups/{body['id']}",
            json={"name": "هیئت مدیره", "member_ids": [self.other_manager.id]},
        )
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["name"], "هیئت مدیره")
        self.assertEqual(
            [member["id"] for member in updated.json()["members"]],
            [self.other_manager.id],
        )

        deleted = self.client.delete(f"/api/v1/recipient-groups/{body['id']}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get("/api/v1/recipient-groups").json(), [])

    def test_rejects_duplicate_blank_and_inactive_members(self):
        first = self.client.post(
            "/api/v1/recipient-groups",
            json={"name": "مدیران", "member_ids": [self.manager.id]},
        )
        self.assertEqual(first.status_code, 201, first.text)

        duplicate = self.client.post(
            "/api/v1/recipient-groups",
            json={"name": "مدیران", "member_ids": [self.other_manager.id]},
        )
        self.assertEqual(duplicate.status_code, 409)

        blank = self.client.post(
            "/api/v1/recipient-groups",
            json={"name": "   ", "member_ids": [self.manager.id]},
        )
        self.assertEqual(blank.status_code, 400)

        inactive = self.client.post(
            "/api/v1/recipient-groups",
            json={"name": "قدیمی", "member_ids": [self.inactive.id]},
        )
        self.assertEqual(inactive.status_code, 400)

        missing = self.client.post(
            "/api/v1/recipient-groups",
            json={"name": "ناشناس", "member_ids": [99999]},
        )
        self.assertEqual(missing.status_code, 400)

    def test_other_user_cannot_see_or_change_groups(self):
        created = self.client.post(
            "/api/v1/recipient-groups",
            json={"name": "مدیران", "member_ids": [self.manager.id]},
        ).json()
        self._actor = self.stranger

        self.assertEqual(self.client.get("/api/v1/recipient-groups").json(), [])
        updated = self.client.put(
            f"/api/v1/recipient-groups/{created['id']}",
            json={"name": "ربوده", "member_ids": [self.stranger.id]},
        )
        deleted = self.client.delete(f"/api/v1/recipient-groups/{created['id']}")
        self.assertEqual(updated.status_code, 404)
        self.assertEqual(deleted.status_code, 404)

        self._actor = self.owner
        listing = self.client.get("/api/v1/recipient-groups").json()
        self.assertEqual(listing[0]["name"], "مدیران")
        self.assertEqual(listing[0]["members"][0]["id"], self.manager.id)
