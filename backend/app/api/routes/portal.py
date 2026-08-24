import json
import uuid
from pathlib import Path

from fastapi import (  # noqa: F401 — File/Form reserved for multipart signatures
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.routes.reports_helpers import _format_dt, _verify_api_key
from app.api.routes.submissions_helpers import (
    _submission_to_list_item,
    _submission_to_response,
    build_submission_workflow_context,
    require_api_key_or_user,
)
from app.core.birthday import is_birthday_today
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.timezone import utc_now
from app.db.session import get_db
from app.models.submission import (
    Submission,
    SubmissionComment,
    SubmissionCommentMention,
    SubmissionReferral,
    SubmissionReminder,
    SubmissionStatusHistory,
)
from app.models.pdf_form import PdfForm
from app.models.site_banner import SiteBanner, SiteBannerImage
from app.models.site_news import SiteNews
from app.models.user import User
from app.schemas.admin import SiteBannerResponse, SiteNewsResponse
from app.schemas.submission import (
    JiraStatusResponse,
    JiraStatusUpdate,
    SubmissionListItem,
    SubmissionResponse,
    TaskCommentCreate,
    TaskCommentItem,
    TaskColleague,
    TaskConversationResponse,
    TaskConversationUser,
    TaskPendingNotification,
    TaskReferRequest,
    TaskReminderCreate,
    TaskReminderItem,
    TaskStatusUpdate,
)
from app.schemas.pdf_form import PdfFormResponse
from app.schemas.user_dashboard import UserDashboardResponse
from app.services.pdf_form_service import normalize_pdf_category
from app.services.form_access_service import (
    RESTRICTED_PORTAL_DEPARTMENTS,
    allowed_target_keys,
    can_access_target,
)
from app.services.form_duty_service import (
    snapshot_submission_initial_assignees,
    user_handles_target,
)
from app.services.portal_service import (
    DEPARTMENTS,
    FORM_TEMPLATES,
    MANAGEMENT_LETTER_FORM_ID,
    MANAGEMENT_WORKFLOW_ID,
    MEETING_ROOM_FORM_ID,
)
from app.services.meeting_room_workflow_service import (
    initialize_meeting_room_workflow,
    prepare_meeting_room_data,
)
from app.services.task_workflow_service import (
    add_task_comment,
    list_colleagues,
    list_pending_task_ids,
    list_task_submissions,
    list_unseen_task_ids,
    mark_task_viewed,
    refer_tasks,
    set_task_status,
    send_task_reminders,
    task_participant_ids,
    user_can_access_task,
    user_can_view_task,
    user_can_join_conversation,
)
from app.services.report_submission_service import (
    create_report_from_submission,
    is_performance_report_submission,
)
from app.services.user_dashboard_builder import build_user_dashboard


router = APIRouter()
MAX_TASK_ACTION_ATTACHMENT_SIZE = 15 * 1024 * 1024
MAX_SUBMISSION_ATTACHMENT_SIZE = 15 * 1024 * 1024


@router.get("/user-dashboard", response_model=UserDashboardResponse)
def user_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_user_dashboard(db, current_user)


async def _save_task_action_attachment(
    upload: UploadFile,
) -> tuple[str, str]:
    safe_name = Path(upload.filename or "attachment").name[:256]
    content = await upload.read(MAX_TASK_ACTION_ATTACHMENT_SIZE + 1)
    if len(content) > MAX_TASK_ACTION_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=413,
            detail="حداکثر حجم فایل ۱۵ مگابایت است",
        )
    extension = Path(safe_name).suffix.lower()[:16]
    upload_dir = (Path(settings.UPLOAD_DIR) / "task-actions").resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = upload_dir / f"{uuid.uuid4().hex}{extension}"
    target.write_bytes(content)
    return str(target), safe_name


async def _save_submission_attachment(
    upload: UploadFile,
    upload_dir: Path,
) -> tuple[str, str]:
    """Persist one submission attachment with a bounded memory read."""
    safe_name = Path(upload.filename or "attachment").name[:256]
    content = await upload.read(MAX_SUBMISSION_ATTACHMENT_SIZE + 1)
    if len(content) > MAX_SUBMISSION_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=413,
            detail="حداکثر حجم فایل پیوست ۱۵ مگابایت است.",
        )
    extension = Path(safe_name).suffix.lower()[:16]
    target = upload_dir / f"{uuid.uuid4().hex}{extension}"
    target.write_bytes(content)
    return str(target), safe_name


