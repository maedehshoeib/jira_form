from typing import Any

from pydantic import BaseModel


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
