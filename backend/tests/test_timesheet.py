import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.timesheet import (
    _day_summary,
    add_task,
    admin_create_attendance,
    admin_create_task,
    admin_update_attendance,
    admin_update_task,
)
from app.db.base import Base
from app.models.department import Department  # noqa: F401 - registers FK table
from app.models.timesheet import TimesheetAttendance, TimesheetProject, TimesheetTask
from app.models.user import User
from app.schemas.timesheet import (
    AdminAttendancePayload,
    AdminAttendanceUpdatePayload,
    AdminTaskPayload,
    TaskPayload,
)


class TimesheetTaskIntervalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            'sqlite://',
            connect_args={'check_same_thread': False},
            poolclass=StaticPool,
        )
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.user = User(username='employee', must_change_password=False)
        self.db.add_all(
            [self.user, TimesheetProject(code='GENERAL', title='General')]
        )
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self):
        self.db.close()

    def attendance(self, date, start, end=None):
        self.db.add(
            TimesheetAttendance(
                user_id=self.user.id,
                work_date=date,
                check_in_time=start,
                check_out_time=end,
            )
        )
        self.db.commit()

    def task(self, date, start, end, name='task'):
        return TaskPayload(
            work_date=date,
            project_code='GENERAL',
            task_name=name,
            start_time=start,
            end_time=end,
        )

    def assert_rejected(self, payload):
        with self.assertRaises(HTTPException) as raised:
            add_task(payload, self.user, self.db)
        self.assertEqual(raised.exception.status_code, 400)

    def test_closed_attendance_accepts_task_and_exact_boundaries(self):
        self.attendance('1405/05/10', '09:00', '11:00')
        result = add_task(
            self.task('1405/05/10', '09:00', '11:00'), self.user, self.db
        )
        self.assertEqual(result['minutes_spent'], 120)

    def test_active_attendance_uses_business_local_time(self):
        self.attendance('1405/05/10', '09:00')
        with patch(
            'app.api.routes.timesheet._local_now_time', return_value='12:00'
        ):
            result = add_task(
                self.task('1405/05/10', '10:15', '12:00'), self.user, self.db
            )
        self.assertEqual(result['minutes_spent'], 105)

    def test_active_attendance_rejects_future_end_time(self):
        self.attendance('1405/05/10', '09:00')
        with patch(
            'app.api.routes.timesheet._local_now_time', return_value='12:00'
        ):
            self.assert_rejected(
                self.task('1405/05/10', '11:30', '12:01')
            )

    def test_task_outside_attendance_is_rejected(self):
        self.attendance('1405/05/10', '09:00', '11:00')
        self.assert_rejected(self.task('1405/05/10', '08:59', '10:00'))

    def test_task_cannot_span_gap_between_attendance_segments(self):
        self.attendance('1405/05/10', '09:00', '10:00')
        self.attendance('1405/05/10', '10:30', '12:00')
        self.assert_rejected(self.task('1405/05/10', '09:30', '11:00'))

    def test_summary_reports_any_open_segment_as_checked_in(self):
        self.attendance('1405/05/10', '09:00')
        self.attendance('1405/05/10', '10:00', '11:00')
        with patch(
            'app.api.routes.timesheet._local_now_time', return_value='12:00'
        ):
            summary = _day_summary(self.db, self.user.id, '1405/05/10')
        self.assertTrue(summary['is_currently_checked_in'])


    def test_task_accepts_matching_subproject(self):
        from app.models.timesheet import TimesheetSubproject

        self.db.add(
            TimesheetSubproject(
                code='SUB-1', project_code='GENERAL', title='Sub'
            )
        )
        self.db.commit()
        self.attendance('1405/05/10', '09:00', '11:00')
        payload = TaskPayload(
            work_date='1405/05/10',
            project_code='GENERAL',
            subproject_code='SUB-1',
            task_name='sub work',
            start_time='09:00',
            end_time='10:00',
        )
        result = add_task(payload, self.user, self.db)
        self.assertEqual(result['minutes_spent'], 60)

    def test_task_rejects_subproject_from_other_project(self):
        from app.models.timesheet import TimesheetProject, TimesheetSubproject

        self.db.add(TimesheetProject(code='OTHER', title='Other'))
        self.db.add(
            TimesheetSubproject(code='SUB-2', project_code='OTHER', title='Sub')
        )
        self.db.commit()
        self.attendance('1405/05/10', '09:00', '11:00')
        self.assert_rejected(
            TaskPayload(
                work_date='1405/05/10',
                project_code='GENERAL',
                subproject_code='SUB-2',
                task_name='bad sub',
                start_time='09:00',
                end_time='10:00',
            )
        )

    def test_task_rejects_project_outside_period(self):
        from app.models.timesheet import TimesheetProject

        self.db.add(
            TimesheetProject(
                code='PRJ-RANGE',
                title='Ranged',
                start_date='1405/05/01',
                end_date='1405/05/05',
            )
        )
        self.db.commit()
        self.attendance('1405/05/10', '09:00', '11:00')
        with self.assertRaises(HTTPException) as raised:
            add_task(
                TaskPayload(
                    work_date='1405/05/10',
                    project_code='PRJ-RANGE',
                    task_name='late work',
                    start_time='09:00',
                    end_time='10:00',
                ),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn('1405/05/01', raised.exception.detail)
        self.assertIn('1405/05/05', raised.exception.detail)

    def test_task_accepts_project_inside_period(self):
        from app.models.timesheet import TimesheetProject

        self.db.add(
            TimesheetProject(
                code='PRJ-OK',
                title='Ok',
                start_date='1405/05/01',
                end_date='1405/05/15',
            )
        )
        self.db.commit()
        self.attendance('1405/05/10', '09:00', '11:00')
        result = add_task(
            TaskPayload(
                work_date='1405/05/10',
                project_code='PRJ-OK',
                task_name='in range',
                start_time='09:00',
                end_time='10:00',
            ),
            self.user,
            self.db,
        )
        self.assertEqual(result['minutes_spent'], 60)


class TimesheetAdminWriteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            'sqlite://',
            connect_args={'check_same_thread': False},
            poolclass=StaticPool,
        )
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db = self.Session()
        self.admin = User(username='admin', is_admin=True, must_change_password=False)
        self.employee = User(
            username='employee',
            display_name='کارمند تست',
            must_change_password=False,
        )
        self.db.add_all(
            [self.admin, self.employee, TimesheetProject(code='GENERAL', title='General')]
        )
        self.db.commit()
        self.db.refresh(self.employee)

    def tearDown(self):
        self.db.close()

    def test_admin_can_create_and_update_attendance(self):
        created = admin_create_attendance(
            AdminAttendancePayload(
                employee_id=self.employee.id,
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.admin,
            self.db,
        )
        attendance_id = created['attendance']['id']
        self.assertEqual(created['attendance']['check_in_time'], '09:00')
        self.assertEqual(created['attendance']['check_out_time'], '12:00')

        updated = admin_update_attendance(
            attendance_id,
            AdminAttendanceUpdatePayload(
                work_date='1405/05/10',
                check_in_time='08:30',
                check_out_time='13:00',
            ),
            self.admin,
            self.db,
        )
        self.assertEqual(updated['attendance']['check_in_time'], '08:30')
        self.assertEqual(updated['attendance']['check_out_time'], '13:00')

    def test_admin_can_create_and_update_task_for_employee(self):
        admin_create_attendance(
            AdminAttendancePayload(
                employee_id=self.employee.id,
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.admin,
            self.db,
        )
        created = admin_create_task(
            AdminTaskPayload(
                employee_id=self.employee.id,
                work_date='1405/05/10',
                project_code='GENERAL',
                task_name='کار ادمین',
                start_time='09:30',
                end_time='10:30',
            ),
            self.admin,
            self.db,
        )
        self.assertEqual(created['minutes_spent'], 60)
        task_id = created['task']['id']

        updated = admin_update_task(
            task_id,
            TaskPayload(
                work_date='1405/05/10',
                project_code='GENERAL',
                task_name='کار اصلاح‌شده',
                start_time='10:00',
                end_time='11:00',
            ),
            self.admin,
            self.db,
        )
        self.assertEqual(updated['minutes_spent'], 60)
        task = self.db.get(TimesheetTask, task_id)
        self.assertEqual(task.task_name, 'کار اصلاح‌شده')
        self.assertEqual(task.user_id, self.employee.id)

    def test_admin_cannot_shrink_attendance_under_existing_tasks(self):
        admin_create_attendance(
            AdminAttendancePayload(
                employee_id=self.employee.id,
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.admin,
            self.db,
        )
        created = admin_create_task(
            AdminTaskPayload(
                employee_id=self.employee.id,
                work_date='1405/05/10',
                project_code='GENERAL',
                task_name='کار',
                start_time='09:00',
                end_time='11:00',
            ),
            self.admin,
            self.db,
        )
        attendance = (
            self.db.query(TimesheetAttendance)
            .filter(TimesheetAttendance.user_id == self.employee.id)
            .one()
        )
        with self.assertRaises(HTTPException) as raised:
            admin_update_attendance(
                attendance.id,
                AdminAttendanceUpdatePayload(
                    work_date='1405/05/10',
                    check_in_time='09:00',
                    check_out_time='10:00',
                ),
                self.admin,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn('فعالیت', raised.exception.detail)
        self.assertEqual(created['minutes_spent'], 120)


if __name__ == '__main__':
    unittest.main()
