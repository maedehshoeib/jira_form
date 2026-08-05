import client from "../../api/client";
import { endpoints } from "../../api/endpoints";

export type ChartItem = { label: string; value: number };

export type DailyTimesheetPoint = {
  date: string;
  attendance_minutes: number;
  task_minutes: number;
};

export type DailyFormPoint = {
  date: string;
  count: number;
};

export type EmployeeAnalyticsRow = {
  employee_id: string;
  username: string;
  full_name: string;
  department: string;
  job_title: string;
  attendance_minutes: number;
  task_minutes: number;
  untracked_minutes: number;
  efficiency_percent: number;
  task_count: number;
  active_days: number;
  form_count: number;
};

export type SubprojectAnalyticsRow = {
  code: string;
  title: string;
  minutes: number;
  task_count: number;
  employee_count: number;
};

export type ProjectAnalyticsRow = {
  code: string;
  title: string;
  minutes: number;
  task_count: number;
  employee_count: number;
  is_active?: boolean;
  subprojects?: SubprojectAnalyticsRow[];
};

export type DepartmentAnalyticsRow = {
  name: string;
  employee_count: number;
  attendance_minutes: number;
  task_minutes: number;
  untracked_minutes: number;
  efficiency_percent: number;
  task_count: number;
  form_count: number;
  active_employees: number;
};

export type AnalyticsOverview = {
  total_users: number;
  active_users: number;
  total_requests: number;
  requests_in_range: number;
  requests_today: number;
  active_admin_devices: number;
  attendance_minutes: number;
  task_minutes: number;
  untracked_minutes: number;
  efficiency_percent: number;
  task_count: number;
  active_employees: number;
  open_check_ins: number;
  project_count: number;
  department_count: number;
};

export type FormsAnalytics = {
  by_status: ChartItem[];
  by_org_department: ChartItem[];
  by_portal_department: ChartItem[];
  by_form: ChartItem[];
  daily_trend: DailyFormPoint[];
  monthly_trend: ChartItem[];
  top_submitters: ChartItem[];
  recent_requests: {
    id: number;
    subject: string;
    status: string;
    form_id: string;
    submitted_by: string;
    created_at: string;
  }[];
};

export type AnalyticsFilterEmployee = {
  employee_id: string;
  full_name: string;
  department: string;
};

export type AnalyticsFilterProject = {
  code: string;
  title: string;
  is_active: boolean;
};

export type AnalyticsFilterForm = {
  id: string;
  title: string;
};

export type AnalyticsFilterOptions = {
  departments: string[];
  employees: AnalyticsFilterEmployee[];
  projects: AnalyticsFilterProject[];
  forms: AnalyticsFilterForm[];
};

export type AnalyticsResponse = {
  start_date: string;
  end_date: string;
  overview: AnalyticsOverview;
  forms: FormsAnalytics;
  employees: EmployeeAnalyticsRow[];
  projects: ProjectAnalyticsRow[];
  departments: DepartmentAnalyticsRow[];
  timesheet_daily_trend: DailyTimesheetPoint[];
  filter_options: AnalyticsFilterOptions;
};

export type AnalyticsProjectStatus = "active" | "inactive";

export async function fetchAdminAnalytics(params: {
  startDate: string;
  endDate: string;
  department?: string;
  employeeId?: string;
  projectCode?: string;
  projectStatus?: AnalyticsProjectStatus;
  formId?: string;
}): Promise<AnalyticsResponse> {
  const { data } = await client.get<AnalyticsResponse>(endpoints.adminAnalytics, {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      department: params.department,
      employee_id: params.employeeId,
      project_code: params.projectCode,
      project_status: params.projectStatus,
      form_id: params.formId,
    },
  });
  return data;
}
