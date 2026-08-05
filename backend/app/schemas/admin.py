from datetime import datetime

from pydantic import BaseModel, Field


class AdminUserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    email: str
    category: str
    department: str
    department_id: int | None
    job_title: str
    extension: str
    avatar_url: str
    is_active: bool
    is_admin: bool
    must_change_password: bool
    created_at: datetime
    last_login: datetime | None

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=128)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=256)
    email: str = Field(default="", max_length=256)
    category: str = Field(default="", max_length=256)
    department: str = Field(default="", max_length=128)
    department_id: int | None = None
    job_title: str = Field(default="", max_length=512)
    extension: str = Field(default="", max_length=32)
    is_active: bool = True
    is_admin: bool = False
    must_change_password: bool = True


class AdminUserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=128)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=256)
    email: str | None = Field(default=None, max_length=256)
    category: str | None = Field(default=None, max_length=256)
    department: str | None = Field(default=None, max_length=128)
    department_id: int | None = None
    job_title: str | None = Field(default=None, max_length=512)
    extension: str | None = Field(default=None, max_length=32)
    is_active: bool | None = None
    is_admin: bool | None = None
    must_change_password: bool | None = None


class AdminSessionResponse(BaseModel):
    id: int
    device_id: str
    device_name: str
    user_agent: str
    ip_address: str
    logged_in_at: datetime
    last_seen_at: datetime
    logged_out_at: datetime | None
    is_active: bool

    class Config:
        from_attributes = True


class ChartItem(BaseModel):
    label: str
    value: int


class DashboardRecentRequest(BaseModel):
    id: int
    subject: str
    status: str
    form_id: str
    submitted_by: str
    created_at: datetime


class DashboardResponse(BaseModel):
    total_users: int
    active_users: int
    total_requests: int
    requests_today: int
    active_admin_devices: int
    requests_by_status: list[ChartItem]
    requests_by_department: list[ChartItem]
    requests_by_month: list[ChartItem]
    recent_requests: list[DashboardRecentRequest]


class DailyTimesheetPoint(BaseModel):
    date: str
    attendance_minutes: int
    task_minutes: int


class DailyFormPoint(BaseModel):
    date: str
    count: int


class EmployeeAnalyticsRow(BaseModel):
    employee_id: str
    username: str
    full_name: str
    department: str
    job_title: str
    attendance_minutes: int
    task_minutes: int
    untracked_minutes: int
    efficiency_percent: float
    task_count: int
    active_days: int
    form_count: int


class SubprojectAnalyticsRow(BaseModel):
    code: str
    title: str
    minutes: int
    task_count: int
    employee_count: int


class ProjectAnalyticsRow(BaseModel):
    code: str
    title: str
    minutes: int
    task_count: int
    employee_count: int
    is_active: bool = True
    subprojects: list[SubprojectAnalyticsRow] = []


class DepartmentAnalyticsRow(BaseModel):
    name: str
    employee_count: int
    attendance_minutes: int
    task_minutes: int
    untracked_minutes: int
    efficiency_percent: float
    task_count: int
    form_count: int
    active_employees: int


class AnalyticsOverview(BaseModel):
    total_users: int
    active_users: int
    total_requests: int
    requests_in_range: int
    requests_today: int
    active_admin_devices: int
    attendance_minutes: int
    task_minutes: int
    untracked_minutes: int
    efficiency_percent: float
    task_count: int
    active_employees: int
    open_check_ins: int
    project_count: int
    department_count: int


class FormsAnalytics(BaseModel):
    by_status: list[ChartItem]
    by_org_department: list[ChartItem]
    by_portal_department: list[ChartItem]
    by_form: list[ChartItem]
    daily_trend: list[DailyFormPoint]
    monthly_trend: list[ChartItem]
    top_submitters: list[ChartItem]
    recent_requests: list[DashboardRecentRequest]


class AnalyticsFilterEmployee(BaseModel):
    employee_id: str
    full_name: str
    department: str


class AnalyticsFilterProject(BaseModel):
    code: str
    title: str
    is_active: bool = True


class AnalyticsFilterForm(BaseModel):
    id: str
    title: str


class AnalyticsFilterOptions(BaseModel):
    departments: list[str] = []
    employees: list[AnalyticsFilterEmployee] = []
    projects: list[AnalyticsFilterProject] = []
    forms: list[AnalyticsFilterForm] = []


class AnalyticsResponse(BaseModel):
    start_date: str
    end_date: str
    overview: AnalyticsOverview
    forms: FormsAnalytics
    employees: list[EmployeeAnalyticsRow]
    projects: list[ProjectAnalyticsRow]
    departments: list[DepartmentAnalyticsRow]
    timesheet_daily_trend: list[DailyTimesheetPoint]
    filter_options: AnalyticsFilterOptions = AnalyticsFilterOptions()


class SiteBannerImageResponse(BaseModel):
    id: int
    image_url: str
    image_name: str


class SiteBannerResponse(BaseModel):
    is_active: bool
    images: list[SiteBannerImageResponse] = Field(default_factory=list)
    interval_seconds: int = 5
    # Retained for clients from the single-image banner version.
    image_url: str | None = None
    image_name: str = ""
    updated_at: datetime | None = None


class SiteBannerUpdate(BaseModel):
    is_active: bool = False
    interval_seconds: int = Field(default=5, ge=2, le=30)


class SiteNewsResponse(BaseModel):
    id: int
    title: str
    body: str
    image_url: str | None = None
    image_name: str = ""
    created_at: datetime
    updated_at: datetime | None = None


class DepartmentResponse(BaseModel):
    id: int
    name: str
    description: str
    access_configured: bool
    user_count: int = 0


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=512)


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, max_length=512)


class FormAccessTarget(BaseModel):
    portal_department_id: str
    portal_department_title: str
    section_id: str
    section_title: str
    form_id: str


class FormAccessSelection(BaseModel):
    configured: bool = True
    targets: list[str] = Field(default_factory=list)


class FormAccessResponse(BaseModel):
    configured: bool
    targets: list[str]


class FormDutyEdge(BaseModel):
    user_id: int
    username: str = ""
    display_name: str = ""
    target_key: str
    portal_department_id: str = ""
    portal_department_title: str = ""
    section_id: str = ""
    section_title: str = ""
    form_id: str = ""


class FormDutyEdgeInput(BaseModel):
    user_id: int
    target_key: str = Field(min_length=1, max_length=256)


class FormDutySelection(BaseModel):
    assignments: list[FormDutyEdgeInput] = Field(default_factory=list)


class FormDutyResponse(BaseModel):
    assignments: list[FormDutyEdge]
