from pydantic import BaseModel, Field


class UserDashboardChartItem(BaseModel):
    label: str
    value: int


class UserDashboardSummary(BaseModel):
    total_tasks: int = 0
    open_tasks: int = 0
    completed_tasks: int = 0
    total_requests: int = 0
    open_requests: int = 0
    completed_requests: int = 0
    sent_letters: int = 0
    received_letters: int = 0


class UserDashboardLetters(BaseModel):
    sent_by_type: list[UserDashboardChartItem] = Field(default_factory=list)
    received_by_type: list[UserDashboardChartItem] = Field(default_factory=list)
    sent_by_status: list[UserDashboardChartItem] = Field(default_factory=list)
    received_by_status: list[UserDashboardChartItem] = Field(default_factory=list)


class UserDashboardResponse(BaseModel):
    user_name: str
    summary: UserDashboardSummary
    task_statuses: list[UserDashboardChartItem] = Field(default_factory=list)
    request_statuses: list[UserDashboardChartItem] = Field(default_factory=list)
    top_requesters: list[UserDashboardChartItem] = Field(default_factory=list)
    top_recipients: list[UserDashboardChartItem] = Field(default_factory=list)
    requester_departments: list[UserDashboardChartItem] = Field(default_factory=list)
    request_departments: list[UserDashboardChartItem] = Field(default_factory=list)
    request_forms: list[UserDashboardChartItem] = Field(default_factory=list)
    monthly_tasks: list[UserDashboardChartItem] = Field(default_factory=list)
    monthly_requests: list[UserDashboardChartItem] = Field(default_factory=list)
    letters: UserDashboardLetters
