import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.calendar_event import CalendarEvent, CalendarNotification  # noqa: F401
from app.models.department import Department  # noqa: F401 - registers FK table
from app.models.user import User
from app.schemas.calendar import CalendarEventPayload
from app.services.calendar_service import CalendarService


def _payload(**overrides):
    data = {
        "title": "Standup",
        "description": "",
        "location": "",
        "jalali_date": "1405/01/15",
        "start_time": "09:00",
        "end_time": "10:00",
        "color": "#2563eb",
    }
    data.update(overrides)
    return CalendarEventPayload(**data)


class CalendarServiceTests(unittest.TestCase):
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
        self.employee = User(
            username="employee",
            display_name="Employee",
            must_change_password=False,
            is_admin=False,
            is_active=True,
        )
        self.colleague = User(
            username="colleague",
            display_name="Colleague",
            must_change_password=False,
            is_admin=False,
            is_active=True,
        )
        self.admin = User(
            username="jira-admin",
            display_name="Admin",
            must_change_password=False,
            is_admin=True,
            is_active=True,
        )
        self.db.add_all([self.employee, self.colleague, self.admin])
        self.db.commit()
        for user in (self.employee, self.colleague, self.admin):
            self.db.refresh(user)
        self.service = CalendarService(self.db)

    def tearDown(self):
        self.db.close()

    def test_list_users_includes_admins_for_everyone(self):
        users = self.service.list_users(self.employee)
        ids = {user.id for user in users}
        self.assertEqual(ids, {self.employee.id, self.colleague.id, self.admin.id})

    def test_employee_can_create_for_admin_and_colleague(self):
        created = self.service.create_event(
            self.employee,
            _payload(user_ids=[self.admin.id, self.colleague.id]),
        )
        self.assertEqual(len(created), 2)
        owners = {item.user_id for item in created}
        self.assertEqual(owners, {self.admin.id, self.colleague.id})
        notifications = self.db.query(CalendarNotification).all()
        self.assertEqual(len(notifications), 2)

    def test_list_events_visible_to_all_users(self):
        self.service.create_event(self.admin, _payload(user_id=self.employee.id))
        rows = self.service.list_events(self.colleague)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].user_id, self.employee.id)

    def test_creator_can_update_assigned_event(self):
        created = self.service.create_event(
            self.employee, _payload(user_id=self.admin.id)
        )[0]
        updated = self.service.update_event(
            self.employee,
            created.id,
            _payload(title="Updated", user_id=self.admin.id),
        )
        self.assertEqual(updated.title, "Updated")

    def test_non_owner_non_creator_cannot_delete(self):
        created = self.service.create_event(
            self.employee, _payload(user_id=self.admin.id)
        )[0]
        with self.assertRaises(HTTPException) as raised:
            self.service.delete_event(self.colleague, created.id)
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
