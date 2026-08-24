import client from "../api/client";
import { endpoints } from "../api/endpoints";
import type { DashboardChartItem, UserDashboardData } from "./userDashboard";

type LegacySubmission = {
  id: number;
  form_id: string;
  form_title: string;
  department_title: string;
  section_title: string;
  subject: string;
  status: string;
  submitted_by: string;
  created_at: string;
  initial_assignees?: Array<{ user_id: number; display_name: string; username: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "اقدام‌نشده",
  in_progress: "در حال انجام",
  approved: "انجام‌شده",
  rejected: "ردشده",
  referred: "ارجاع‌شده",
};

function chart(values: string[], limit?: number): DashboardChartItem[] {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const items = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, "fa"));
  return limit ? items.slice(0, limit) : items;
}

function statusChart(rows: LegacySubmission[]) {
  return chart(rows.map((row) => STATUS_LABELS[row.status] || row.status || "نامشخص"));
}

function monthLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  return `${year}/${month}`;
}

function monthly(rows: LegacySubmission[]): DashboardChartItem[] {
  const items = chart(rows.map((row) => monthLabel(row.created_at)));
  return items.sort((first, second) => first.label.localeCompare(second.label, "fa")).slice(-6);
}

function isLetter(row: LegacySubmission) {
  return row.form_id === "management-letter-form";
}

function letterType(row: LegacySubmission) {
  const title = `${row.department_title} ${row.section_title}`;
  return title.includes("درون") ? "درون‌سازمانی" : "برون‌سازمانی";
}

function sentLetterKey(row: LegacySubmission) {
  // Recipient copies are created together and share subject/time in the legacy API.
  return `${row.subject}|${row.created_at.slice(0, 16)}`;
}

export async function fetchLegacyUserDashboard(): Promise<UserDashboardData> {
  const [tasksResponse, requestsResponse, meResponse] = await Promise.all([
    client.get<LegacySubmission[]>(endpoints.tasks, { params: { limit: 500 } }),
    client.get<LegacySubmission[]>(endpoints.submissions, { params: { limit: 500 } }),
    client.get<{ display_name?: string; username?: string }>(endpoints.me),
  ]);
  const tasks = Array.isArray(tasksResponse.data) ? tasksResponse.data : [];
  const requests = Array.isArray(requestsResponse.data) ? requestsResponse.data : [];
  const sentLetterCopies = requests.filter(isLetter);
  const receivedLetters = tasks.filter(isLetter);
  const uniqueSentLetters = new Map<string, LegacySubmission>();
  sentLetterCopies.forEach((row) => uniqueSentLetters.set(sentLetterKey(row), row));

  const recipientNames = requests.flatMap((row) =>
    (row.initial_assignees || []).map((assignee) => assignee.display_name || assignee.username),
  );
  const isOpen = (row: LegacySubmission) => row.status === "submitted" || row.status === "in_progress";

  return {
    user_name: meResponse.data.display_name || meResponse.data.username || "کاربر",
    summary: {
      total_tasks: tasks.length,
      open_tasks: tasks.filter(isOpen).length,
      completed_tasks: tasks.filter((row) => row.status === "approved").length,
      total_requests: requests.length,
      open_requests: requests.filter(isOpen).length,
      completed_requests: requests.filter((row) => row.status === "approved").length,
      sent_letters: uniqueSentLetters.size,
      received_letters: receivedLetters.length,
    },
    task_statuses: statusChart(tasks),
    request_statuses: statusChart(requests),
    top_requesters: chart(tasks.map((row) => row.submitted_by), 8),
    top_recipients: chart(recipientNames, 8),
    requester_departments: chart(tasks.map((row) => row.department_title), 8),
    request_departments: chart(requests.map((row) => row.department_title), 8),
    request_forms: chart(requests.map((row) => row.form_title), 8),
    monthly_tasks: monthly(tasks),
    monthly_requests: monthly(requests),
    letters: {
      sent_by_type: chart([...uniqueSentLetters.values()].map(letterType)),
      received_by_type: chart(receivedLetters.map(letterType)),
      sent_by_status: statusChart(sentLetterCopies),
      received_by_status: statusChart(receivedLetters),
    },
  };
}
