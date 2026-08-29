import { parseTehranDateTime } from "@/lib/persianDate";

import { INTERNAL_LETTERS_TITLE, WORKFLOW_STATUS_META } from "./constants";
import type { SubmissionListItem, TimelineItem, WorkflowStatus } from "./types";

export function parseSubmittedAt(value: string) {
  return parseTehranDateTime(value);
}
export function isInternalLetterRequest(request: SubmissionListItem) {
  return (
    request.department_title === INTERNAL_LETTERS_TITLE ||
    request.section_title === INTERNAL_LETTERS_TITLE
  );
}

export function workflowStatusMeta(status: WorkflowStatus) {
  return WORKFLOW_STATUS_META[status] ?? WORKFLOW_STATUS_META.unseen;
}

export function normalizedProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function uniqueNames(names: Array<string | null | undefined>) {
  const seen = new Set<string>();
  names.forEach((name) => {
    const normalized = (name ?? "").trim();
    if (normalized) seen.add(normalized);
  });
  return Array.from(seen);
}

export function compactNames(names: Array<string | null | undefined>) {
  const values = uniqueNames(names);
  if (values.length === 0) return "\u0646\u0627\u0645\u0634\u062e\u0635";
  if (values.length <= 2) return values.join("\u060c ");
  return `${values.slice(0, 2).join("\u060c ")} \u0648 ${(
    values.length - 2
  ).toLocaleString("fa-IR")} \u0646\u0641\u0631 \u062f\u06cc\u06af\u0631`;
}

export function timelineEventLabel(item: TimelineItem) {
  const labels: Record<string, string> = {
    submitted: "درخواست ثبت شد",
    created: "درخواست ثبت شد",
    viewed: "درخواست دیده شد",
    seen: "درخواست دیده شد",
    referred: "درخواست ارجاع شد",
    progress_updated: "درصد پیشرفت به‌روزرسانی شد",
    in_progress: "رسیدگی آغاز شد",
    completed: "درخواست انجام شد",
    approved: "درخواست انجام شد",
    rejected: "درخواست رد شد",
    reopened: "درخواست دوباره باز شد",
  };
  if (item.event_type === "status_changed") {
    if (
      item.from_status === "in_progress" &&
      item.to_status === "in_progress"
    ) {
      return labels.progress_updated;
    }
    const destinationLabels: Record<string, string> = {
      in_progress: "وضعیت به «در حال انجام» تغییر کرد",
      approved: "درخواست انجام شد",
      completed: "درخواست انجام شد",
      rejected: "درخواست رد شد",
      submitted: "درخواست به «اقدام‌نشده» بازگشت",
    };
    return destinationLabels[item.to_status || ""] ?? "وضعیت درخواست تغییر کرد";
  }
  return labels[item.event_type] ?? "رویداد درخواست";
}

export function timelineEventDotClass(item: TimelineItem) {
  if (item.event_type === "viewed" || item.event_type === "seen") {
    return "bg-sky-500 ring-sky-100";
  }
  if (item.event_type === "referred") {
    return "bg-violet-500 ring-violet-100";
  }
  if (
    item.event_type === "progress_updated" ||
    item.event_type === "in_progress" ||
    (item.event_type === "status_changed" && item.to_status === "in_progress")
  ) {
    return "bg-blue-600 ring-blue-100";
  }
  if (
    item.event_type === "completed" ||
    item.event_type === "approved" ||
    (item.event_type === "status_changed" &&
      (item.to_status === "approved" || item.to_status === "completed"))
  ) {
    return "bg-emerald-600 ring-emerald-100";
  }
  if (
    item.event_type === "rejected" ||
    (item.event_type === "status_changed" && item.to_status === "rejected")
  ) {
    return "bg-primary ring-red-100";
  }
  return "bg-muted ring-slate-100";
}

export function parseTimelineEntityId(itemId: number | string, prefix: string) {
  const raw = String(itemId);
  const expected = `${prefix}:`;
  if (!raw.startsWith(expected)) return null;
  const value = Number(raw.slice(expected.length));
  return Number.isFinite(value) ? value : null;
}

export async function downloadWithAuth(url: string, fileName: string) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function workflowStepIndex(status: WorkflowStatus) {
  if (status === "unseen") return 0;
  if (status === "seen") return 1;
  if (status === "referred" || status === "in_progress") return 2;
  return 3;
}
