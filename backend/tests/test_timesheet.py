import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.timesheet import _day_summary, add_task
from app.db.base import Base
from app.models.department import Department  # noqa: F401 - registers FK table
from app.models.timesheet import TimesheetAttendance, TimesheetProject
from app.models.user import User
from app.schemas.timesheet import TaskPayload


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


if __name__ == '__main__':
    unittest.main()
