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
    check_in,
    check_out,
    create_my_attendance,
    delete_my_attendance,
    delete_my_task,
    update_my_attendance,
    update_my_task,
)
from app.db.base import Base
from app.models.department import Department  # noqa: F401 - registers FK table
from app.models.timesheet import TimesheetAttendance, TimesheetProject, TimesheetTask
from app.models.user import User
from app.schemas.timesheet import (
    AdminAttendancePayload,
    AdminAttendanceUpdatePayload,
    AdminTaskPayload,
    AttendanceWritePayload,
    CheckInPayload,
    CheckOutPayload,
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
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ), patch(
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

    def test_check_in_immediately_returns_checked_in_summary(self):
        with patch(
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ), patch(
            'app.api.routes.timesheet._local_now_time', return_value='09:00'
        ):
            result = check_in(
                CheckInPayload(work_date='1405/05/10', check_in_time='01:00'),
                self.user,
                self.db,
            )
        self.assertTrue(result['summary']['is_currently_checked_in'])
        self.assertEqual(result['summary']['active_work_date'], '1405/05/10')
        self.assertEqual(result['summary']['active_check_in_time'], '09:00')

    def test_check_out_closes_entry_and_returns_inactive_summary(self):
        with patch(
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ), patch(
            'app.api.routes.timesheet._local_now_time',
            side_effect=['09:00', '09:00', '17:00', '17:00'],
        ):
            check_in(
                CheckInPayload(work_date='1405/05/10', check_in_time='01:00'),
                self.user,
                self.db,
            )
            result = check_out(
                CheckOutPayload(work_date='1405/05/10', check_out_time='00:00'),
                self.user,
                self.db,
            )
        self.assertFalse(result['summary']['is_currently_checked_in'])
        self.assertIsNone(result['summary']['active_work_date'])
        self.assertEqual(
            self.db.query(TimesheetAttendance).one().check_out_time,
            '17:00',
        )

    def test_open_entry_from_another_day_is_visible_and_can_be_closed(self):
        self.attendance('1405/05/09', '09:00')

        today_summary = _day_summary(self.db, self.user.id, '1405/05/10')
        self.assertTrue(today_summary['is_currently_checked_in'])
        self.assertEqual(today_summary['active_work_date'], '1405/05/09')

        with patch(
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ), patch(
            'app.api.routes.timesheet._local_now_time', return_value='08:00'
        ):
            result = check_out(
                CheckOutPayload(work_date='1405/05/10', check_out_time='00:00'),
                self.user,
                self.db,
            )
        attendance = self.db.query(TimesheetAttendance).one()
        self.assertFalse(result['summary']['is_currently_checked_in'])
        self.assertEqual(attendance.work_date, '1405/05/09')
        self.assertEqual(attendance.check_out_time, '08:00')

    def test_corrupt_future_check_in_can_still_be_closed(self):
        self.attendance('1405/05/10', '17:00')

        with patch(
            'app.api.routes.timesheet._local_now_time', return_value='08:00'
        ):
            check_out(
                CheckOutPayload(work_date='1405/05/10', check_out_time='00:00'),
                self.user,
                self.db,
            )

        attendance = self.db.query(TimesheetAttendance).one()
        self.assertEqual(attendance.check_out_time, '08:00')

    def test_second_check_in_is_rejected_until_exit(self):
        check_in(
            CheckInPayload(work_date='1405/05/10', check_in_time='09:00'),
            self.user,
            self.db,
        )
        with self.assertRaises(HTTPException) as raised:
            check_in(
                CheckInPayload(work_date='1405/05/10', check_in_time='09:01'),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 400)

    def test_second_shift_can_start_after_exit(self):
        with patch(
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ), patch(
            'app.api.routes.timesheet._local_now_time',
            side_effect=[
                '09:00', '09:00',
                '12:00', '12:00',
                '13:00', '13:00',
            ],
        ):
            check_in(
                CheckInPayload(work_date='1405/05/10', check_in_time='01:00'),
                self.user,
                self.db,
            )
            check_out(
                CheckOutPayload(work_date='1405/05/10', check_out_time='02:00'),
                self.user,
                self.db,
            )
            result = check_in(
                CheckInPayload(work_date='1405/05/10', check_in_time='03:00'),
                self.user,
                self.db,
            )
        self.assertTrue(result['summary']['is_currently_checked_in'])
        self.assertEqual(self.db.query(TimesheetAttendance).count(), 2)

    def test_check_out_without_open_entry_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            check_out(
                CheckOutPayload(work_date='1405/05/10', check_out_time='17:00'),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 400)


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


class TimesheetSelfWriteTests(unittest.TestCase):
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
        self.user = User(
            username='employee',
            display_name='کارمند تست',
            must_change_password=False,
        )
        self.other = User(username='other', must_change_password=False)
        self.db.add_all(
            [self.user, self.other, TimesheetProject(code='GENERAL', title='General')]
        )
        self.db.commit()
        self.db.refresh(self.user)
        self.db.refresh(self.other)

    def tearDown(self):
        self.db.close()

    def test_user_can_create_and_update_own_attendance(self):
        created = create_my_attendance(
            AttendanceWritePayload(
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.user,
            self.db,
        )
        attendance_id = created['attendance']['id']
        self.assertEqual(created['attendance']['check_in_time'], '09:00')

        updated = update_my_attendance(
            attendance_id,
            AttendanceWritePayload(
                work_date='1405/05/10',
                check_in_time='08:30',
                check_out_time='13:00',
            ),
            self.user,
            self.db,
        )
        self.assertEqual(updated['attendance']['check_in_time'], '08:30')
        self.assertEqual(updated['attendance']['check_out_time'], '13:00')

    def test_user_cannot_edit_another_users_attendance(self):
        created = create_my_attendance(
            AttendanceWritePayload(
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.other,
            self.db,
        )
        with self.assertRaises(HTTPException) as raised:
            update_my_attendance(
                created['attendance']['id'],
                AttendanceWritePayload(
                    work_date='1405/05/10',
                    check_in_time='08:00',
                    check_out_time='12:00',
                ),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 404)

    def test_user_can_create_and_update_own_task(self):
        create_my_attendance(
            AttendanceWritePayload(
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.user,
            self.db,
        )
        created = add_task(
            TaskPayload(
                work_date='1405/05/10',
                project_code='GENERAL',
                task_name='کار اولیه',
                start_time='09:30',
                end_time='10:30',
            ),
            self.user,
            self.db,
        )
        task_id = created['task']['id']
        updated = update_my_task(
            task_id,
            TaskPayload(
                work_date='1405/05/10',
                project_code='GENERAL',
                task_name='کار اصلاح‌شده',
                start_time='10:00',
                end_time='11:00',
            ),
            self.user,
            self.db,
        )
        self.assertEqual(updated['minutes_spent'], 60)
        self.assertEqual(updated['task']['task_name'], 'کار اصلاح‌شده')

    def test_user_cannot_update_another_users_task(self):
        create_my_attendance(
            AttendanceWritePayload(
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.other,
            self.db,
        )
        created = add_task(
            TaskPayload(
                work_date='1405/05/10',
                project_code='GENERAL',
                task_name='کار دیگری',
                start_time='09:30',
                end_time='10:30',
            ),
            self.other,
            self.db,
        )
        with self.assertRaises(HTTPException) as raised:
            update_my_task(
                created['task']['id'],
                TaskPayload(
                    work_date='1405/05/10',
                    project_code='GENERAL',
                    task_name='تلاش غیرمجاز',
                    start_time='09:30',
                    end_time='10:30',
                ),
                self.user,
                self.db,
            )
        self.assertEqual(raised.exception.status_code, 404)

    def test_user_can_delete_own_task_and_attendance(self):
        created_attendance = create_my_attendance(
            AttendanceWritePayload(
                work_date='1405/05/10',
                check_in_time='09:00',
                check_out_time='12:00',
            ),
            self.user,
            self.db,
        )
        created_task = add_task(
            TaskPayload(
                work_date='1405/05/10',
                project_code='GENERAL',
                task_name='کار',
                start_time='09:00',
                end_time='10:00',
            ),
            self.user,
            self.db,
        )
        delete_my_task(created_task['task']['id'], self.user, self.db)
        delete_my_attendance(
            created_attendance['attendance']['id'], self.user, self.db
        )
        self.assertEqual(self.db.query(TimesheetTask).count(), 0)
        self.assertEqual(self.db.query(TimesheetAttendance).count(), 0)

    def test_other_day_attendance_requires_checkout(self):
        with patch(
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ):
            with self.assertRaises(HTTPException) as raised:
                create_my_attendance(
                    AttendanceWritePayload(
                        work_date='1405/05/09',
                        check_in_time='09:00',
                        check_out_time=None,
                    ),
                    self.user,
                    self.db,
                )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn('خروج', raised.exception.detail)

    def test_user_can_submit_and_edit_task_on_another_day(self):
        with patch(
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ):
            create_my_attendance(
                AttendanceWritePayload(
                    work_date='1405/05/09',
                    check_in_time='09:00',
                    check_out_time='17:00',
                ),
                self.user,
                self.db,
            )
            created = add_task(
                TaskPayload(
                    work_date='1405/05/09',
                    project_code='GENERAL',
                    task_name='کار دیروز',
                    start_time='10:00',
                    end_time='12:00',
                ),
                self.user,
                self.db,
            )
            updated = update_my_task(
                created['task']['id'],
                TaskPayload(
                    work_date='1405/05/09',
                    project_code='GENERAL',
                    task_name='کار دیروز اصلاح‌شده',
                    start_time='11:00',
                    end_time='13:00',
                ),
                self.user,
                self.db,
            )
        self.assertEqual(updated['minutes_spent'], 120)
        self.assertEqual(updated['task']['work_date'], '1405/05/09')
        self.assertEqual(updated['task']['task_name'], 'کار دیروز اصلاح‌شده')

    def test_http_self_service_posts_are_allowed(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.api.routes.timesheet import router as timesheet_router
        from app.core.deps import get_current_user
        from app.db.session import get_db

        app = FastAPI()
        app.include_router(timesheet_router, prefix='/api/v1/timesheet')

        def override_db():
            yield self.db

        def override_user():
            return self.user

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user

        with patch(
            'app.api.routes.timesheet.jalali_today', return_value='1405/05/10'
        ), TestClient(app) as client:
            created = client.post(
                '/api/v1/timesheet/attendance/entries',
                json={
                    'work_date': '1405/05/09',
                    'check_in_time': '09:00',
                    'check_out_time': '17:00',
                },
            )
            self.assertNotEqual(created.status_code, 405, created.text)
            self.assertEqual(created.status_code, 200, created.text)
            attendance_id = created.json()['attendance']['id']

            updated = client.post(
                f'/api/v1/timesheet/attendance/entries/{attendance_id}',
                json={
                    'work_date': '1405/05/09',
                    'check_in_time': '08:30',
                    'check_out_time': '16:30',
                },
            )
            self.assertEqual(updated.status_code, 200, updated.text)

            task = client.post(
                '/api/v1/timesheet/tasks',
                json={
                    'work_date': '1405/05/09',
                    'project_code': 'GENERAL',
                    'task_name': 'کار دیروز',
                    'start_time': '09:00',
                    'end_time': '11:00',
                },
            )
            self.assertEqual(task.status_code, 200, task.text)
            task_id = task.json()['task']['id']

            edited = client.post(
                f'/api/v1/timesheet/tasks/entries/{task_id}',
                json={
                    'work_date': '1405/05/09',
                    'project_code': 'GENERAL',
                    'task_name': 'کار دیروز اصلاح‌شده',
                    'start_time': '10:00',
                    'end_time': '12:00',
                },
            )
            self.assertEqual(edited.status_code, 200, edited.text)
            self.assertEqual(edited.json()['task']['task_name'], 'کار دیروز اصلاح‌شده')

            alias = client.post(
                '/api/v1/timesheet/me/attendance',
                json={
                    'work_date': '1405/05/09',
                    'check_in_time': '18:00',
                    'check_out_time': '19:00',
                },
            )
            self.assertEqual(alias.status_code, 200, alias.text)


if __name__ == '__main__':
    unittest.main()