def _user_can_view_submission(
    db: Session,
    user: User,
    submission: Submission,
) -> bool:
    if user.is_admin or submission.user_id == user.id:
        return True
    return user_can_view_task(db, user, submission)


def _serve_task_action_file(
    file_path: str | None,
    file_name: str | None,
) -> FileResponse:
    if not file_path or not file_name:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    path = Path(file_path).resolve()
    allowed_root = (Path(settings.UPLOAD_DIR) / "task-actions").resolve()
    if allowed_root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="فایل پیوست موجود نیست")
    return FileResponse(
        path=path,
        filename=file_name,
        media_type="application/octet-stream",
    )


def _get_viewable_submission(
    db: Session,
    current_user: User,
    submission_id: int,
) -> Submission:
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission or not _user_can_view_submission(db, current_user, submission):
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")
    return submission


def _latest_status_attachment(
    db: Session,
    submission: Submission,
) -> SubmissionStatusHistory:
    if submission.status not in {"approved", "rejected"}:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    history = (
        db.query(SubmissionStatusHistory)
        .filter(
            SubmissionStatusHistory.submission_id == submission.id,
            SubmissionStatusHistory.to_status == submission.status,
            SubmissionStatusHistory.attachment_path.isnot(None),
        )
        .order_by(
            SubmissionStatusHistory.created_at.desc(),
            SubmissionStatusHistory.id.desc(),
        )
        .first()
    )
    if not history or not history.attachment_path:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    return history


def _parse_form_user_ids(
    form,
    field_name: str = "to_user_ids",
    single_field_name: str | None = "to_user_id",
) -> list[int]:
    ids: list[int] = []
    raw_values = form.getlist(field_name) if hasattr(form, "getlist") else []
    if not raw_values:
        single = form.get(field_name)
        if single is not None:
            raw_values = [single]
    for raw in raw_values:
        text = str(raw or "").strip()
        if not text:
            continue
        if text.startswith("["):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=422,
                    detail="شناسه کاربران ارجاع نامعتبر است.",
                ) from exc
            if not isinstance(parsed, list):
                raise HTTPException(
                    status_code=422,
                    detail="شناسه کاربران ارجاع نامعتبر است.",
                )
            for item in parsed:
                try:
                    user_id = int(item)
                except (TypeError, ValueError) as exc:
                    raise HTTPException(
                        status_code=422,
                        detail="شناسه کاربران ارجاع نامعتبر است.",
                    ) from exc
                if user_id not in ids:
                    ids.append(user_id)
            continue
        try:
            user_id = int(text)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=422,
                detail="شناسه کاربران ارجاع نامعتبر است.",
            ) from exc
        if user_id not in ids:
            ids.append(user_id)
    single_id = form.get(single_field_name) if single_field_name else None
    if single_id not in (None, ""):
        try:
            user_id = int(str(single_id))
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=422,
                detail="شناسه کاربران ارجاع نامعتبر است.",
            ) from exc
        if user_id not in ids:
            ids.append(user_id)
    return ids


def _task_response(
    db: Session,
    current_user: User,
    submission: Submission,
    *,
    can_act: bool,
) -> SubmissionResponse:
    workflow_context = build_submission_workflow_context(
        db,
        [submission],
        viewer_user_id=current_user.id,
        include_history=True,
    )
    user = workflow_context.users_by_id.get(submission.user_id)
    return _submission_to_response(
        submission,
        user,
        db=db,
        workflow_context=workflow_context,
        can_act=can_act,
    )


