from pydantic import BaseModel
from typing import Any


class ReportCreate(BaseModel):
    title: str
    report_type: str = "performance"
    department: str = ""
    status: str = "ثبت شده"
    data: dict[str, Any] = {}


class ReportUpdate(BaseModel):
    title: str | None = None
    department: str | None = None
    status: str | None = None
    data: dict[str, Any] | None = None


class ReportResponse(BaseModel):
    id: int
    title: str
    report_type: str
    department: str
    status: str
    data: dict[str, Any]
    created_by: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ReportListItem(BaseModel):
    id: int
    title: str
    report_type: str
    department: str
    status: str
    created_by: str
    created_at: str
    updated_at: str
