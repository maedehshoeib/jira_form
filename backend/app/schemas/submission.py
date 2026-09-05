from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class SubmissionReferralItem(BaseModel):
    id: int
    from_user_id: int
    from_user_name: str
    to_user_id: int
    to_user_name: str
    note: str = ""
    attachment_name: str | None = None
    attachment_names: list[str] = Field(default_factory=list)
    created_at: str


class SubmissionCcRecipientItem(BaseModel):
    user_id: int
    username: str
    display_name: str
    mentioned_by_id: int
    mentioned_by_name: str
    created_at: str


class SubmissionAssigneeItem(BaseModel):
    user_id: int
    username: str
    display_name: str
    assigned_at: str


class SubmissionTimelineItem(BaseModel):
    id: str
    event_type: Literal["submitted", "viewed", "referred", "status_changed"]
    created_at: str
    actor_id: int | None = None
    actor_name: str | None = None
    from_status: str | None = None
    to_status: str | None = None
    from_progress_percent: int | None = None
    to_progress_percent: int | None = None
    progress_percent: int | None = None
    to_user_id: int | None = None
    to_user_name: str | None = None
    note: str = ""
    attachment_name: str | None = None
    attachment_names: list[str] = Field(default_factory=list)


class SubmissionListItem(BaseModel):
    id: int
    form_id: str
    form_title: str
    department_id: str
    department_title: str
    section_id: str
    section_title: str
    subject: str
    status: str
    workflow_status: str
    progress_percent: int = 0
    is_read: bool = False
    first_viewed_at: str | None = None
    last_viewed_at: str | None = None
    submitted_by: str
    submitted_by_username: str
    attachment_name: str | None
    attachment_names: list[str] = Field(default_factory=list)
    report_id: int | None
    created_at: str
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    status_note: str = ""
    status_attachment_name: str | None = None
    jira_issue_key: str = ""
    jira_status: str = ""
    initial_assignees: list[SubmissionAssigneeItem] = Field(default_factory=list)
    referrals: list[SubmissionReferralItem] = Field(default_factory=list)
    cc_recipients: list[SubmissionCcRecipientItem] = Field(default_factory=list)
    can_act: bool = False


class SubmissionResponse(BaseModel):
    id: int
    form_id: str
    form_title: str
    department_id: str
    department_title: str
    section_id: str
    section_title: str
    subject: str
    status: str
    workflow_status: str
    progress_percent: int = 0
    is_read: bool = False
    first_viewed_at: str | None = None
    last_viewed_at: str | None = None
    submitted_by: str
    submitted_by_username: str
    attachment_name: str | None
    attachment_names: list[str] = Field(default_factory=list)
    report_id: int | None
    created_at: str
    data: dict[str, Any]
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    status_note: str = ""
    status_attachment_name: str | None = None
    jira_issue_key: str = ""
    jira_status: str = ""
    initial_assignees: list[SubmissionAssigneeItem] = Field(default_factory=list)
    referrals: list[SubmissionReferralItem] = Field(default_factory=list)
    cc_recipients: list[SubmissionCcRecipientItem] = Field(default_factory=list)
    timeline: list[SubmissionTimelineItem] = Field(default_factory=list)
    can_act: bool = False


class JiraStatusUpdate(BaseModel):
    jira_issue_key: str = Field(min_length=1, max_length=64)
    jira_status: str = Field(min_length=1, max_length=256)


class JiraStatusResponse(BaseModel):
    submission_id: int
    jira_issue_key: str
    jira_status: str
    updated: bool = True


class TaskStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "submitted", "in_progress"]
    progress_percent: int | None = Field(default=None, ge=0, le=100)
    note: str = Field(default="", max_length=512)


class TaskReferRequest(BaseModel):
    to_user_id: int | None = None
    to_user_ids: list[int] = Field(default_factory=list)
    cc_user_ids: list[int] = Field(default_factory=list)
    note: str = Field(default="", max_length=512)
    allow_repeat: bool = False

    def resolved_user_ids(self) -> list[int]:
        ids: list[int] = []
        for user_id in [*self.to_user_ids, self.to_user_id]:
            if user_id is None:
                continue
            if user_id not in ids:
                ids.append(user_id)
        return ids


class TaskColleague(BaseModel):
    id: int
    username: str
    display_name: str
    department: str
    job_title: str
    birth_date: date | None = None
    is_birthday: bool = False


class TaskPendingNotification(BaseModel):
    count: int
    ids: list[int] = Field(default_factory=list)


class TaskCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    mention_user_ids: list[int] = Field(default_factory=list)


class TaskReminderCreate(BaseModel):
    message: str = Field(default="", max_length=512)


class TaskConversationUser(BaseModel):
    id: int
    username: str
    display_name: str


class TaskCommentItem(BaseModel):
    id: int
    author_id: int
    author_name: str
    body: str
    mentions: list[TaskConversationUser] = Field(default_factory=list)
    created_at: str


class TaskReminderItem(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    recipient_id: int
    recipient_name: str
    message: str
    created_at: str


class TaskConversationResponse(BaseModel):
    participants: list[TaskConversationUser] = Field(default_factory=list)
    comments: list[TaskCommentItem] = Field(default_factory=list)
    reminders: list[TaskReminderItem] = Field(default_factory=list)