def _conversation_response(
    db: Session, submission: Submission
) -> TaskConversationResponse:
    participant_ids = task_participant_ids(db, submission)
    comments = (
        db.query(SubmissionComment)
        .filter(SubmissionComment.submission_id == submission.id)
        .order_by(SubmissionComment.created_at.asc(), SubmissionComment.id.asc())
        .all()
    )
    reminders = (
        db.query(SubmissionReminder)
        .filter(
            SubmissionReminder.submission_id == submission.id,
            SubmissionReminder.created_at <= utc_now(),
        )
        .order_by(SubmissionReminder.created_at.asc(), SubmissionReminder.id.asc())
        .all()
    )
    comment_ids = [comment.id for comment in comments]
    mention_rows = (
        db.query(SubmissionCommentMention)
        .filter(SubmissionCommentMention.comment_id.in_(comment_ids))
        .all()
        if comment_ids
        else []
    )
    user_ids = set(participant_ids)
    user_ids.update(comment.author_id for comment in comments)
    for reminder in reminders:
        user_ids.update((reminder.sender_id, reminder.recipient_id))
    user_ids.update(row.user_id for row in mention_rows)
    users = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(user_ids)).all()
    }

    def user_item(user_id: int) -> TaskConversationUser:
        user = users.get(user_id)
        return TaskConversationUser(
            id=user_id,
            username=user.username if user else "",
            display_name=(user.display_name or user.username) if user else "Unknown user",
        )

    mentions_by_comment: dict[int, list[int]] = {}
    for row in mention_rows:
        mentions_by_comment.setdefault(row.comment_id, []).append(row.user_id)
    return TaskConversationResponse(
        participants=[user_item(user_id) for user_id in sorted(participant_ids)],
        comments=[
            TaskCommentItem(
                id=comment.id,
                author_id=comment.author_id,
                author_name=user_item(comment.author_id).display_name,
                body=comment.body,
                mentions=[
                    user_item(user_id)
                    for user_id in mentions_by_comment.get(comment.id, [])
                ],
                created_at=_format_dt(comment.created_at),
            )
            for comment in comments
        ],
        reminders=[
            TaskReminderItem(
                id=reminder.id,
                sender_id=reminder.sender_id,
                sender_name=user_item(reminder.sender_id).display_name,
                recipient_id=reminder.recipient_id,
                recipient_name=user_item(reminder.recipient_id).display_name,
                message=reminder.message or "",
                created_at=_format_dt(reminder.created_at),
            )
            for reminder in reminders
        ],
    )
