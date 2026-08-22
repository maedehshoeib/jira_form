import { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Forward,
  ListTodo,
  Loader2,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { API_BASE, FormField, FormTemplate } from "../config/portal";
import {
  formatPersianDateTime,
  getTehranNowDate,
  parseTehranDateTime,
} from "../lib/persianDate";
import UserDisplayName from "../components/UserDisplayName";

const REFERRAL_NOTE_MAX_LENGTH = 512;

type ReferralItem = {
  id: number;
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  note: string;
  attachment_name?: string | null;
  created_at: string;
};

type TimelineItem = {
  id: string;
  event_type: string;
  actor_id?: number | null;
  actor_name?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  note?: string;
  attachment_name?: string | null;
  created_at: string;
};

type InitialAssignee = {
  user_id: number;
  username: string;
  display_name: string;
  assigned_at: string;
};

type CcRecipient = {
  user_id: number;
  username: string;
  display_name: string;
  mentioned_by_id: number;
  mentioned_by_name: string;
  created_at: string;
};

type SubmissionListItem = {
  id: number;
  form_id: string;
  form_title: string;
  department_id: string;
  department_title: string;
  section_id: string;
  section_title: string;
  subject: string;
  status: string;
  workflow_status: string;
  progress_percent: number;
  jira_issue_key?: string;
  jira_status?: string;
  is_read: boolean;
  first_viewed_at: string | null;
  attachment_name: string | null;
  attachment_names?: string[];
  created_at: string;
  submitted_by?: string;
  submitted_by_username?: string;
  status_updated_by?: string | null;
  status_updated_at?: string | null;
  status_note?: string;
  status_attachment_name?: string | null;
  initial_assignees?: InitialAssignee[];
  referrals?: ReferralItem[];
  cc_recipients?: CcRecipient[];
  can_act?: boolean;
  timeline?: TimelineItem[];
};

type SubmissionDetail = SubmissionListItem & {
  data: Record<string, unknown>;
};

type Colleague = {
  id: number;
  username: string;
  display_name: string;
  department: string;
  job_title: string;
  birth_date?: string | null;
  is_birthday?: boolean;
};

function uniqueNames(names: Array<string | null | undefined>) {
  return Array.from(
    new Set(names.map((name) => (name || "").trim()).filter(Boolean)),
  );
}

function initialAssigneeNames(task: SubmissionListItem) {
  return uniqueNames(
    (task.initial_assignees ?? []).map(
      (assignee) => assignee.display_name || assignee.username,
    ),
  );
}

function referralTargetNames(task: SubmissionListItem) {
  return uniqueNames(
    (task.referrals ?? []).map((referral) => referral.to_user_name),
  );
}

function ccRecipientNames(task: SubmissionListItem) {
  return uniqueNames(
    (task.cc_recipients ?? []).map(
      (recipient) => recipient.display_name || recipient.username,
    ),
  );
}

function compactNames(names: string[], limit = 2) {
  if (names.length === 0) return "\u2014";
  if (names.length <= limit) return names.join("\u060c ");
  return `${names.slice(0, limit).join("\u060c ")} \u0648 ${(
    names.length - limit
  ).toLocaleString("fa-IR")} \u0646\u0641\u0631 \u062f\u06cc\u06af\u0631`;
}

type TimeRange = "all" | "today" | "7days" | "30days" | "90days";
type SortOrder = "newest" | "oldest";
type StatusTab = "pending" | "in_progress" | "rejected" | "approved" | "referred";

const INTERNAL_LETTERS_FILTER = "internal-letters";
const INTERNAL_LETTERS_TITLE = "نامه‌های درون‌سازمانی";

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "pending", label: "اقدام نشده" },
  { id: "in_progress", label: "\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062c\u0627\u0645" },
  { id: "rejected", label: "رد شده" },
  { id: "approved", label: "انجام شده" },
  { id: "referred", label: "ارجاع شده" },
];

function parseSubmittedAt(value: string) {
  return parseTehranDateTime(value);
}

function displayStatus(status: string) {
  if (status === "in_progress") return "\u062f\u0631 \u062d\u0627\u0644 \u0627\u0646\u062c\u0627\u0645";
  if (status === "approved") return "انجام‌شده";
  if (status === "rejected") return "رد‌شده";
  if (status === "submitted") return "اقدام‌نشده";
  return status || "اقدام‌نشده";
}

