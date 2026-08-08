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
    attachment_names: list[str] = Field(default_factory=list)
    report_id: int | None
    created_at: str
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    status_note: str = ""
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
    attachment_names: list[str] = Field(default_factory=list)
    report_id: int | None
    created_at: str
    data: dict[str, Any]
    status_updated_by: str | None = None
    status_updated_at: str | None = None
    status_note: str = ""
    referrals: list[SubmissionReferralItem] = Field(default_factory=list)
    can_act: bool = False


class TaskStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "submitted"]
    note: str = Field(default="", max_length=512)


class TaskReferRequest(BaseModel):
    to_user_id: int | None = None
    to_user_ids: list[int] = Field(default_factory=list)
    note: str = Field(default="", max_length=512)

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
