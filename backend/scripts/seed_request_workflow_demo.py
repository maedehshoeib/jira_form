"""Seed repeatable examples for the request lifecycle UI.

Run from the repository root:
    .venv/Scripts/python.exe backend/scripts/seed_request_workflow_demo.py

The script targets the same local database as the backend development server.
It refreshes only submissions with the exact demo subjects declared below, so
it is safe to rerun after experimenting with progress and status controls.
Normal portal submissions and existing duty assignments are left untouched.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import json
import os
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Resolve the local SQLite path independently of the directory used to invoke
# the script. Explicit environment settings still take precedence in Docker.
os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{(BACKEND_DIR / 'data' / 'portal.db').as_posix()}",
)
os.environ.setdefault(
    "CONTRACTS_DATABASE_URL",
    f"sqlite:///{(BACKEND_DIR / 'data' / 'contracts.db').as_posix()}",
)
os.environ.setdefault("UPLOAD_DIR", str(BACKEND_DIR / "data" / "uploads"))
os.environ.setdefault(
    "CONTRACTS_UPLOAD_DIR",
    str(BACKEND_DIR / "data" / "contracts_uploads"),
)

from app.db.init_db import init_db  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.form_template import FormDutyAssignment  # noqa: E402
from app.models.submission import (  # noqa: E402
    Submission,
    SubmissionInitialAssignee,
    SubmissionReferral,
    SubmissionStatusHistory,
    SubmissionView,
)
from app.models.user import User  # noqa: E402
from app.services.task_workflow_service import (  # noqa: E402
    derive_workflow_status,
    list_task_submissions,
)


DEPARTMENT_ID = "it"
SECTION_ID = "it-support"
FORM_ID = "common-form"


@dataclass(frozen=True)
class ViewSpec:
    minutes: int
    actor: str


@dataclass(frozen=True)
class ReferralSpec:
    minutes: int
    actor: str
    target: str
    note: str


@dataclass(frozen=True)
class StatusSpec:
    minutes: int
    actor: str
    status: str
    progress: int
    note: str


@dataclass(frozen=True)
class DemoSpec:
    subject: str
    description: str
    age_hours: int
    views: tuple[ViewSpec, ...] = ()
    referrals: tuple[ReferralSpec, ...] = ()
    history: tuple[StatusSpec, ...] = ()


MY_REQUEST_SPECS = (
    DemoSpec(
        subject="[نمونه گردش کار] قطعی شبکه در اتاق جلسات طبقه سوم",
        description=(
            "شبکه اتاق جلسات از صبح قطع است. این درخواست عمداً باز نشده تا "
            "وضعیت «دیده‌نشده» و رنگ متفاوت آن نمایش داده شود."
        ),
        age_hours=2,
    ),
    DemoSpec(
        subject="[نمونه گردش کار] نصب و راه‌اندازی پرینتر واحد مالی",
        description=(
            "پرینتر جدید تحویل شده و نیاز به نصب درایور و اشتراک‌گذاری در شبکه دارد."
        ),
        age_hours=26,
        views=(ViewSpec(35, "handler"),),
    ),
    DemoSpec(
        subject="[نمونه گردش کار] ایجاد دسترسی VPN برای دورکاری",
        description=(
            "برای دسترسی امن به سامانه‌های داخلی در روزهای دورکاری، حساب VPN لازم است."
        ),
        age_hours=50,
        views=(ViewSpec(25, "handler"),),
        referrals=(
            ReferralSpec(
                80,
                "handler",
                "colleague",
                "لطفاً دسترسی شبکه و سطح مجوز موردنیاز را بررسی کنید.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه گردش کار] بررسی کندی اینترنت واحد منابع انسانی",
        description=(
            "از ابتدای امروز سرعت دسترسی به سامانه‌های تحت وب در واحد منابع انسانی کم شده است."
        ),
        age_hours=74,
        views=(ViewSpec(20, "handler"),),
        history=(
            StatusSpec(
                90,
                "handler",
                "in_progress",
                25,
                "عیب‌یابی اولیه انجام شد؛ در حال بررسی مسیر شبکه هستیم.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه گردش کار] جابه‌جایی تجهیزات شبکه اتاق سرور",
        description=(
            "رک جانبی باید جابه‌جا شود و پس از کابل‌کشی، ارتباط تجهیزات دوباره تست شود."
        ),
        age_hours=98,
        views=(ViewSpec(20, "handler"),),
        history=(
            StatusSpec(
                75,
                "handler",
                "in_progress",
                30,
                "محل جدید و مسیر کابل‌کشی آماده شد.",
            ),
            StatusSpec(
                300,
                "handler",
                "in_progress",
                70,
                "جابه‌جایی انجام شد؛ نصب و تست نهایی باقی مانده است.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه گردش کار] نصب تلفن داخلی برای همکار جدید",
        description=(
            "برای میز همکار جدید یک داخلی فعال و تلفن تنظیم‌شده موردنیاز است."
        ),
        age_hours=122,
        views=(ViewSpec(15, "handler"),),
        history=(
            StatusSpec(
                70,
                "handler",
                "in_progress",
                60,
                "شماره داخلی تخصیص داده شد و کابل‌کشی انجام شده است.",
            ),
            StatusSpec(
                260,
                "handler",
                "approved",
                100,
                "نصب، شماره‌گذاری و تست تماس با موفقیت انجام شد.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه گردش کار] خرید لپ‌تاپ شخصی برای استفاده خارج از شرکت",
        description=(
            "درخواست خرید لپ‌تاپ شخصی از بودجه واحد فناوری اطلاعات ثبت شده است."
        ),
        age_hours=146,
        views=(ViewSpec(20, "handler"),),
        history=(
            StatusSpec(
                75,
                "handler",
                "in_progress",
                35,
                "درخواست و ضوابط خرید تجهیزات بررسی شد.",
            ),
            StatusSpec(
                210,
                "handler",
                "rejected",
                35,
                "خرید تجهیزات شخصی خارج از ضوابط واحد فناوری اطلاعات است.",
            ),
        ),
    ),
)


MY_TASK_SPECS = (
    DemoSpec(
        subject="[نمونه وظایف] فعال‌سازی دسترسی اتاق جلسات",
        description=(
            "این مورد عمداً در حساب مسئول باز نشده تا کارت جدید با رنگ متفاوت دیده شود."
        ),
        age_hours=3,
        views=(ViewSpec(15, "handler"),),
        referrals=(
            ReferralSpec(
                35,
                "handler",
                "viewer",
                "لطفاً این درخواست را بررسی و نتیجه را ثبت کنید.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه وظایف] نصب نرم‌افزار گزارش‌گیری",
        description=(
            "نرم‌افزار گزارش‌گیری باید روی سیستم واحد برنامه‌ریزی نصب و فعال شود."
        ),
        age_hours=27,
        views=(ViewSpec(15, "handler"), ViewSpec(75, "viewer")),
        referrals=(
            ReferralSpec(
                35,
                "handler",
                "viewer",
                "برای نصب و کنترل مجوز نرم‌افزار ارجاع می‌شود.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه وظایف] بررسی اختلال ایمیل سازمانی",
        description=(
            "ارسال ایمیل به نشانی‌های خارج از سازمان با تأخیر انجام می‌شود."
        ),
        age_hours=51,
        views=(ViewSpec(15, "handler"), ViewSpec(70, "viewer")),
        referrals=(
            ReferralSpec(
                35,
                "handler",
                "viewer",
                "لطفاً صف ارسال و وضعیت سرویس ایمیل را بررسی کنید.",
            ),
        ),
        history=(
            StatusSpec(
                110,
                "viewer",
                "in_progress",
                20,
                "بررسی صف ارسال آغاز شد و نمونه خطاها جمع‌آوری شده است.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه وظایف] ارتقای حافظه سیستم واحد قراردادها",
        description=(
            "سیستم کارشناس قراردادها هنگام کار با اسناد حجیم کند می‌شود."
        ),
        age_hours=75,
        views=(ViewSpec(15, "handler"), ViewSpec(70, "viewer")),
        referrals=(
            ReferralSpec(
                35,
                "handler",
                "viewer",
                "مشخصات سخت‌افزار را بررسی و ارتقا را انجام دهید.",
            ),
        ),
        history=(
            StatusSpec(
                110,
                "viewer",
                "in_progress",
                30,
                "سازگاری قطعه و ظرفیت فعلی سیستم بررسی شد.",
            ),
            StatusSpec(
                280,
                "viewer",
                "in_progress",
                65,
                "حافظه نصب شده و تست پایداری نهایی در حال انجام است.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه وظایف] راه‌اندازی اسکنر دبیرخانه",
        description=(
            "اسکنر جدید دبیرخانه باید نصب، کالیبره و روی سیستم اشتراک‌گذاری شود."
        ),
        age_hours=99,
        views=(ViewSpec(15, "handler"), ViewSpec(70, "viewer")),
        referrals=(
            ReferralSpec(
                35,
                "handler",
                "viewer",
                "نصب و تست کامل دستگاه به شما ارجاع می‌شود.",
            ),
        ),
        history=(
            StatusSpec(
                115,
                "viewer",
                "in_progress",
                55,
                "درایور نصب شد و تنظیمات اشتراک‌گذاری در حال انجام است.",
            ),
            StatusSpec(
                310,
                "viewer",
                "approved",
                100,
                "نصب، کالیبراسیون و اسکن آزمایشی با موفقیت انجام شد.",
            ),
        ),
    ),
    DemoSpec(
        subject="[نمونه وظایف] بازیابی فایل حذف‌شده قدیمی",
        description=(
            "فایلی که خارج از بازه نگهداری نسخه‌های پشتیبان بوده برای بازیابی درخواست شده است."
        ),
        age_hours=123,
        views=(ViewSpec(15, "handler"), ViewSpec(70, "viewer")),
        referrals=(
            ReferralSpec(
                35,
                "handler",
                "viewer",
                "امکان بازیابی از نسخه‌های پشتیبان بررسی شود.",
            ),
        ),
        history=(
            StatusSpec(
                115,
                "viewer",
                "in_progress",
                40,
                "نسخه‌های پشتیبان موجود و آرشیو ماهانه بررسی شدند.",
            ),
            StatusSpec(
                290,
                "viewer",
                "rejected",
                40,
                "نسخه‌ای از فایل در بازه نگهداری پشتیبان موجود نیست.",
            ),
        ),
    ),
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed request lifecycle examples for My Requests and My Tasks."
    )
    parser.add_argument(
        "--viewer-username",
        default=os.getenv("WORKFLOW_DEMO_USERNAME", "ma.shoeib"),
        help="Account used to preview both pages (default: ma.shoeib).",
    )
    parser.add_argument(
        "--handler-username",
        default=os.getenv("WORKFLOW_DEMO_HANDLER_USERNAME", "f.amiri"),
        help="Existing employee who handles the demo form (default: f.amiri).",
    )
    parser.add_argument(
        "--colleague-username",
        default=os.getenv("WORKFLOW_DEMO_COLLEAGUE_USERNAME", "m.nafei"),
        help="Sender/referral colleague used in timelines (default: m.nafei).",
    )
    return parser.parse_args()


def _require_user(db, username: str, role: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise RuntimeError(
            f"The {role} account {username!r} does not exist. "
            "Choose an existing account with the corresponding command-line option."
        )
    if not user.is_active:
        raise RuntimeError(f"The {role} account {username!r} is inactive.")
    if user.is_admin:
        raise RuntimeError(
            f"The {role} account {username!r} is an administrator. "
            "Choose a normal employee account so the portal view is representative."
        )
    return user


def _ensure_handler_duty(db, handler: User) -> bool:
    existing = (
        db.query(FormDutyAssignment)
        .filter(
            FormDutyAssignment.user_id == handler.id,
            FormDutyAssignment.portal_department_id == DEPARTMENT_ID,
            FormDutyAssignment.section_id == SECTION_ID,
            FormDutyAssignment.form_id == FORM_ID,
        )
        .first()
    )
    if existing is not None:
        return False
    db.add(
        FormDutyAssignment(
            user_id=handler.id,
            portal_department_id=DEPARTMENT_ID,
            section_id=SECTION_ID,
            form_id=FORM_ID,
        )
    )
    db.flush()
    return True


def _upsert_demo_submission(
    db,
    *,
    owner: User,
    actors: dict[str, User],
    spec: DemoSpec,
    now: datetime,
) -> tuple[Submission, bool]:
    created_at = now - timedelta(hours=spec.age_hours)
    histories = sorted(spec.history, key=lambda item: item.minutes)
    final_status = histories[-1].status if histories else "submitted"
    final_progress = histories[-1].progress if histories else 0
    final_note = histories[-1].note if histories else ""
    final_actor = actors[histories[-1].actor] if histories else None
    final_updated_at = (
        created_at + timedelta(minutes=histories[-1].minutes)
        if histories
        else None
    )

    submission = (
        db.query(Submission)
        .filter(
            Submission.user_id == owner.id,
            Submission.department_id == DEPARTMENT_ID,
            Submission.section_id == SECTION_ID,
            Submission.form_id == FORM_ID,
            Submission.subject == spec.subject,
        )
        .order_by(Submission.id.asc())
        .first()
    )
    created = submission is None
    if submission is None:
        submission = Submission(
            user_id=owner.id,
            department_id=DEPARTMENT_ID,
            section_id=SECTION_ID,
            form_id=FORM_ID,
        )
        db.add(submission)
        db.flush()
    else:
        # Only exact, namespaced demo records are reset. This keeps reruns
        # deterministic after a tester changes their progress in the UI.
        for model in (
            SubmissionStatusHistory,
            SubmissionReferral,
            SubmissionView,
            SubmissionInitialAssignee,
        ):
            (
                db.query(model)
                .filter(model.submission_id == submission.id)
                .delete(synchronize_session=False)
            )

    submission.subject = spec.subject
    submission.data = json.dumps(
        {"subject": spec.subject, "description": spec.description},
        ensure_ascii=False,
    )
    submission.attachment_path = None
    submission.attachment_name = None
    submission.status = final_status
    submission.progress_percent = final_progress
    submission.status_note = final_note
    submission.status_updated_at = final_updated_at
    submission.status_updated_by_id = final_actor.id if final_actor else None
    submission.created_at = created_at
    db.flush()

    db.add(
        SubmissionInitialAssignee(
            submission_id=submission.id,
            user_id=actors["handler"].id,
            assigned_at=created_at,
        )
    )

    for view in sorted(spec.views, key=lambda item: item.minutes):
        viewed_at = created_at + timedelta(minutes=view.minutes)
        db.add(
            SubmissionView(
                submission_id=submission.id,
                user_id=actors[view.actor].id,
                first_viewed_at=viewed_at,
                last_viewed_at=viewed_at,
            )
        )

    for referral in sorted(spec.referrals, key=lambda item: item.minutes):
        db.add(
            SubmissionReferral(
                submission_id=submission.id,
                from_user_id=actors[referral.actor].id,
                to_user_id=actors[referral.target].id,
                note=referral.note,
                created_at=created_at + timedelta(minutes=referral.minutes),
            )
        )

    previous_status = "submitted"
    previous_progress = 0
    for event in histories:
        db.add(
            SubmissionStatusHistory(
                submission_id=submission.id,
                changed_by_id=actors[event.actor].id,
                from_status=previous_status,
                to_status=event.status,
                from_progress_percent=previous_progress,
                to_progress_percent=event.progress,
                note=event.note,
                created_at=created_at + timedelta(minutes=event.minutes),
            )
        )
        previous_status = event.status
        previous_progress = event.progress

    return submission, created


def _verify_demo(
    db,
    *,
    viewer: User,
    handler: User,
    request_rows: list[Submission],
    task_rows: list[Submission],
) -> tuple[Counter, Counter, int]:
    request_ids = [item.id for item in request_rows]
    referred_request_ids = {
        row.submission_id
        for row in db.query(SubmissionReferral.submission_id)
        .filter(SubmissionReferral.submission_id.in_(request_ids))
        .all()
    }
    viewed_request_ids = {
        row.submission_id
        for row in db.query(SubmissionView.submission_id)
        .filter(SubmissionView.submission_id.in_(request_ids))
        .all()
    }
    request_states = Counter(
        derive_workflow_status(
            item,
            has_referrals=item.id in referred_request_ids,
            has_views=item.id in viewed_request_ids,
        )
        for item in request_rows
    )
    expected_request_states = Counter(
        {
            "unseen": 1,
            "seen": 1,
            "referred": 1,
            "in_progress": 2,
            "completed": 1,
            "rejected": 1,
        }
    )
    if request_states != expected_request_states:
        raise RuntimeError(
            f"Unexpected My Requests demo states: {dict(request_states)}"
        )

    task_states = Counter(item.status for item in task_rows)
    expected_task_states = Counter(
        {"submitted": 2, "in_progress": 2, "approved": 1, "rejected": 1}
    )
    if task_states != expected_task_states:
        raise RuntimeError(f"Unexpected My Tasks demo states: {dict(task_states)}")

    accessible_ids = {
        item.id
        for item in list_task_submissions(db, viewer.id, limit=500)
    }
    task_ids = {item.id for item in task_rows}
    if not task_ids.issubset(accessible_ids):
        raise RuntimeError("One or more demo tasks are not visible to the viewer.")

    viewer_viewed_ids = {
        row.submission_id
        for row in db.query(SubmissionView.submission_id)
        .filter(
            SubmissionView.submission_id.in_(task_ids),
            SubmissionView.user_id == viewer.id,
        )
        .all()
    }
    unread_count = len(task_ids - viewer_viewed_ids)
    if unread_count != 1:
        raise RuntimeError(
            f"Expected exactly one unopened demo task, found {unread_count}."
        )

    all_demo_ids = request_ids + list(task_ids)
    snapshotted_ids = {
        row.submission_id
        for row in db.query(SubmissionInitialAssignee.submission_id)
        .filter(
            SubmissionInitialAssignee.submission_id.in_(all_demo_ids),
            SubmissionInitialAssignee.user_id == handler.id,
        )
        .all()
    }
    if snapshotted_ids != set(all_demo_ids):
        raise RuntimeError(
            "One or more demo submissions are missing their initial recipient."
        )
    return request_states, task_states, unread_count


def seed(
    *,
    viewer_username: str = "ma.shoeib",
    handler_username: str = "f.amiri",
    colleague_username: str = "m.nafei",
    initialize_database: bool = True,
) -> dict[str, object]:
    if initialize_database:
        init_db()

    db = SessionLocal()
    try:
        viewer = _require_user(db, viewer_username, "viewer")
        handler = _require_user(db, handler_username, "handler")
        colleague = _require_user(db, colleague_username, "colleague")
        if len({viewer.id, handler.id, colleague.id}) != 3:
            raise RuntimeError(
                "Viewer, handler, and colleague must be three different accounts."
            )

        duty_created = _ensure_handler_duty(db, handler)
        actors = {
            "viewer": viewer,
            "handler": handler,
            "colleague": colleague,
        }
        now = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
        created_requests = 0
        created_tasks = 0
        request_rows: list[Submission] = []
        task_rows: list[Submission] = []

        for spec in MY_REQUEST_SPECS:
            row, created = _upsert_demo_submission(
                db,
                owner=viewer,
                actors=actors,
                spec=spec,
                now=now,
            )
            request_rows.append(row)
            created_requests += int(created)

        # These requests are submitted by a colleague, first received by the
        # form handler, and then referred to the viewer. Therefore one login can
        # demonstrate both sender and assignee experiences.
        for spec in MY_TASK_SPECS:
            row, created = _upsert_demo_submission(
                db,
                owner=colleague,
                actors=actors,
                spec=spec,
                now=now,
            )
            task_rows.append(row)
            created_tasks += int(created)

        db.flush()
        request_states, task_states, unread_count = _verify_demo(
            db,
            viewer=viewer,
            handler=handler,
            request_rows=request_rows,
            task_rows=task_rows,
        )
        db.commit()
        return {
            "database": os.environ["DATABASE_URL"],
            "viewer": viewer.username,
            "handler": handler.username,
            "colleague": colleague.username,
            "duty_created": duty_created,
            "requests_created": created_requests,
            "requests_refreshed": len(MY_REQUEST_SPECS) - created_requests,
            "tasks_created": created_tasks,
            "tasks_refreshed": len(MY_TASK_SPECS) - created_tasks,
            "request_states": dict(request_states),
            "task_states": dict(task_states),
            "unread_tasks": unread_count,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    args = _parse_args()
    result = seed(
        viewer_username=args.viewer_username,
        handler_username=args.handler_username,
        colleague_username=args.colleague_username,
    )
    print("Request workflow demo data is ready:")
    for key, value in result.items():
        print(f"  {key}: {value}")
    print()
    print(
        f"Log in as {result['viewer']} and open «درخواست‌های من» and «وظایف من»."
    )


if __name__ == "__main__":
    main()
