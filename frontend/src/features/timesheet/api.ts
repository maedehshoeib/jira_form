import client from "../../api/client";

const base = "/timesheet";

export type DaySummary = {
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_currently_checked_in: boolean;
  active_work_date: string | null;
  active_check_in_time: string | null;
  attendance_minutes: number;
  task_minutes: number;
  untracked_minutes: number;
  efficiency_percent: number;
};

export type AttendanceSegment = {
  id: number;
  work_date: string;
  check_in_time: string;
  check_out_time: string | null;
};

export type SubprojectItem = {
  code: string;
  title: string;
  project_code?: string;
  start_date?: string | null;
  end_date?: string | null;
  user_ids?: number[];
  is_active?: boolean;
  created_at?: string;
};

export type TaskItem = {
  id: number;
  work_date: string;
  project_code: string;
  subproject_code?: string | null;
  task_name: string;
  start_time: string;
  end_time: string;
  minutes_spent: number;
  created_at?: string;
};

export type ProjectItem = {
  code: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  user_ids?: number[];
  is_active?: boolean;
  created_at?: string;
  subprojects?: SubprojectItem[];
};

export type DayTimeline = {
  employee_id: string;
  work_date: string;
  attendance: AttendanceSegment[];
  tasks: TaskItem[];
};

export type MyRangeRecords = {
  employee_id: string;
  start_date: string;
  end_date: string;
  attendance: AttendanceSegment[];
  tasks: TaskItem[];
};

export type AdminAttendanceRecord = {
  id: number;
  employee_id: string;
  username: string;
  full_name: string;
  department: string;
  job_title: string;
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
  department: string;
  job_title: string;
  work_date: string;
  project_code: string;
  subproject_code?: string | null;
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

export type TimesheetEmployee = {
  employee_id: string;
  username: string;
  full_name: string;
  department: string;
  job_title: string;
};

export type AdminRangeRecords = {
  start_date: string;
  end_date: string;
  employees: TimesheetEmployee[];
  departments: string[];
  attendance: AdminAttendanceRecord[];
  tasks: AdminTaskRecord[];
};

export async function saveCheckIn(payload: {
  work_date: string;
  check_in_time: string;
}): Promise<DaySummary> {
  const { data } = await client.post<{ summary: DaySummary }>(
    `${base}/attendance/check-in`,
    payload,
  );
  return data.summary;
}

export async function saveCheckOut(payload: {
  work_date: string;
  check_out_time: string;
}): Promise<DaySummary> {
  const { data } = await client.post<{ summary: DaySummary }>(
    `${base}/attendance/check-out`,
    payload,
  );
  return data.summary;
}

export async function saveTask(payload: {
  work_date: string;
  project_code: string;
  subproject_code?: string | null;
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
    params: { work_date: workDate, _: Date.now() },
    headers: { 'Cache-Control': 'no-cache' },
  });
  return data;
}

export async function fetchDayTimeline(workDate: string): Promise<DayTimeline> {
  const { data } = await client.get<DayTimeline>(`${base}/me/day/timeline`, {
    params: { work_date: workDate },
  });
  return data;
}

export async function fetchMyRangeRecords(
  startDate: string,
  endDate: string,
): Promise<MyRangeRecords> {
  const { data } = await client.get<MyRangeRecords>(`${base}/me/range-records`, {
    params: { start_date: startDate, end_date: endDate },
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

export async function fetchAdminRangeRecords(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
  department?: string;
}): Promise<AdminRangeRecords> {
  const { data } = await client.get<AdminRangeRecords>(`${base}/admin/range-records`, {
    params: {
      start_date: params.startDate,
      end_date: params.endDate,
      employee_id: params.employeeId,
      department: params.department,
    },
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
  start_date: string;
  end_date: string;
  user_ids: number[];
}): Promise<ProjectItem> {
  const { data } = await client.post<ProjectItem>(`${base}/admin/projects`, payload);
  return data;
}

export async function adminUpdateProject(
  projectCode: string,
  payload: {
    code: string;
    title?: string;
    start_date: string;
    end_date: string;
    user_ids: number[];
  },
): Promise<ProjectItem> {
  const { data } = await client.put<ProjectItem>(
    `${base}/admin/projects/${encodeURIComponent(projectCode)}`,
    payload,
  );
  return data;
}

export async function adminCreateSubproject(
  projectCode: string,
  payload: {
    code: string;
    title?: string;
    start_date: string;
    end_date: string;
    user_ids: number[];
  },
): Promise<SubprojectItem> {
  const { data } = await client.post<SubprojectItem>(
    `${base}/admin/projects/${encodeURIComponent(projectCode)}/subprojects`,
    payload,
  );
  return data;
}

export async function adminUpdateSubproject(
  subprojectCode: string,
  payload: {
    code: string;
    title?: string;
    start_date: string;
    end_date: string;
    user_ids: number[];
  },
): Promise<SubprojectItem> {
  const { data } = await client.put<SubprojectItem>(
    `${base}/admin/subprojects/${encodeURIComponent(subprojectCode)}`,
    payload,
  );
  return data;
}

export async function adminDeleteSubproject(
  subprojectCode: string,
): Promise<{ message: string; subproject_code: string; cleared_tasks: number }> {
  const { data } = await client.delete(
    `${base}/admin/subprojects/${encodeURIComponent(subprojectCode)}`,
  );
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

export async function adminCreateAttendance(payload: {
  employee_id: number;
  work_date: string;
  check_in_time: string;
  check_out_time?: string | null;
}): Promise<{ message: string; attendance: AdminAttendanceRecord }> {
  const { data } = await client.post<{ message: string; attendance: AdminAttendanceRecord }>(
    `${base}/admin/attendance`,
    payload,
  );
  return data;
}

export async function adminUpdateAttendance(
  attendanceId: number,
  payload: {
    work_date: string;
    check_in_time: string;
    check_out_time?: string | null;
  },
): Promise<{ message: string; attendance: AdminAttendanceRecord }> {
  const { data } = await client.put<{ message: string; attendance: AdminAttendanceRecord }>(
    `${base}/admin/attendance/${attendanceId}`,
    payload,
  );
  return data;
}

export async function adminDeleteAttendance(
  attendanceId: number,
): Promise<{ message: string; attendance_id: number }> {
  const { data } = await client.delete(`${base}/admin/attendance/${attendanceId}`);
  return data;
}

export async function adminCreateTask(payload: {
  employee_id: number;
  work_date: string;
  project_code: string;
  subproject_code?: string | null;
  task_name: string;
  start_time: string;
  end_time: string;
}): Promise<{ message: string; minutes_spent: number }> {
  const { data } = await client.post(`${base}/admin/tasks`, payload);
  return data;
}

export async function adminUpdateTask(
  taskId: number,
  payload: {
    work_date: string;
    project_code: string;
    subproject_code?: string | null;
    task_name: string;
    start_time: string;
    end_time: string;
  },
): Promise<{ message: string; minutes_spent: number }> {
  const { data } = await client.put(`${base}/admin/tasks/${taskId}`, payload);
  return data;
}

export async function adminDeleteTask(
  taskId: number,
): Promise<{ message: string; task_id: number }> {
  const { data } = await client.delete(`${base}/admin/tasks/${taskId}`);
  return data;
}