@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/pdf-forms", response_model=list[PdfFormResponse])
def list_pdf_forms(
    category: str = Query(default="forms"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    normalized = normalize_pdf_category(category)
    return (
        db.query(PdfForm)
        .filter(PdfForm.category == normalized)
        .order_by(PdfForm.created_at.desc(), PdfForm.id.desc())
        .all()
    )


@router.get("/pdf-forms/{form_id}/file")
def get_pdf_form_file(
    form_id: int,
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(PdfForm).filter(PdfForm.id == form_id)
    if category is not None:
        query = query.filter(PdfForm.category == normalize_pdf_category(category))
    item = query.first()
    if not item:
        raise HTTPException(status_code=404, detail="فایل PDF یافت نشد.")
    file_path = Path(item.file_path)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="فایل PDF یافت نشد.")
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=item.file_name,
    )


@router.get("/banner", response_model=SiteBannerResponse)
def get_home_banner(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    banner = db.query(SiteBanner).filter(SiteBanner.id == 1).first()
    if not banner:
        return SiteBannerResponse(is_active=False)
    images = (
        db.query(SiteBannerImage)
        .filter(SiteBannerImage.banner_id == banner.id)
        .order_by(SiteBannerImage.sort_order, SiteBannerImage.id)
        .all()
    )
    first_image = images[0] if images else None
    return SiteBannerResponse(
        is_active=banner.is_active,
        images=[
            {
                "id": image.id,
                "image_url": f"/api/v1/banner/images/{image.id}",
                "image_name": image.image_name,
            }
            for image in images
        ],
        interval_seconds=banner.interval_seconds,
        image_url=(
            f"/api/v1/banner/images/{first_image.id}" if first_image else None
        ),
        image_name=first_image.image_name if first_image else "",
        updated_at=banner.updated_at,
    )


@router.get("/banner/image")
def get_home_banner_image(
    db: Session = Depends(get_db),
):
    image = (
        db.query(SiteBannerImage)
        .filter(SiteBannerImage.banner_id == 1)
        .order_by(SiteBannerImage.sort_order, SiteBannerImage.id)
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    image_path = Path(image.image_path)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    return FileResponse(image_path)


@router.get("/banner/images/{image_id}")
def get_home_banner_image_by_id(
    image_id: int,
    db: Session = Depends(get_db),
):
    image = (
        db.query(SiteBannerImage)
        .filter(
            SiteBannerImage.id == image_id,
            SiteBannerImage.banner_id == 1,
        )
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    image_path = Path(image.image_path)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="تصویر بنر یافت نشد.")
    return FileResponse(image_path)


@router.get("/news", response_model=list[SiteNewsResponse])
def list_home_news(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = db.query(SiteNews).order_by(SiteNews.created_at.desc(), SiteNews.id.desc()).all()
    return [
        SiteNewsResponse(
            id=item.id,
            title=item.title,
            body=item.body,
            image_url=f"/api/v1/news/images/{item.id}" if item.image_path else None,
            image_name=item.image_name,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.get("/news/images/{news_id}")
def get_news_image(
    news_id: int,
    db: Session = Depends(get_db),
):
    item = db.query(SiteNews).filter(SiteNews.id == news_id).first()
    if not item or not item.image_path:
        raise HTTPException(status_code=404, detail="تصویر خبر یافت نشد.")
    image_path = Path(item.image_path)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="تصویر خبر یافت نشد.")
    return FileResponse(image_path)


@router.get("/departments")
def get_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = allowed_target_keys(db, current_user)
    if allowed is None:
        if current_user.is_admin:
            return DEPARTMENTS
        return [
            department
            for department in DEPARTMENTS
            if department.id not in RESTRICTED_PORTAL_DEPARTMENTS
        ]
    result = []
    for department in DEPARTMENTS:
        if department.sections:
            sections = [
                section
                for section in department.sections
                if f"{department.id}:{section.id}:{section.form_id}" in allowed
            ]
            if sections:
                result.append(department.model_copy(update={"sections": sections}))
        elif f"{department.id}::{department.id}" in allowed:
            result.append(department)
    return result


@router.get("/departments/{department_id}")
def get_department(
    department_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible = get_departments(db, current_user)
    for dep in visible:
        if dep.id == department_id:
            return dep
    raise HTTPException(status_code=404, detail="Department not found")


@router.get("/forms/{form_id}")
def get_form(
    form_id: str,
    department: str = Query(default=""),
    section: str = Query(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = FORM_TEMPLATES.get(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    portal_department_id = department or form.department_id
    section_id = section or form.section_id
    if form_id == MANAGEMENT_LETTER_FORM_ID:
        portal_department_id = MANAGEMENT_WORKFLOW_ID
    handles = user_handles_target(
        db, current_user.id, portal_department_id, section_id, form_id
    )
    referred = (
        db.query(SubmissionReferral.id)
        .join(Submission, Submission.id == SubmissionReferral.submission_id)
        .filter(
            SubmissionReferral.to_user_id == current_user.id,
            Submission.department_id == portal_department_id,
            Submission.section_id == section_id,
            Submission.form_id == form_id,
        )
        .first()
        is not None
    )
    if not can_access_target(
        db, current_user, portal_department_id, section_id, form_id
    ) and not handles and not referred:
        raise HTTPException(status_code=403, detail="شما به این فرم دسترسی ندارید.")
    return form


@router.post("/submissions")
async def create_submission(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = await request.form()
    form_id = str(form.get("form_id", "common-form"))
    department_id = str(form.get("department_id", ""))
    section_id = str(form.get("section_id", ""))
    if form_id == MANAGEMENT_LETTER_FORM_ID:
        raise HTTPException(
            status_code=400,
            detail="برای ارسال نامه از بخش نامه‌های سازمانی استفاده کنید.",
        )
    if form_id not in FORM_TEMPLATES or not can_access_target(
        db, current_user, department_id, section_id, form_id
    ):
        raise HTTPException(status_code=403, detail="شما به این فرم دسترسی ندارید.")
    form_data: dict = {}
    attachment_path = None
    attachment_name = None

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    for key, value in form.items():
        if key in {"form_id", "department_id", "section_id"}:
            continue
        if getattr(value, "filename", None):
            attachment_path, attachment_name = await _save_submission_attachment(
                value, upload_dir
            )
            form_data[key] = attachment_name
            continue
        form_data[key] = str(value)

    meeting_room_approvers = []
    if form_id == MEETING_ROOM_FORM_ID:
        try:
            form_data, meeting_room_approvers = prepare_meeting_room_data(
                db, form_data
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    subject = form_data.get("subject", "")

    submission = Submission(
        form_id=form_id,
        department_id=department_id,
        section_id=section_id,
        user_id=current_user.id,
        subject=subject,
        data=json.dumps(form_data, ensure_ascii=False),
        attachment_path=attachment_path,
        attachment_name=attachment_name,
    )
    db.add(submission)
    db.flush()
    if form_id == MEETING_ROOM_FORM_ID:
        initialize_meeting_room_workflow(
            db,
            submission,
            current_user,
            meeting_room_approvers,
        )
    else:
        snapshot_submission_initial_assignees(db, submission)
    db.commit()
    db.refresh(submission)

    report_id = None
    if is_performance_report_submission(form_id, department_id, section_id):
        report = create_report_from_submission(
            db, form_data, current_user, department_id
        )
        report_id = report.id
        form_data["_report_id"] = report_id

    submission.data = json.dumps(form_data, ensure_ascii=False)
    db.commit()
    db.refresh(submission)

    response = {
        "message": "submitted",
        "id": submission.id,
        "subject": subject,
        "file": attachment_name,
    }
    if report_id is not None:
        response["report_id"] = report_id
    return response


@router.get("/submissions", response_model=list[SubmissionListItem])
def list_submissions(
    form_id: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    section_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    auth: User | None = Depends(require_api_key_or_user),
):
    query = db.query(Submission).order_by(Submission.created_at.desc())

    # API-key callers are administrative integrations and may list everything.
    # A signed-in employee must only ever receive their own submissions.
    if auth is not None and not auth.is_admin:
        query = query.filter(Submission.user_id == auth.id)

    if form_id:
        query = query.filter(Submission.form_id == form_id)
    if department_id:
        query = query.filter(Submission.department_id == department_id)
    if section_id:
        query = query.filter(Submission.section_id == section_id)

    submissions = query.offset(offset).limit(limit).all()
    workflow_context = build_submission_workflow_context(
        db,
        submissions,
        viewer_user_id=auth.id if auth is not None else None,
    )
    result = []
    for submission in submissions:
        user = workflow_context.users_by_id.get(submission.user_id)
        result.append(
            _submission_to_list_item(
                submission,
                user,
                db=db,
                workflow_context=workflow_context,
            )
        )
    return result


@router.put(
    "/submissions/{submission_id}/jira-status",
    response_model=JiraStatusResponse,
)
def update_submission_jira_status(
    submission_id: int,
    payload: JiraStatusUpdate,
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: Session = Depends(get_db),
):
    if not _verify_api_key(x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.jira_issue_key = payload.jira_issue_key.strip()
    submission.jira_status = payload.jira_status.strip()
    db.commit()
    db.refresh(submission)
    return JiraStatusResponse(
        submission_id=submission.id,
        jira_issue_key=submission.jira_issue_key or "",
        jira_status=submission.jira_status or "",
    )


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    auth: User | None = Depends(require_api_key_or_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")
    if auth is not None and not auth.is_admin and submission.user_id != auth.id:
        # Return 404 so request identifiers belonging to other employees are not exposed.
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")

    workflow_context = build_submission_workflow_context(
        db,
        [submission],
        viewer_user_id=auth.id if auth is not None else None,
        include_history=True,
    )
    user = workflow_context.users_by_id.get(submission.user_id)
    return _submission_to_response(
        submission,
        user,
        db=db,
        workflow_context=workflow_context,
    )


@router.get(
    "/submissions/{submission_id}/conversation",
    response_model=TaskConversationResponse,
)
def get_task_conversation(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission or not user_can_join_conversation(db, current_user, submission):
        raise HTTPException(status_code=404, detail="Request not found")
    return _conversation_response(db, submission)


@router.post(
    "/submissions/{submission_id}/comments",
    response_model=TaskConversationResponse,
)
def create_task_comment(
    submission_id: int,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Request not found")
    try:
        add_task_comment(
            db,
            current_user,
            submission,
            payload.body,
            payload.mention_user_ids,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _conversation_response(db, submission)


@router.post(
    "/submissions/{submission_id}/reminders",
    response_model=TaskConversationResponse,
)
def create_task_reminder(
    submission_id: int,
    payload: TaskReminderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Request not found")
    try:
        send_task_reminders(db, current_user, submission, payload.message)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _conversation_response(db, submission)


def _serve_submission_attachment(
    submission: Submission, index: int = 0
) -> FileResponse:
    from app.services.management_letter_service import resolve_submission_attachment

    try:
        file_path, filename = resolve_submission_attachment(submission, index)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="فایل پیوست موجود نیست")
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
    )


@router.get("/submissions/{submission_id}/attachment")
def download_submission_attachment(
    submission_id: int,
    index: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")
    if (
        not current_user.is_admin
        and submission.user_id != current_user.id
        and not user_can_access_task(db, current_user, submission)
    ):
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")
    return _serve_submission_attachment(submission, index)


@router.get("/tasks/colleagues", response_model=list[TaskColleague])
def get_task_colleagues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return [
        TaskColleague(
            id=user.id,
            username=user.username,
            display_name=user.display_name or user.username,
            department=user.department or "",
            job_title=user.job_title or "",
            birth_date=user.birth_date,
            is_birthday=is_birthday_today(user.birth_date),
        )
        for user in list_colleagues(db, current_user.id)
    ]


@router.get("/tasks/pending-count", response_model=TaskPendingNotification)
def get_pending_task_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = list_pending_task_ids(db, current_user.id)
    return TaskPendingNotification(count=len(ids), ids=ids)


@router.get("/tasks/unseen-count", response_model=TaskPendingNotification)
def get_unseen_task_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ids = list_unseen_task_ids(db, current_user.id)
    return TaskPendingNotification(count=len(ids), ids=ids)


@router.get("/tasks", response_model=list[SubmissionListItem])
def list_tasks(
    form_id: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    section_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submissions routed via form duties or personal referrals."""
    submissions = list_task_submissions(
        db,
        current_user.id,
        form_id=form_id,
        department_id=department_id,
        section_id=section_id,
        limit=limit,
        offset=offset,
    )
    workflow_context = build_submission_workflow_context(
        db,
        submissions,
        viewer_user_id=current_user.id,
    )
    result = []
    for submission in submissions:
        user = workflow_context.users_by_id.get(submission.user_id)
        result.append(
            _submission_to_list_item(
                submission,
                user,
                db=db,
                workflow_context=workflow_context,
                can_act=user_can_access_task(db, current_user, submission),
            )
        )
    return result


@router.get("/tasks/{submission_id}", response_model=SubmissionResponse)
def get_task(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission or not user_can_view_task(db, current_user, submission):
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")

    mark_task_viewed(db, current_user, submission)
    workflow_context = build_submission_workflow_context(
        db,
        [submission],
        viewer_user_id=current_user.id,
        include_history=True,
    )
    user = workflow_context.users_by_id.get(submission.user_id)
    return _submission_to_response(
        submission,
        user,
        db=db,
        workflow_context=workflow_context,
        can_act=user_can_access_task(db, current_user, submission),
    )


@router.get("/tasks/{submission_id}/attachment")
def download_task_attachment(
    submission_id: int,
    index: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission or not user_can_view_task(db, current_user, submission):
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    return _serve_submission_attachment(submission, index)


@router.patch("/tasks/{submission_id}/status", response_model=SubmissionResponse)
async def update_task_status(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = (request.headers.get("content-type") or "").lower()
    attachment_path: str | None = None
    attachment_name: str | None = None
    if "multipart/form-data" in content_type:
        form = await request.form()
        status = str(form.get("status") or "").strip()
        note = str(form.get("note") or "")
        progress_raw = form.get("progress_percent")
        progress_percent: int | None = None
        if progress_raw not in (None, ""):
            try:
                progress_percent = int(str(progress_raw))
            except (TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=422,
                    detail="درصد پیشرفت نامعتبر است.",
                ) from exc
        upload = form.get("attachment")
        if (
            upload is not None
            and hasattr(upload, "filename")
            and upload.filename
        ):
            attachment_path, attachment_name = await _save_task_action_attachment(
                upload
            )
    else:
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail="بدنه درخواست نامعتبر است.",
            ) from exc
        try:
            body = TaskStatusUpdate.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(
                status_code=422,
                detail="اطلاعات وضعیت نامعتبر است.",
            ) from exc
        status = body.status
        note = body.note
        progress_percent = body.progress_percent

    try:
        submission = set_task_status(
            db,
            current_user,
            submission_id,
            status,
            note,
            progress_percent,
            attachment_path=attachment_path,
            attachment_name=attachment_name,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return _task_response(db, current_user, submission, can_act=True)


@router.post("/tasks/{submission_id}/refer", response_model=SubmissionResponse)
async def refer_task_endpoint(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_type = (request.headers.get("content-type") or "").lower()
    attachment_path: str | None = None
    attachment_name: str | None = None
    if "multipart/form-data" in content_type:
        form = await request.form()
        to_user_ids = _parse_form_user_ids(form)
        cc_user_ids = _parse_form_user_ids(
            form, "cc_user_ids", single_field_name=None
        )
        note = str(form.get("note") or "")
        allow_repeat_raw = str(form.get("allow_repeat") or "false").strip().lower()
        allow_repeat = allow_repeat_raw in {"1", "true", "yes", "on"}
        upload = form.get("attachment")
        if (
            upload is not None
            and hasattr(upload, "filename")
            and upload.filename
        ):
            attachment_path, attachment_name = await _save_task_action_attachment(
                upload
            )
    else:
        try:
            payload = await request.json()
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail="بدنه درخواست نامعتبر است.",
            ) from exc
        body = TaskReferRequest.model_validate(payload)
        to_user_ids = body.resolved_user_ids()
        cc_user_ids = body.cc_user_ids
        note = body.note
        allow_repeat = body.allow_repeat

    try:
        refer_tasks(
            db,
            current_user,
            submission_id,
            to_user_ids,
            note,
            allow_repeat=allow_repeat,
            attachment_path=attachment_path,
            attachment_name=attachment_name,
            cc_user_ids=cc_user_ids,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="درخواست یافت نشد")
    return _task_response(
        db,
        current_user,
        submission,
        can_act=user_can_access_task(db, current_user, submission),
    )


@router.get("/tasks/{submission_id}/status-attachment")
def download_task_status_attachment(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _get_viewable_submission(db, current_user, submission_id)
    history = _latest_status_attachment(db, submission)
    return _serve_task_action_file(history.attachment_path, history.attachment_name)


@router.get("/submissions/{submission_id}/status-attachment")
def download_submission_status_attachment(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _get_viewable_submission(db, current_user, submission_id)
    history = _latest_status_attachment(db, submission)
    return _serve_task_action_file(history.attachment_path, history.attachment_name)


@router.get("/tasks/{submission_id}/status-history/{history_id}/attachment")
def download_task_status_history_attachment(
    submission_id: int,
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _get_viewable_submission(db, current_user, submission_id)
    history = (
        db.query(SubmissionStatusHistory)
        .filter(
            SubmissionStatusHistory.id == history_id,
            SubmissionStatusHistory.submission_id == submission.id,
        )
        .first()
    )
    if not history:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    return _serve_task_action_file(history.attachment_path, history.attachment_name)


@router.get("/submissions/{submission_id}/status-history/{history_id}/attachment")
def download_submission_status_history_attachment(
    submission_id: int,
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _get_viewable_submission(db, current_user, submission_id)
    history = (
        db.query(SubmissionStatusHistory)
        .filter(
            SubmissionStatusHistory.id == history_id,
            SubmissionStatusHistory.submission_id == submission.id,
        )
        .first()
    )
    if not history:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    return _serve_task_action_file(history.attachment_path, history.attachment_name)


@router.get("/tasks/{submission_id}/referrals/{referral_id}/attachment")
def download_task_referral_attachment(
    submission_id: int,
    referral_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _get_viewable_submission(db, current_user, submission_id)
    referral = (
        db.query(SubmissionReferral)
        .filter(
            SubmissionReferral.id == referral_id,
            SubmissionReferral.submission_id == submission.id,
        )
        .first()
    )
    if not referral:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    return _serve_task_action_file(referral.attachment_path, referral.attachment_name)


@router.get("/submissions/{submission_id}/referrals/{referral_id}/attachment")
def download_submission_referral_attachment(
    submission_id: int,
    referral_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = _get_viewable_submission(db, current_user, submission_id)
    referral = (
        db.query(SubmissionReferral)
        .filter(
            SubmissionReferral.id == referral_id,
            SubmissionReferral.submission_id == submission.id,
        )
        .first()
    )
    if not referral:
        raise HTTPException(status_code=404, detail="پیوست یافت نشد")
    return _serve_task_action_file(referral.attachment_path, referral.attachment_name)