function statusBadgeClass(status: string) {
  if (status === "in_progress") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function matchesStatusTab(task: SubmissionListItem, tab: StatusTab) {
  if (tab === "in_progress") return task.status === "in_progress";
  if (tab === "pending") return task.status === "submitted";
  if (tab === "rejected") return task.status === "rejected";
  if (tab === "approved") return task.status === "approved";
  return (task.referrals?.length ?? 0) > 0;
}

function isInternalLetterTask(task: SubmissionListItem) {
  return (
    task.department_title === INTERNAL_LETTERS_TITLE ||
    task.section_title === INTERNAL_LETTERS_TITLE
  );
}

function normalizedProgress(value: number | null | undefined, status?: string) {
  if (status === "approved") return 100;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function progressBarClass(status: string) {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rejected") return "bg-red-500";
  if (status === "in_progress") return "bg-blue-500";
  return "bg-amber-500";
}

function TaskProgress({
  progress,
  status,
  compact = false,
}: {
  progress: number;
  status: string;
  compact?: boolean;
}) {
  const value = normalizedProgress(progress, status);
  return (
    <div className={compact ? "mt-4" : "rounded-2xl border border-slate-100 bg-slate-50 p-4"}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-600">{"\u067e\u06cc\u0634\u0631\u0641\u062a \u0627\u0646\u062c\u0627\u0645 \u062f\u0631\u062e\u0648\u0627\u0633\u062a"}</span>
        <span dir="ltr" className="font-extrabold tabular-nums text-slate-700">
          {value}%
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="\u067e\u06cc\u0634\u0631\u0641\u062a \u0627\u0646\u062c\u0627\u0645 \u062f\u0631\u062e\u0648\u0627\u0633\u062a"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className={`h-full rounded-full transition-all ${progressBarClass(status)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function statusActionLabel(status: "approved" | "rejected" | "submitted") {
  if (status === "approved") return "انجام شده";
  if (status === "rejected") return "رد";
  return "بازگشت به اقدام‌نشده";
}

function apiErrorDetail(err: unknown, fallback: string) {
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

function displayValue(value: unknown, field?: FormField) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">ثبت نشده</span>;
  }

  if (field?.type === "select") {
    const option = field.options?.find((item) => item.value === String(value));
    return option?.label ?? String(value);
  }

  if (Array.isArray(value)) {
    const rows = value.filter(
      (row) => row && typeof row === "object" && Object.values(row).some(Boolean),
    ) as Record<string, unknown>[];
    if (!rows.length) return <span className="text-slate-400">ثبت نشده</span>;

    const columns = field?.columns?.length
      ? field.columns
      : Object.keys(rows[0]).map((key) => ({ key, title: key }));

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600"
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-pre-wrap px-3 py-2 text-slate-700"
                  >
                    {String(row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (typeof value === "object") {
    return <pre className="overflow-x-auto text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<SubmissionListItem[]>([]);
  const [selected, setSelected] = useState<SubmissionDetail | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [statusTab, setStatusTab] = useState<StatusTab>("pending");

  const [referOpen, setReferOpen] = useState(false);
  const [statusPanel, setStatusPanel] = useState<"approved" | "rejected" | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [progressDraft, setProgressDraft] = useState(0);
  const [progressNote, setProgressNote] = useState("");
  const [progressAttachment, setProgressAttachment] = useState<File | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [colleagueQuery, setColleagueQuery] = useState("");
  const [selectedColleagueIds, setSelectedColleagueIds] = useState<number[]>([]);
  const [mentionedColleagueIds, setMentionedColleagueIds] = useState<number[]>([]);
  const [referNote, setReferNote] = useState("");
  const [colleaguesLoading, setColleaguesLoading] = useState(false);
  const [statusAttachment, setStatusAttachment] = useState<File | null>(null);
  const [referAttachment, setReferAttachment] = useState<File | null>(null);

  const syncTask = (updated: SubmissionListItem | SubmissionDetail) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === updated.id ? { ...task, ...updated } : task)),
    );
    setSelected((prev) =>
      prev && prev.id === updated.id ? { ...prev, ...updated, data: prev.data } : prev,
    );
  };

  const loadTasks = async () => {
    setLoading(true);
    setError("");
    try {
      const allTasks: SubmissionListItem[] = [];
      const pageSize = 500;
      let offset = 0;

      while (true) {
        const { data } = await client.get<SubmissionListItem[]>(endpoints.tasks, {
          params: { limit: pageSize, offset },
        });
        allTasks.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      setTasks(allTasks);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch {
      setError("دریافت وظایف با مشکل مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const departments = useMemo(() => {
    const items = new Map<string, string>();
    tasks.forEach((task) => {
      if (task.department_id) {
        items.set(task.department_id, task.department_title || task.department_id);
      }
    });
    return Array.from(items, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "fa"),
    );
  }, [tasks]);

  const sections = useMemo(() => {
    const items = new Map<string, string>();
    const hasInternalLetters = tasks.some(
      (task) =>
        (departmentFilter === "all" || task.department_id === departmentFilter) &&
        isInternalLetterTask(task),
    );
    tasks
      .filter(
        (task) => departmentFilter === "all" || task.department_id === departmentFilter,
      )
      .forEach((task) => {
        const key = `${task.department_id}::${task.section_id}`;
        if (task.section_id) {
          items.set(key, task.section_title || task.form_title);
        }
      });
    if (hasInternalLetters) {
      items.set(INTERNAL_LETTERS_FILTER, INTERNAL_LETTERS_TITLE);
    }
    return Array.from(items, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "fa"),
    );
  }, [tasks, departmentFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      pending: 0,
      in_progress: 0,
      rejected: 0,
      approved: 0,
      referred: 0,
    };
    tasks.forEach((task) => {
      if (task.status === "submitted") counts.pending += 1;
      if (task.status === "in_progress") counts.in_progress += 1;
      if (task.status === "rejected") counts.rejected += 1;
      if (task.status === "approved") counts.approved += 1;
      if ((task.referrals?.length ?? 0) > 0) counts.referred += 1;
    });
    return counts;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("fa");
    const now = getTehranNowDate();
    let cutoff: Date | null = null;

    if (timeRange === "today") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeRange !== "all") {
      const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
      cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return tasks
      .filter((task) => {
        if (!matchesStatusTab(task, statusTab)) return false;

        const searchableText = [
          task.id,
          task.subject,
          task.form_title,
          task.department_title,
          task.section_title,
          task.submitted_by,
          task.submitted_by_username,
          ...(task.initial_assignees ?? []).flatMap((assignee) => [
            assignee.display_name,
            assignee.username,
          ]),
          ...(task.referrals ?? []).flatMap((referral) => [
            referral.from_user_name,
            referral.to_user_name,
          ]),
          ...(task.cc_recipients ?? []).flatMap((recipient) => [
            recipient.display_name,
            recipient.username,
          ]),
        ]
          .join(" ")
          .toLocaleLowerCase("fa");

        if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false;
        if (departmentFilter !== "all" && task.department_id !== departmentFilter) {
          return false;
        }
        if (
          sectionFilter !== "all" &&
          sectionFilter !== INTERNAL_LETTERS_FILTER &&
          `${task.department_id}::${task.section_id}` !== sectionFilter
        ) {
          return false;
        }
        if (sectionFilter === INTERNAL_LETTERS_FILTER && !isInternalLetterTask(task)) {
          return false;
        }
        if (cutoff) {
          const submittedAt = parseSubmittedAt(task.created_at);
          if (!submittedAt || submittedAt < cutoff) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = parseSubmittedAt(a.created_at)?.getTime() ?? 0;
        const bTime = parseSubmittedAt(b.created_at)?.getTime() ?? 0;
        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [tasks, statusTab, searchQuery, departmentFilter, sectionFilter, timeRange, sortOrder]);

  const hasActiveFilters =
    searchQuery !== "" ||
    departmentFilter !== "all" ||
    sectionFilter !== "all" ||
    timeRange !== "all" ||
    sortOrder !== "newest";

  const resetFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("all");
    setSectionFilter("all");
    setTimeRange("all");
    setSortOrder("newest");
  };

  const openTask = async (task: SubmissionListItem) => {
    setDetailLoading(true);
    setError("");
    setActionError("");
    setReferOpen(false);
    setStatusPanel(null);
    setStatusNote("");
    setStatusAttachment(null);
    setProgressNote("");
    setProgressAttachment(null);
    setReferAttachment(null);
    try {
      const [detailResponse, templateResponse] = await Promise.all([
        client.get<SubmissionDetail>(`${endpoints.tasks}/${task.id}`),
        client.get<FormTemplate>(`${endpoints.forms}/${task.form_id}`, {
          params: {
            department: task.department_id,
            section: task.section_id,
          },
        }),
      ]);
      syncTask(detailResponse.data);
      setSelected(detailResponse.data);
      setProgressDraft(
        normalizedProgress(detailResponse.data.progress_percent, detailResponse.data.status),
      );
      setTemplate(templateResponse.data);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch {
      setError("نمایش جزئیات این وظیفه با مشکل مواجه شد.");
    } finally {
      setDetailLoading(false);
    }
  };

  const openStatusPanel = (status: "approved" | "rejected") => {
    if (!selected || selected.status === status) return;
    setReferOpen(false);
    setReferAttachment(null);
    setStatusPanel(status);
    setStatusNote(selected.status_note || "");
    setStatusAttachment(null);
    setActionError("");
  };

  const updateStatus = async (
    status: "approved" | "rejected" | "submitted",
    note = "",
    attachment: File | null = null,
  ) => {
    if (!selected || selected.status === status) return;
    const label = statusActionLabel(status);
    if (status === "submitted") {
      if (!window.confirm(`آیا از تغییر وضعیت به «${label}» مطمئن هستید؟`)) return;
    }

    setActionLoading(true);
    setActionError("");
    try {
      let data: SubmissionDetail;
      if (attachment) {
        const formData = new FormData();
        formData.append("status", status);
        formData.append("note", note.trim());
        formData.append("attachment", attachment);
        const response = await client.patch<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/status`,
          formData,
        );
        data = response.data;
      } else {
        const response = await client.patch<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/status`,
          { status, note: note.trim() },
        );
        data = response.data;
      }
      syncTask(data);
      setSelected((prev) => (prev ? { ...data, data: prev.data } : data));
      setProgressDraft(normalizedProgress(data.progress_percent, data.status));
      setStatusPanel(null);
      setStatusNote("");
      setStatusAttachment(null);
      if (status !== "submitted") setReferOpen(false);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch (err: unknown) {
      setActionError(apiErrorDetail(err, `تغییر وضعیت با مشکل مواجه شد.`));
    } finally {
      setActionLoading(false);
    }
  };

  const submitStatusAction = async () => {
    if (!statusPanel) return;
    await updateStatus(statusPanel, statusNote, statusAttachment);
  };

  const updateProgress = async () => {
    if (
      !selected ||
      !selected.can_act ||
      (selected.status !== "submitted" && selected.status !== "in_progress")
    ) {
      return;
    }
    const nextProgress = Math.min(99, Math.max(0, Math.round(progressDraft)));
    const note = progressNote.trim();
    if (
      selected.status === "in_progress" &&
      nextProgress === normalizedProgress(selected.progress_percent, selected.status) &&
      !note &&
      !progressAttachment
    ) {
      return;
    }

    setActionLoading(true);
    setActionError("");
    try {
      let data: SubmissionDetail;
      if (progressAttachment) {
        const formData = new FormData();
        formData.append("status", "in_progress");
        formData.append("progress_percent", String(nextProgress));
        formData.append("note", note);
        formData.append("attachment", progressAttachment);
        const response = await client.patch<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/status`,
          formData,
        );
        data = response.data;
      } else {
        const response = await client.patch<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/status`,
          { status: "in_progress", progress_percent: nextProgress, note },
        );
        data = response.data;
      }
      syncTask(data);
      setSelected((prev) => (prev ? { ...data, data: prev.data } : data));
      setProgressDraft(normalizedProgress(data.progress_percent, data.status));
      setProgressNote("");
      setProgressAttachment(null);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch (err: unknown) {
      setActionError(
        apiErrorDetail(err, "\u062b\u0628\u062a \u067e\u06cc\u0634\u0631\u0641\u062a \u0628\u0627 \u0645\u0634\u06a9\u0644 \u0645\u0648\u0627\u062c\u0647 \u0634\u062f."),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const toggleColleague = (userId: number) => {
    setSelectedColleagueIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      setMentionedColleagueIds((mentions) =>
        mentions.filter((id) => id !== userId),
      );
      return [...prev, userId];
    });
  };

  const openReferPanel = async () => {
    setStatusPanel(null);
    setStatusAttachment(null);
    setReferOpen(true);
    setActionError("");
    setColleagueQuery("");
    setSelectedColleagueIds([]);
    setMentionedColleagueIds([]);
    setReferNote("");
    setReferAttachment(null);
    if (colleagues.length > 0) return;
    setColleaguesLoading(true);
    try {
      const { data } = await client.get<Colleague[]>(endpoints.taskColleagues);
      setColleagues(data);
    } catch {
      setActionError("دریافت فهرست همکاران با مشکل مواجه شد.");
    } finally {
      setColleaguesLoading(false);
    }
  };

  const submitRefer = async () => {
    if (!selected || selectedColleagueIds.length === 0) return;
    setActionLoading(true);
    setActionError("");
    try {
      let data: SubmissionDetail;
      if (referAttachment) {
        const formData = new FormData();
        selectedColleagueIds.forEach((id) => {
          formData.append("to_user_ids", String(id));
        });
        mentionedColleagueIds.forEach((id) => {
          formData.append("cc_user_ids", String(id));
        });
        formData.append("note", referNote.trim());
        formData.append(
          "allow_repeat",
          String((selected.referrals?.length ?? 0) > 0),
        );
        formData.append("attachment", referAttachment);
        const response = await client.post<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/refer`,
          formData,
        );
        data = response.data;
      } else {
        const response = await client.post<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/refer`,
          {
            to_user_ids: selectedColleagueIds,
            cc_user_ids: mentionedColleagueIds,
            note: referNote.trim(),
            allow_repeat: (selected.referrals?.length ?? 0) > 0,
          },
        );
        data = response.data;
      }
      syncTask(data);
      setSelected((prev) => (prev ? { ...data, data: prev.data } : data));
      setReferOpen(false);
      setSelectedColleagueIds([]);
      setMentionedColleagueIds([]);
      setReferAttachment(null);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch (err: unknown) {
      setActionError(apiErrorDetail(err, "ارجاع درخواست با مشکل مواجه شد."));
    } finally {
      setActionLoading(false);
    }
  };

  const downloadAuthFile = async (url: string, fileName: string) => {
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setActionError("دانلود پیوست با مشکل مواجه شد.");
        return;
      }
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      setActionError("دانلود پیوست با مشکل مواجه شد.");
    }
  };

  const downloadAttachment = async (index = 0, fileName?: string) => {
    if (!selected) return;
    const names =
      selected.attachment_names?.length
        ? selected.attachment_names
        : selected.attachment_name
          ? [selected.attachment_name]
          : [];
    const name = fileName || names[index];
    if (!name) return;
    await downloadAuthFile(
      `${API_BASE}/tasks/${selected.id}/attachment?index=${index}`,
      name,
    );
  };

  const downloadStatusAttachment = async () => {
    if (!selected?.status_attachment_name) return;
    await downloadAuthFile(
      `${API_BASE}/tasks/${selected.id}/status-attachment`,
      selected.status_attachment_name,
    );
  };

  const downloadReferralAttachment = async (referral: ReferralItem) => {
    if (!selected || !referral.attachment_name) return;
    await downloadAuthFile(
      `${API_BASE}/tasks/${selected.id}/referrals/${referral.id}/attachment`,
      referral.attachment_name,
    );
  };

  const previouslyReferredColleagueIds = useMemo(
    () => new Set((selected?.referrals ?? []).map((item) => item.to_user_id)),
    [selected?.referrals],
  );

  const filteredColleagues = useMemo(() => {
    const q = colleagueQuery.trim().toLocaleLowerCase("fa");
    return colleagues.filter((user) => {
      if (!q) return true;
      const hay = [user.display_name, user.username, user.department, user.job_title]
        .join(" ")
        .toLocaleLowerCase("fa");
      return hay.includes(q);
    });
  }, [colleagues, colleagueQuery]);

  const mentionMatch = referNote.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase("fa") ?? "";
  const mentionCandidates = useMemo(() => {
    if (!mentionMatch) return [];
    return colleagues
      .filter(
        (user) =>
          !selectedColleagueIds.includes(user.id) &&
          !mentionedColleagueIds.includes(user.id),
      )
      .filter((user) => {
        if (!mentionQuery) return true;
        return [user.display_name, user.username, user.department, user.job_title]
          .join(" ")
          .toLocaleLowerCase("fa")
          .includes(mentionQuery);
      })
      .slice(0, 8);
  }, [
    colleagues,
    mentionMatch,
    mentionQuery,
    mentionedColleagueIds,
    selectedColleagueIds,
  ]);

  const mentionedColleagues = useMemo(
    () =>
      mentionedColleagueIds
        .map((id) => colleagues.find((user) => user.id === id))
        .filter((user): user is Colleague => Boolean(user)),
    [colleagues, mentionedColleagueIds],
  );

  const addMention = (user: Colleague) => {
    setMentionedColleagueIds((prev) =>
      prev.includes(user.id) ? prev : [...prev, user.id],
    );
    const label = user.display_name || user.username;
    setReferNote((prev) =>
      prev
        .replace(/@[^\s@]*$/, `@${label} `)
        .slice(0, REFERRAL_NOTE_MAX_LENGTH),
    );
  };

  const isRepeatReferral = previouslyReferredColleagueIds.size > 0;

  const visibleFields = useMemo(() => {
    if (!selected) return [];
    const isInternalLetter =
      selected.form_id === "management-letter-form" &&
      selected.data.letter_type === "internal";
    const fieldsByName = new Map(template?.fields.map((field) => [field.name, field]));
    return Object.entries(selected.data)
      .filter(([name, value]) => {
        if (
          isInternalLetter &&
          (name === "letter_number" || name === "sender" || name === "sender_detail")
        ) {
          return false;
        }
        if (
          name === "_report_id" ||
          name === "attachment" ||
          name === "attachments" ||
          name === "_attachments" ||
          name === "letter_batch_id" ||
          name === "letter_type" ||
          name === "recipient_id" ||
          name === "recipient_name"
        ) {
          return false;
        }
        if (name === "sender_detail" && (value == null || String(value).trim() === "")) {
          return false;
        }
        if (name === "due_date" && (value == null || String(value).trim() === "")) {
          return false;
        }
        return true;
      })
      .map(([name, value]) => ({ name, value, field: fieldsByName.get(name) }));
  }, [selected, template]);

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ListTodo size={25} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900">وظایف من</h2>
              <p className="mt-1 text-sm text-slate-500">
                درخواست‌هایی که بر اساس مسیریابی وظایف یا ارجاع به شما رسیده‌اند
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadTasks()}
          disabled={loading}
          className="h-10 gap-2 rounded-xl px-4"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
          به‌روزرسانی
        </Button>
      </div>

      {error && (
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="mb-6 grid gap-2 rounded-3xl border border-slate-100 bg-white p-2 shadow-md sm:grid-cols-2 lg:grid-cols-5">
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-extrabold ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count.toLocaleString("fa-IR")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <SlidersHorizontal size={18} className="text-red-600" />
              جستجو و فیلتر
            </div>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={resetFilters}
                className="gap-1.5 text-slate-500 hover:text-red-600"
              >
                <X size={15} />
                پاک کردن فیلترها
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="جستجوی عنوان، فرم یا ثبت‌کننده..."
                aria-label="جستجوی وظایف"
                className="h-11 rounded-xl pr-10"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setSectionFilter("all");
              }}
              aria-label="فیلتر دسته‌بندی سازمانی"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">همه دسته‌بندی‌ها</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.title}
                </option>
              ))}
            </select>

            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              aria-label="فیلتر نوع درخواست"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">همه نوع‌های درخواست</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>

            <select
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRange)}
              aria-label="فیلتر زمان ثبت"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">همه زمان‌ها</option>
              <option value="today">امروز</option>
              <option value="7days">۷ روز گذشته</option>
              <option value="30days">۳۰ روز گذشته</option>
              <option value="90days">۹۰ روز گذشته</option>
            </select>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              aria-label="ترتیب نمایش"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="newest">جدیدترین ابتدا</option>
              <option value="oldest">قدیمی‌ترین ابتدا</option>
            </select>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {filteredTasks.length.toLocaleString("fa-IR")} وظیفه از{" "}
            {tasks.length.toLocaleString("fa-IR")} وظیفه
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500">
          <Loader2 className="animate-spin" /> در حال دریافت وظایف...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
          <ListTodo className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-xl font-bold text-slate-700">هنوز وظیفه‌ای ندارید</h3>
          <p className="mt-2 text-slate-500">
            وقتی فرمی به شما مسیریابی یا ارجاع شود، اینجا نمایش داده می‌شود.
          </p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
          <Search className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-xl font-bold text-slate-700">
            در این بخش وظیفه‌ای نیست
          </h3>
          <p className="mt-2 text-slate-500">
            عبارت جستجو، فیلترها یا زبانه وضعیت را تغییر دهید.
          </p>
          <Button variant="outline" onClick={resetFilters} className="mt-5 rounded-xl px-5">
            پاک کردن فیلترها
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredTasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => void openTask(task)}
              aria-label={`${task.subject || task.section_title || task.form_title}${
                task.is_read === false
                  ? "\u060c \u062c\u062f\u06cc\u062f \u0648 \u062f\u06cc\u062f\u0647\u200c\u0646\u0634\u062f\u0647"
                  : ""
              }`}
              className={`group relative rounded-3xl border p-6 text-right shadow-md transition hover:-translate-y-1 hover:shadow-xl disabled:opacity-60 ${
                task.is_read === false
                  ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200/80 shadow-amber-100"
                  : "border-slate-100 bg-white hover:border-red-100"
              }`}
              disabled={detailLoading}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FileText size={21} />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {task.is_read === false && (
                    <Badge
                      variant="outline"
                      className="gap-1.5 border-amber-300 bg-amber-100 font-extrabold text-amber-900"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full bg-amber-600"
                      />
                      {"\u062c\u062f\u06cc\u062f"}
                    </Badge>
                  )}
                  {(task.referrals?.length ?? 0) > 0 && (
                    <Badge
                      variant="outline"
                      className="border-sky-200 bg-sky-50 text-sky-700"
                    >
                      ارجاع‌شده
                    </Badge>
                  )}
                  <Badge variant="outline" className={statusBadgeClass(task.status)}>
                    {displayStatus(task.status)}
                  </Badge>
                </div>
              </div>
              <h3 className="line-clamp-2 text-lg font-bold text-slate-800">
                {task.subject || task.section_title || task.form_title}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {task.section_title || task.form_title}
              </p>
              {task.department_title && (
                <p className="mt-1 text-xs text-slate-400">{task.department_title}</p>
              )}
              {task.submitted_by && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <UserRound size={13} />
                  ثبت‌کننده: {task.submitted_by}
                </p>
              )}
              {(initialAssigneeNames(task).length > 0 ||
                referralTargetNames(task).length > 0) && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50/80 px-3 py-2.5 text-xs">
                  {initialAssigneeNames(task).length > 0 && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <UserRound
                        size={13}
                        className="shrink-0 text-slate-500"
                        aria-hidden="true"
                      />
                      <span className="shrink-0 text-slate-500">
                        {task.form_id === "management-letter-form"
                          ? "\u06af\u06cc\u0631\u0646\u062f\u06af\u0627\u0646 \u0646\u0627\u0645\u0647:"
                          : "\u0645\u0633\u0626\u0648\u0644\u0627\u0646 \u0627\u0648\u0644\u06cc\u0647:"}
                      </span>
                      <span
                        className="min-w-0 truncate font-semibold text-slate-700"
                        title={initialAssigneeNames(task).join("\u060c ")}
                      >
                        {compactNames(initialAssigneeNames(task))}
                      </span>
                    </p>
                  )}
                  {referralTargetNames(task).length > 0 && (
                    <p className="flex min-w-0 items-center gap-1.5 text-sky-700">
                      <Forward size={13} className="shrink-0" aria-hidden="true" />
                      <span className="shrink-0">
                        {"\u0627\u0631\u062c\u0627\u0639\u200c\u0634\u062f\u0647 \u0628\u0647:"}
                      </span>
                      <span
                        className="min-w-0 truncate font-bold"
                        title={referralTargetNames(task).join("\u060c ")}
                      >
                        {compactNames(referralTargetNames(task))}
                      </span>
                    </p>
                  )}
                </div>
              )}
              {(task.jira_issue_key || task.jira_status) && (
                <div className="mt-3 grid gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs sm:grid-cols-2">
                  {task.jira_issue_key && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-slate-500">شماره Jira:</span>
                      <span dir="ltr" className="min-w-0 truncate font-bold text-blue-700" title={task.jira_issue_key}>
                        {task.jira_issue_key}
                      </span>
                    </p>
                  )}
                  {task.jira_status && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-slate-500">وضعیت Jira:</span>
                      <span className="min-w-0 truncate font-semibold text-slate-700" title={task.jira_status}>
                        {task.jira_status}
                      </span>
                    </p>
                  )}
                </div>
              )}
              {(task.status === "in_progress" ||
                task.status === "approved" ||
                normalizedProgress(task.progress_percent, task.status) > 0) && (
                <TaskProgress
                  compact
                  progress={task.progress_percent}
                  status={task.status}
                />
              )}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {formatPersianDateTime(task.created_at)}
                </span>
                <span className="flex items-center gap-1 font-medium text-red-600">
                  مشاهده جزئیات <ChevronLeft size={15} />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={() => {
            setSelected(null);
            setReferOpen(false);
            setStatusPanel(null);
            setStatusNote("");
            setStatusAttachment(null);
            setReferAttachment(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="جزئیات وظیفه"
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white/95 p-6 backdrop-blur">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusBadgeClass(selected.status)}>
                    {displayStatus(selected.status)}
                  </Badge>
                  {(selected.referrals?.length ?? 0) > 0 && (
                    <Badge
                      variant="outline"
                      className="border-sky-200 bg-sky-50 text-sky-700"
                    >
                      ارجاع‌شده
                    </Badge>
                  )}
                  <span className="text-xs text-slate-400">
                    شناسه درخواست: {selected.id}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {selected.subject || selected.section_title || selected.form_title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.department_title} /{" "}
                  {selected.section_title || selected.form_title}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(null);
                  setReferOpen(false);
                  setStatusPanel(null);
                  setStatusNote("");
                  setStatusAttachment(null);
                  setReferAttachment(null);
                }}
                className="shrink-0 rounded-xl"
              >
                بستن
              </Button>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              {actionError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              <TaskProgress
                progress={selected.progress_percent}
                status={selected.status}
              />

              {selected.can_act && (
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  {(selected.status === "submitted" ||
                    selected.status === "in_progress") && (
                    <div className="space-y-3 rounded-xl border border-blue-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <label
                            htmlFor={`task-progress-${selected.id}`}
                            className="text-sm font-bold text-slate-800"
                          >
                            {"\u062f\u0631\u0635\u062f \u067e\u06cc\u0634\u0631\u0641\u062a"}
                          </label>
                          <p className="mt-1 text-xs text-slate-500">
                            {"\u062a\u06a9\u0645\u06cc\u0644 \u0646\u0647\u0627\u06cc\u06cc \u0641\u0642\u0637 \u0628\u0627 \u062f\u06a9\u0645\u0647 \u00ab\u0627\u0646\u062c\u0627\u0645 \u0634\u062f\u0647\u00bb \u062b\u0628\u062a \u0645\u06cc\u200c\u0634\u0648\u062f."}
                          </p>
                        </div>
                        <span
                          dir="ltr"
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-extrabold tabular-nums text-blue-700"
                        >
                          {progressDraft}%
                        </span>
                      </div>
                      <input
                        id={`task-progress-${selected.id}`}
                        type="range"
                        min={0}
                        max={99}
                        step={1}
                        value={progressDraft}
                        dir="ltr"
                        aria-valuetext={`${progressDraft} \u062f\u0631\u0635\u062f`}
                        onChange={(event) => setProgressDraft(Number(event.target.value))}
                        className="h-2 w-full cursor-pointer accent-blue-600"
                      />
                      <Textarea
                        value={progressNote}
                        maxLength={512}
                        onChange={(event) => setProgressNote(event.target.value)}
                        placeholder={"\u062a\u0648\u0636\u06cc\u062d \u067e\u06cc\u0634\u0631\u0641\u062a \u0628\u0631\u0627\u06cc \u0627\u0631\u0633\u0627\u0644\u200c\u06a9\u0646\u0646\u062f\u0647 (\u0627\u062e\u062a\u06cc\u0627\u0631\u06cc)"}
                        className="min-h-20 rounded-xl bg-slate-50"
                      />
                      <div className="space-y-2">
                        <label
                          htmlFor={`task-progress-attachment-${selected.id}`}
                          className="block text-xs font-semibold text-slate-600"
                        >
                          {"\u067e\u06cc\u0648\u0633\u062a \u067e\u06cc\u0634\u0631\u0641\u062a (\u0627\u062e\u062a\u06cc\u0627\u0631\u06cc\u060c \u062d\u062f\u0627\u06a9\u062b\u0631 \u06f1\u06f5 \u0645\u06af\u0627\u0628\u0627\u06cc\u062a)"}
                        </label>
                        <Input
                          id={`task-progress-attachment-${selected.id}`}
                          type="file"
                          onChange={(event) =>
                            setProgressAttachment(event.target.files?.[0] ?? null)
                          }
                          className="h-10 rounded-xl bg-slate-50 file:ml-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-blue-700"
                        />
                        {progressAttachment ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <Paperclip size={14} className="text-blue-600" />
                            <span className="font-semibold">{progressAttachment.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setProgressAttachment(null)}
                              className="h-7 px-2 text-slate-500"
                            >
                              {"\u062d\u0630\u0641"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={99}
                          step={1}
                          value={progressDraft}
                          dir="ltr"
                          aria-label="\u062f\u0631\u0635\u062f \u062f\u0642\u06cc\u0642 \u067e\u06cc\u0634\u0631\u0641\u062a"
                          onChange={(event) =>
                            setProgressDraft(
                              Math.min(
                                99,
                                Math.max(0, Math.round(Number(event.target.value) || 0)),
                              ),
                            )
                          }
                          className="h-10 w-24 rounded-xl text-left"
                        />
                        <Button
                          type="button"
                          onClick={() => void updateProgress()}
                          disabled={
                            actionLoading ||
                            (selected.status === "in_progress" &&
                              progressDraft ===
                                normalizedProgress(
                                  selected.progress_percent,
                                  selected.status,
                                ) &&
                              !progressNote.trim() &&
                              !progressAttachment)
                          }
                          className="h-10 gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          {"\u062b\u0628\u062a \u067e\u06cc\u0634\u0631\u0641\u062a"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-slate-500">
                    تغییر وضعیت درخواست
                    {selected.status !== "submitted" ? " (در صورت اشتباه قابل اصلاح است)" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => openStatusPanel("approved")}
                      disabled={actionLoading || selected.status === "approved"}
                      className={`gap-2 ${
                        selected.status === "approved"
                          ? "bg-emerald-700 hover:bg-emerald-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {actionLoading && statusPanel === "approved" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      انجام شده
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openStatusPanel("rejected")}
                      disabled={actionLoading || selected.status === "rejected"}
                      className={`gap-2 ${
                        selected.status === "rejected"
                          ? "border-red-300 bg-red-100 text-red-800"
                          : "border-red-200 text-red-700 hover:bg-red-50"
                      }`}
                    >
                      <XCircle className="h-4 w-4" />
                      {selected.status === "rejected" ? "رد شده" : "رد"}
                    </Button>
                    {selected.status !== "submitted" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void updateStatus("submitted")}
                        disabled={actionLoading}
                        className="gap-2 border-amber-200 text-amber-800 hover:bg-amber-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        بازگشت به اقدام‌نشده
                      </Button>
                    )}
                    {(selected.status === "submitted" ||
                      selected.status === "in_progress") && (
                      <Button
                        type="button"
                        onClick={() => void openReferPanel()}
                        disabled={actionLoading}
                        className="gap-2 bg-sky-600 font-bold text-white hover:bg-sky-700"
                      >
                        <Forward className="h-4 w-4" />
                        {isRepeatReferral ? "ارجاع مجدد" : "ارجاع"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {statusPanel && selected.can_act && (
                <div
                  className={`space-y-3 rounded-2xl border p-4 ${
                    statusPanel === "approved"
                      ? "border-emerald-100 bg-emerald-50/60"
                      : "border-red-100 bg-red-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {statusPanel === "approved"
                        ? "ثبت انجام شده"
                        : "ثبت رد درخواست"}
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setStatusPanel(null);
                        setStatusNote("");
                        setStatusAttachment(null);
                      }}
                      className="h-8 px-2 text-slate-500"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                  <Textarea
                    value={statusNote}
                    onChange={(event) => setStatusNote(event.target.value)}
                    placeholder="توضیح یا یادداشت خود را بنویسید (اختیاری)"
                    className="min-h-24 rounded-xl bg-white"
                  />
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      پیوست (اختیاری)
                    </label>
                    <Input
                      type="file"
                      onChange={(event) =>
                        setStatusAttachment(event.target.files?.[0] ?? null)
                      }
                      className="h-10 rounded-xl bg-white file:ml-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold"
                    />
                    {statusAttachment ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <Paperclip size={14} className="text-slate-500" />
                        <span className="font-semibold">{statusAttachment.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setStatusAttachment(null)}
                          className="h-7 px-2 text-slate-500"
                        >
                          حذف
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={() => void submitStatusAction()}
                    disabled={actionLoading}
                    className={`gap-2 ${
                      statusPanel === "approved"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : statusPanel === "approved" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {statusPanel === "approved" ? "ثبت انجام شده" : "ثبت رد"}
                  </Button>
                </div>
              )}

              {referOpen &&
                selected.can_act &&
                (selected.status === "submitted" ||
                  selected.status === "in_progress") && (
                <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {isRepeatReferral ? "ارجاع مجدد به همکاران" : "ارجاع به همکاران"}
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setReferOpen(false);
                        setReferAttachment(null);
                      }}
                      className="h-8 px-2 text-slate-500"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    می‌توانید چند نفر را همزمان انتخاب کنید.
                    {selectedColleagueIds.length > 0
                      ? ` (${selectedColleagueIds.length.toLocaleString("fa-IR")} نفر انتخاب شده)`
                      : ""}
                  </p>
                  <Input
                    value={colleagueQuery}
                    onChange={(event) => setColleagueQuery(event.target.value)}
                    placeholder="جستجوی نام همکار..."
                    className="h-10 rounded-xl bg-white"
                  />
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                    {colleaguesLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        در حال دریافت...
                      </div>
                    ) : filteredColleagues.length === 0 ? (
                      <p className="px-2 py-6 text-center text-sm text-slate-500">
                        همکاری یافت نشد.
                      </p>
                    ) : (
                      filteredColleagues.map((user) => {
                        const selectedUser = selectedColleagueIds.includes(user.id);
                        const previouslyReferred = previouslyReferredColleagueIds.has(
                          user.id,
                        );
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleColleague(user.id)}
                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm transition ${
                              selectedUser
                                ? "bg-red-50 text-red-700"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <span className="font-medium">
                              <UserDisplayName user={user} />
                            </span>
                            <span className="flex flex-wrap items-center justify-end gap-1.5 text-xs text-slate-500">
                              {previouslyReferred && (
                                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                                  قبلاً ارجاع شده
                                </span>
                              )}
                              <span>
                                {selectedUser
                                  ? "انتخاب‌شده"
                                  : user.job_title || user.department || user.username}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <Textarea
                    value={referNote}
                    onChange={(event) => setReferNote(event.target.value)}
                    placeholder="یادداشت ارجاع (اختیاری)"
                    className="min-h-20 rounded-xl bg-white"
                    maxLength={REFERRAL_NOTE_MAX_LENGTH}
                    aria-describedby="referral-note-character-count"
                  />
                  <p
                    id="referral-note-character-count"
                    className="text-left text-xs tabular-nums text-slate-500"
                    aria-live="polite"
                  >
                    {referNote.length.toLocaleString("fa-IR")} {"\u0627\u0632"}{" "}
                    {REFERRAL_NOTE_MAX_LENGTH.toLocaleString("fa-IR")} {"\u06a9\u0627\u0631\u0627\u06a9\u062a\u0631"}
                  </p>
                  <div className="relative space-y-2">
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <AtSign size={14} className="text-sky-600" />
                      {"\u0628\u0631\u0627\u06cc \u0631\u0648\u0646\u0648\u0634\u062a (CC) \u0648 \u0646\u0645\u0627\u06cc\u0634 \u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0628\u0631\u0627\u06cc \u062f\u06cc\u06af\u0631\u0627\u0646\u060c @ \u062a\u0627\u06cc\u067e \u06a9\u0646\u06cc\u062f."}
                    </p>
                    {mentionMatch && (
                      <div className="max-h-44 overflow-y-auto rounded-xl border border-sky-200 bg-white p-1.5 shadow-lg">
                        {mentionCandidates.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-slate-500">
                            {"\u0647\u0645\u06a9\u0627\u0631\u06cc \u0628\u0631\u0627\u06cc \u0631\u0648\u0646\u0648\u0634\u062a \u06cc\u0627\u0641\u062a \u0646\u0634\u062f."}
                          </p>
                        ) : (
                          mentionCandidates.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => addMention(user)}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm hover:bg-sky-50"
                            >
                              <span className="flex items-center gap-2 font-semibold text-slate-700">
                                <AtSign size={14} className="text-sky-600" />
                                <UserDisplayName user={user} />
                              </span>
                              <span className="text-xs text-slate-400">
                                {user.job_title || user.department || user.username}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {mentionedColleagues.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {mentionedColleagues.map((user) => (
                          <span
                            key={user.id}
                            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700"
                          >
                            @{user.display_name || user.username}
                            <button
                              type="button"
                              aria-label="Remove CC recipient"
                              onClick={() =>
                                setMentionedColleagueIds((prev) =>
                                  prev.filter((id) => id !== user.id),
                                )
                              }
                              className="rounded-full p-0.5 hover:bg-sky-100"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      پیوست (اختیاری)
                    </label>
                    <Input
                      type="file"
                      onChange={(event) =>
                        setReferAttachment(event.target.files?.[0] ?? null)
                      }
                      className="h-10 rounded-xl bg-white file:ml-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold"
                    />
                    {referAttachment ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <Paperclip size={14} className="text-slate-500" />
                        <span className="font-semibold">{referAttachment.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setReferAttachment(null)}
                          className="h-7 px-2 text-slate-500"
                        >
                          حذف
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={() => void submitRefer()}
                    disabled={actionLoading || selectedColleagueIds.length === 0}
                    className="gap-2"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Forward className="h-4 w-4" />
                    )}
                    {isRepeatReferral ? "ثبت ارجاع مجدد" : "ثبت ارجاع"}
                  </Button>
                </div>
              )}

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">تاریخ ثبت:</span>{" "}
                  <span className="font-semibold text-slate-700">
                    {formatPersianDateTime(selected.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">نوع فرم:</span>{" "}
                  <span className="font-semibold text-slate-700">{selected.form_title}</span>
                </div>
                {(selected.jira_issue_key || selected.jira_status) && (
                  <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-bold uppercase text-slate-500">Jira</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selected.jira_issue_key && (
                        <div>
                          <span className="text-slate-500">Jira Issue:</span>{" "}
                          <span className="font-semibold text-slate-700">
                            {selected.jira_issue_key}
                          </span>
                        </div>
                      )}
                      {selected.jira_status && (
                        <div>
                          <span className="text-slate-500">Jira Status:</span>{" "}
                          <span className="whitespace-pre-wrap font-semibold text-slate-700">
                            {selected.jira_status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {initialAssigneeNames(selected).length > 0 && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <UserRound
                      size={16}
                      className="mt-0.5 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                    <span className="shrink-0 text-slate-500">
                      {selected.form_id === "management-letter-form"
                        ? "\u06af\u06cc\u0631\u0646\u062f\u06af\u0627\u0646 \u0646\u0627\u0645\u0647:"
                        : "\u0645\u0633\u0626\u0648\u0644\u0627\u0646 \u0627\u0648\u0644\u06cc\u0647:"}
                    </span>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {initialAssigneeNames(selected).map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {referralTargetNames(selected).length > 0 && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <Forward
                      size={16}
                      className="mt-0.5 shrink-0 text-sky-600"
                      aria-hidden="true"
                    />
                    <span className="shrink-0 text-slate-500">
                      {"\u0627\u0631\u062c\u0627\u0639\u200c\u0634\u062f\u0647 \u0628\u0647:"}
                    </span>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {referralTargetNames(selected).map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {ccRecipientNames(selected).length > 0 && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <AtSign
                      size={16}
                      className="mt-0.5 shrink-0 text-violet-600"
                      aria-hidden="true"
                    />
                    <span className="shrink-0 text-slate-500">
                      {"\u0631\u0648\u0646\u0648\u0634\u062a (CC):"}
                    </span>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {ccRecipientNames(selected).map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700"
                        >
                          @{name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selected.submitted_by && (
                  <div>
                    <span className="text-slate-500">ثبت‌کننده:</span>{" "}
                    <span className="font-semibold text-slate-700">
                      {selected.submitted_by}
                    </span>
                  </div>
                )}
                {selected.status_updated_by && (
                  <div>
                    <span className="text-slate-500">تعیین وضعیت توسط:</span>{" "}
                    <span className="font-semibold text-slate-700">
                      {selected.status_updated_by}
                      {selected.status_updated_at
                        ? ` (${formatPersianDateTime(selected.status_updated_at)})`
                        : ""}
                    </span>
                  </div>
                )}
                {selected.status_note &&
                  (selected.status === "approved" || selected.status === "rejected") && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">یادداشت وضعیت:</span>{" "}
                      <span className="whitespace-pre-wrap font-semibold text-slate-700">
                        {selected.status_note}
                      </span>
                    </div>
                  )}
                {selected.status_attachment_name &&
                  (selected.status === "approved" || selected.status === "rejected") && (
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <Paperclip size={16} className="text-emerald-600" />
                      <span className="text-slate-500">پیوست وضعیت:</span>
                      <button
                        type="button"
                        onClick={() => void downloadStatusAttachment()}
                        className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        {selected.status_attachment_name}
                      </button>
                    </div>
                  )}
                {(selected.attachment_names?.length
                  ? selected.attachment_names
                  : selected.attachment_name
                    ? [selected.attachment_name]
                    : []
                ).length > 0 && (
                  <div className="flex flex-wrap items-start gap-2 sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <Paperclip size={16} className="text-red-500" />
                      <span className="text-slate-500">پیوست‌ها:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(selected.attachment_names?.length
                        ? selected.attachment_names
                        : selected.attachment_name
                          ? [selected.attachment_name]
                          : []
                      ).map((name, index) => (
                        <button
                          key={`${name}-${index}`}
                          type="button"
                          onClick={() => void downloadAttachment(index, name)}
                          className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(selected.referrals?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700">سوابق ارجاع</h4>
                  <div className="flex flex-wrap gap-2">
                    {selected.referrals?.map((referral) => (
                      <div
                        key={referral.id}
                        className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900"
                      >
                        <div>
                          از {referral.from_user_name} ← به {referral.to_user_name}
                        </div>
                        {referral.note ? (
                          <div className="mt-1 text-sky-700">{referral.note}</div>
                        ) : null}
                        {referral.attachment_name ? (
                          <button
                            type="button"
                            onClick={() => void downloadReferralAttachment(referral)}
                            className="mt-1 inline-flex items-center gap-1 font-semibold text-sky-700 underline-offset-2 hover:underline"
                          >
                            <Paperclip size={12} />
                            {referral.attachment_name}
                          </button>
                        ) : null}
                        <div className="mt-1 text-sky-600">
                          {formatPersianDateTime(referral.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {visibleFields.map(({ name, value, field }) => (
                  <div key={name} className="rounded-2xl border border-slate-100 p-4">
                    <div className="mb-2 text-sm font-semibold text-slate-500">
                      {field?.label ?? name}
                    </div>
                    <div className="text-slate-800">{displayValue(value, field)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/20">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl">
            <Loader2 className="animate-spin text-red-600" />
            در حال دریافت جزئیات...
          </div>
        </div>
      )}
    </AppShell>
  );
}
