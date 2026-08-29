import { parseTehranDateTime } from "@/lib/persianDate";

import { INTERNAL_LETTERS_TITLE } from "./constants";
import type { StatusTab, SubmissionListItem } from "./types";

export function uniqueNames(names: Array<string | null | undefined>) {
  return Array.from(
    new Set(names.map((name) => (name || "").trim()).filter(Boolean)),
  );
}

export function initialAssigneeNames(task: SubmissionListItem) {
  return uniqueNames(
    (task.initial_assignees ?? []).map(
      (assignee) => assignee.display_name || assignee.username,
    ),
  );
}

export function referralTargetNames(task: SubmissionListItem) {
  return uniqueNames(
    (task.referrals ?? []).map((referral) => referral.to_user_name),
  );
}

export function ccRecipientNames(task: SubmissionListItem) {
  return uniqueNames(
    (task.cc_recipients ?? []).map(
      (recipient) => recipient.display_name || recipient.username,
    ),
  );
}

export function compactNames(names: string[], limit = 2) {
  if (names.length === 0) return "\u2014";
  if (names.length <= limit) return names.join("\u060c ");
  return `${names.slice(0, limit).join("\u060c ")} \u0648 ${(
    names.length - limit
  ).toLocaleString("fa-IR")} \u0646\u0641\u0631 \u062f\u06cc\u06af\u0631`;
}

export function parseSubmittedAt(value: string) {
  return parseTehranDateTime(value);
}

export function displayStatus(status: string) {
  if (status === "in_progress") return "\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062c\u0627\u0645";
  if (status === "approved") return "انجام‌شده";
  if (status === "rejected") return "رد‌شده";
  if (status === "submitted") return "اقدام‌نشده";
  return status || "اقدام‌نشده";
}

export function statusBadgeClass(status: string) {
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-primary/30 bg-primary/10 text-primary";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function matchesStatusTab(task: SubmissionListItem, tab: StatusTab) {
  if (tab === "in_progress") return task.status === "in_progress";
  if (tab === "pending") return task.status === "submitted";
  if (tab === "rejected") return task.status === "rejected";
  if (tab === "approved") return task.status === "approved";
  return (task.referrals?.length ?? 0) > 0;
}

export function isInternalLetterTask(task: SubmissionListItem) {
  return (
    task.department_title === INTERNAL_LETTERS_TITLE ||
    task.section_title === INTERNAL_LETTERS_TITLE
  );
}

export function normalizedProgress(value: number | null | undefined, status?: string) {
  if (status === "approved") return 100;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function progressBarClass(status: string) {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rejected") return "bg-primary/100";
  if (status === "in_progress") return "bg-blue-500";
  return "bg-amber-500";
}

export function statusActionLabel(status: "approved" | "rejected" | "submitted") {
  if (status === "approved") return "انجام شده";
  if (status === "rejected") return "رد";
  return "بازگشت به اقدام‌نشده";
}

export function apiErrorDetail(err: unknown, fallback: string) {
  if (!err || typeof err !== "object" || !("response" in err)) return fallback;
  const detail = (err as { response?: { data?: { detail?: unknown } } }).response
    ?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return "";
      })
      .filter(Boolean);
    if (messages.length) return messages.join(" · ");
  }
  return fallback;
}
