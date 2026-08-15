import unittest
from datetime import date, datetime
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.jalali import (
    default_analytics_range,
    gregorian_to_jalali,
    jalali_to_gregorian,
)
from app.db.base import Base
from app.models.admin_session import AdminSession  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.submission import Submission
from app.models.timesheet import TimesheetAttendance, TimesheetProject, TimesheetTask
from app.models.user import User
from app.services.admin_analytics_service import build_analytics


class JalaliHelperTests(unittest.TestCase):
    def test_round_trip_known_dates(self):
        self.assertEqual(gregorian_to_jalali(date(2024, 3, 20)), "1403/01/01")
        self.assertEqual(jalali_to_gregorian("1403/01/01"), date(2024, 3, 20))

    def test_default_range_is_inclusive_week(self):
        with patch("app.core.jalali.tehran_today", return_value=date(2026, 8, 3)):
            start, end = default_analytics_range(6)
        self.assertEqual(end, gregorian_to_jalali(date(2026, 8, 3)))
        self.assertEqual(start, gregorian_to_jalali(date(2026, 7, 28)))


class AdminAnalyticsServiceTests(unittest.TestCase):
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
        self.admin = User(
            username="admin",
            is_admin=True,
            must_change_password=False,
            display_name="Admin",
        )
        self.employee = User(
            username="employee",
            must_change_password=False,
            display_name="Ali",
            department="فناوری اطلاعات",
            job_title="Developer",
            is_active=True,
        )
        self.employee_hr = User(
            username="hr.user",
            must_change_password=False,
            display_name="Sara",
            department="منابع انسانی",
            job_title="HR",
            is_active=True,
        )
        self.db.add_all(
            [
                self.admin,
                self.employee,
                self.employee_hr,
                TimesheetProject(code="PRJ-1", title="Portal", is_active=True),
                TimesheetProject(code="PRJ-2", title="Legacy", is_active=False),
            ]
        )
        self.db.commit()
        self.db.refresh(self.admin)
        self.db.refresh(self.employee)
        self.db.refresh(self.employee_hr)

        self.db.add_all(
            [
                TimesheetAttendance(
                    user_id=self.employee.id,
                    work_date="1405/05/10",
                    check_in_time="09:00",
                    check_out_time="17:00",
                ),
                TimesheetAttendance(
                    user_id=self.employee_hr.id,
                    work_date="1405/05/10",
                    check_in_time="08:00",
                    check_out_time="16:00",
                ),
                TimesheetTask(
                    user_id=self.employee.id,
                    work_date="1405/05/10",
                    project_code="PRJ-1",
                    task_name="Build dashboard",
                    start_time="09:30",
                    end_time="12:30",
                    minutes_spent=180,
                ),
                TimesheetTask(
                    user_id=self.employee_hr.id,
                    work_date="1405/05/10",
                    project_code="PRJ-2",
                    task_name="Archive docs",
                    start_time="09:00",
                    end_time="10:00",
                    minutes_spent=60,
                ),
                Submission(
                    form_id="common-form",
                    department_id="it",
                    section_id="it-support",
                    user_id=self.employee.id,
                    subject="Need access",
                    status="submitted",
                    created_at=datetime(2026, 8, 1, 10, 0, 0),
                ),
                Submission(
                    form_id="hr-form",
                    department_id="hr",
                    section_id="new-hire",
                    user_id=self.employee_hr.id,
                    subject="Hire request",
                    status="submitted",
                    created_at=datetime(2026, 8, 1, 11, 0, 0),
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_build_analytics_aggregates_timesheet_and_forms(self):
        result = build_analytics(
            self.db,
            admin=self.admin,
            start_date="1405/05/01",
            end_date="1405/05/12",
        )
        self.assertEqual(result.overview.task_count, 2)
        self.assertEqual(result.overview.task_minutes, 240)
        self.assertEqual(result.overview.attendance_minutes, 960)
        self.assertEqual(result.overview.requests_in_range, 2)
        self.assertEqual(result.projects[0].code, "PRJ-1")
        self.assertEqual(result.projects[0].minutes, 180)
        self.assertTrue(result.projects[0].is_active)
        employee = next(row for row in result.employees if row.username == "employee")
        self.assertEqual(employee.task_count, 1)
        self.assertEqual(employee.form_count, 1)
        self.assertTrue(any(row.name == "فناوری اطلاعات" for row in result.departments))
        self.assertTrue(result.forms.by_org_department)
        self.assertTrue(
            any("فناوری" in item.label or item.value == 1 for item in result.forms.by_org_department)
        )
        self.assertTrue(
            any("فناوری اطلاعات" in item.label for item in result.forms.by_portal_department)
            or any(item.value >= 1 for item in result.forms.by_portal_department)
        )
        self.assertEqual(len(result.filter_options.employees), 2)
        self.assertEqual(len(result.filter_options.projects), 2)
        self.assertTrue(result.filter_options.forms)
        self.assertIn("فناوری اطلاعات", result.filter_options.departments)

    def test_rejects_inverted_range(self):
        with self.assertRaises(ValueError):
            build_analytics(
                self.db,
                admin=self.admin,
                start_date="1405/05/12",
                end_date="1405/05/01",
            )

    def test_filter_by_department(self):
        result = build_analytics(
            self.db,
            admin=self.admin,
            start_date="1405/05/01",
            end_date="1405/05/12",
            department="فناوری اطلاعات",
        )
        self.assertEqual(result.overview.task_count, 1)
        self.assertEqual(result.overview.task_minutes, 180)
        self.assertEqual(result.overview.requests_in_range, 1)
        self.assertEqual(len(result.departments), 1)
        self.assertEqual(result.departments[0].name, "فناوری اطلاعات")
        self.assertTrue(all(row.department == "فناوری اطلاعات" for row in result.employees))
        self.assertEqual(len(result.filter_options.employees), 2)

    def test_filter_by_employee(self):
        result = build_analytics(
            self.db,
            admin=self.admin,
            start_date="1405/05/01",
            end_date="1405/05/12",
            employee_id=str(self.employee_hr.id),
        )
        self.assertEqual(result.overview.task_minutes, 60)
        self.assertEqual(result.overview.requests_in_range, 1)
        self.assertEqual(len(result.employees), 1)
        self.assertEqual(result.employees[0].username, "hr.user")

    def test_filter_by_project_code(self):
        result = build_analytics(
            self.db,
            admin=self.admin,
            start_date="1405/05/01",
            end_date="1405/05/12",
            project_code="PRJ-1",
        )
        self.assertEqual(result.overview.task_count, 1)
        self.assertEqual(result.overview.task_minutes, 180)
        self.assertEqual(len(result.projects), 1)
        self.assertEqual(result.projects[0].code, "PRJ-1")
        self.assertEqual(len(result.filter_options.projects), 2)

    def test_filter_by_project_status(self):
        inactive = build_analytics(
            self.db,
            admin=self.admin,
            start_date="1405/05/01",
            end_date="1405/05/12",
            project_status="inactive",
        )
        self.assertEqual(len(inactive.projects), 1)
        self.assertEqual(inactive.projects[0].code, "PRJ-2")
        self.assertFalse(inactive.projects[0].is_active)
        self.assertEqual(inactive.overview.task_minutes, 60)

        active = build_analytics(
            self.db,
            admin=self.admin,
            start_date="1405/05/01",
            end_date="1405/05/12",
            project_status="active",
        )
        self.assertEqual(len(active.projects), 1)
        self.assertEqual(active.projects[0].code, "PRJ-1")
        self.assertTrue(active.projects[0].is_active)

    def test_filter_by_form_id(self):
        result = build_analytics(
            self.db,
            admin=self.admin,
            start_date="1405/05/01",
            end_date="1405/05/12",
            form_id="hr-form",
        )
        self.assertEqual(result.overview.requests_in_range, 1)
        self.assertEqual(len(result.forms.by_form), 1)
        self.assertTrue(all(item.form_id == "hr-form" for item in result.forms.recent_requests))
        self.assertTrue(result.filter_options.forms)


if __name__ == "__main__":
    unittest.main()
