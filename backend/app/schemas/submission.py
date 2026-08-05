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
    created_at: str


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
    submitted_by: str
    submitted_by_username: str
    attachment_name: str | None
    report_id: int | None
    created_at: str
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    referrals: list[SubmissionReferralItem] = Field(default_factory=list)
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
    submitted_by: str
    submitted_by_username: str
    attachment_name: str | None
    report_id: int | None
    created_at: str
    data: dict[str, Any]
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    referrals: list[SubmissionReferralItem] = Field(default_factory=list)
    can_act: bool = False


class TaskStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "submitted"]


class TaskReferRequest(BaseModel):
    to_user_id: int
    note: str = Field(default="", max_length=512)


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
