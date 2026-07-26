import client from "../../api/client";

const base = "/timesheet";

export type DaySummary = {
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_currently_checked_in: boolean;
  attendance_minutes: number;
  task_minutes: number;
  untracked_minutes: number;
  efficiency_percent: number;
};

export type AttendanceSegment = {
  id: number;
  check_in_time: string;
  check_out_time: string | null;
};

export type TaskItem = {
  id: number;
  project_code: string;
  task_name: string;
  start_time: string;
  end_time: string;
  minutes_spent: number;
  created_at?: string;
};

export type ProjectItem = {
  code: string;
  title: string;
  is_active?: boolean;
  created_at?: string;
};

export type DayTimeline = {
  employee_id: string;
  work_date: string;
  attendance: AttendanceSegment[];
  tasks: TaskItem[];
};

export type AdminAttendanceRecord = {
  id: number;
  employee_id: string;
  username: string;
  full_name: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminTaskRecord = {
  id: number;
  employee_id: string;
  username: string;
  full_name: string;
  work_date: string;
  project_code: string;
  task_name: string;
  start_time: string;
  end_time: string;
  minutes_spent: number;
  created_at?: string;
};

export type AdminDayRecords = {
  work_date: string;
  attendance: AdminAttendanceRecord[];
  tasks: AdminTaskRecord[];
};

export async function saveCheckIn(payload: {
  work_date: string;
  check_in_time: string;
}): Promise<void> {
  await client.post(`${base}/attendance/check-in`, payload);
}

export async function saveCheckOut(payload: {
  work_date: string;
  check_out_time: string;
}): Promise<void> {
  await client.post(`${base}/attendance/check-out`, payload);
}

export async function saveTask(payload: {
  work_date: string;
  project_code: string;
  task_name: string;
  start_time: string;
  end_time: string;
}): Promise<void> {
  await client.post(`${base}/tasks`, payload);
}

export async function fetchProjects(): Promise<ProjectItem[]> {
  const { data } = await client.get<{ projects: ProjectItem[] }>(`${base}/projects`);
  return data.projects || [];
}

export async function fetchSummary(workDate: string): Promise<DaySummary> {
  const { data } = await client.get<DaySummary>(`${base}/me/day/summary`, {
    params: { work_date: workDate },
  });
  return data;
}

export async function fetchDayTimeline(workDate: string): Promise<DayTimeline> {
  const { data } = await client.get<DayTimeline>(`${base}/me/day/timeline`, {
    params: { work_date: workDate },
  });
  return data;
}

export async function fetchAdminDayRecords(
  workDate: string,
): Promise<AdminDayRecords> {
  const { data } = await client.get<AdminDayRecords>(`${base}/admin/day-records`, {
    params: { work_date: workDate },
  });
  return data;
}

export async function fetchAdminProjects(): Promise<ProjectItem[]> {
  const { data } = await client.get<{ projects: ProjectItem[] }>(
    `${base}/admin/projects`,
  );
  return data.projects || [];
}

export async function adminCreateProject(payload: {
  code: string;
  title?: string;
}): Promise<ProjectItem> {
  const { data } = await client.post<ProjectItem>(`${base}/admin/projects`, payload);
  return data;
}

export async function adminDeleteProject(
  projectCode: string,
): Promise<{ message: string; project_code: string; reassigned_tasks: number }> {
  const { data } = await client.delete(
    `${base}/admin/projects/${encodeURIComponent(projectCode)}`,
  );
  return data;
}
