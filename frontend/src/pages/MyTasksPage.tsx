import { useEffect, useMemo, useState } from "react";
import {
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
import { API_BASE, FormField, FormTemplate } from "../config/portal";
import { formatPersianDateTime } from "../lib/persianDate";
import UserDisplayName from "../components/UserDisplayName";

type ReferralItem = {
  id: number;
  from_user_id: number;
  from_user_name: string;
  to_user_id: number;
  to_user_name: string;
  note: string;
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
  attachment_name: string | null;
  attachment_names?: string[];
  created_at: string;
  submitted_by?: string;
  submitted_by_username?: string;
  status_updated_by?: string | null;
  status_updated_at?: string | null;
  referrals?: ReferralItem[];
  can_act?: boolean;
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

type TimeRange = "all" | "today" | "7days" | "30days" | "90days";
type SortOrder = "newest" | "oldest";
type StatusTab = "pending" | "rejected" | "approved" | "referred";

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "pending", label: "اقدام نشده" },
  { id: "rejected", label: "رد شده" },
  { id: "approved", label: "انجام شده" },
  { id: "referred", label: "ارجاع شده" },
];

function parseSubmittedAt(value: string) {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function displayStatus(status: string) {
  if (status === "approved") return "انجام‌شده";
  if (status === "rejected") return "رد‌شده";
  if (status === "submitted") return "اقدام‌نشده";
  return status || "اقدام‌نشده";
}

function statusBadgeClass(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function matchesStatusTab(task: SubmissionListItem, tab: StatusTab) {
  if (tab === "pending") return task.status === "submitted";
  if (tab === "rejected") return task.status === "rejected";
  if (tab === "approved") return task.status === "approved";
  return (task.referrals?.length ?? 0) > 0;
}

function statusActionLabel(status: "approved" | "rejected" | "submitted") {
  if (status === "approved") return "تایید / انجام‌شده";
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
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [colleagueQuery, setColleagueQuery] = useState("");
  const [selectedColleagueId, setSelectedColleagueId] = useState<number | null>(null);
  const [referNote, setReferNote] = useState("");
  const [colleaguesLoading, setColleaguesLoading] = useState(false);

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
    return Array.from(items, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "fa"),
    );
  }, [tasks, departmentFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      pending: 0,
      rejected: 0,
      approved: 0,
      referred: 0,
    };
    tasks.forEach((task) => {
      if (task.status === "submitted") counts.pending += 1;
      if (task.status === "rejected") counts.rejected += 1;
      if (task.status === "approved") counts.approved += 1;
      if ((task.referrals?.length ?? 0) > 0) counts.referred += 1;
    });
    return counts;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("fa");
    const now = new Date();
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
        ]
          .join(" ")
          .toLocaleLowerCase("fa");

        if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false;
        if (departmentFilter !== "all" && task.department_id !== departmentFilter) {
          return false;
        }
        if (
          sectionFilter !== "all" &&
          `${task.department_id}::${task.section_id}` !== sectionFilter
        ) {
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
      setSelected(detailResponse.data);
      setTemplate(templateResponse.data);
    } catch {
      setError("نمایش جزئیات این وظیفه با مشکل مواجه شد.");
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (status: "approved" | "rejected" | "submitted") => {
    if (!selected || selected.status === status) return;
    const label = statusActionLabel(status);
    if (!window.confirm(`آیا از تغییر وضعیت به «${label}» مطمئن هستید؟`)) return;

    setActionLoading(true);
    setActionError("");
    try {
      const { data } = await client.patch<SubmissionDetail>(
        `${endpoints.tasks}/${selected.id}/status`,
        { status },
      );
      syncTask(data);
      setSelected((prev) => (prev ? { ...data, data: prev.data } : data));
      if (status !== "submitted") setReferOpen(false);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch (err: unknown) {
      setActionError(apiErrorDetail(err, `تغییر وضعیت با مشکل مواجه شد.`));
    } finally {
      setActionLoading(false);
    }
  };

  const openReferPanel = async () => {
    setReferOpen(true);
    setActionError("");
    setColleagueQuery("");
    setSelectedColleagueId(null);
    setReferNote("");
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
    if (!selected || selectedColleagueId == null) return;
    setActionLoading(true);
    setActionError("");
    try {
      const { data } = await client.post<SubmissionDetail>(
        `${endpoints.tasks}/${selected.id}/refer`,
        { to_user_id: selectedColleagueId, note: referNote.trim() },
      );
      syncTask(data);
      setSelected((prev) => (prev ? { ...data, data: prev.data } : data));
      setReferOpen(false);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch (err: unknown) {
      setActionError(apiErrorDetail(err, "ارجاع درخواست با مشکل مواجه شد."));
    } finally {
      setActionLoading(false);
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
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(
        `${API_BASE}/tasks/${selected.id}/attachment?index=${index}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        setActionError("دانلود پیوست با مشکل مواجه شد.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setActionError("دانلود پیوست با مشکل مواجه شد.");
    }
  };

  const filteredColleagues = useMemo(() => {
    const q = colleagueQuery.trim().toLocaleLowerCase("fa");
    const alreadyReferred = new Set(
      (selected?.referrals || []).map((item) => item.to_user_id),
    );
    return colleagues.filter((user) => {
      if (alreadyReferred.has(user.id)) return false;
      if (!q) return true;
      const hay = [user.display_name, user.username, user.department, user.job_title]
        .join(" ")
        .toLocaleLowerCase("fa");
      return hay.includes(q);
    });
  }, [colleagues, colleagueQuery, selected?.referrals]);

  const visibleFields = useMemo(() => {
    if (!selected) return [];
    const fieldsByName = new Map(template?.fields.map((field) => [field.name, field]));
    return Object.entries(selected.data)
      .filter(([name, value]) => {
        if (
          name === "_report_id" ||
          name === "attachment" ||
          name === "attachments" ||
          name === "_attachments" ||
          name === "letter_batch_id" ||
          name === "recipient_id" ||
          name === "recipient_name"
        ) {
          return false;
        }
        if (name === "sender_detail" && (value == null || String(value).trim() === "")) {
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
        <div className="mb-6 grid gap-2 rounded-3xl border border-slate-100 bg-white p-2 shadow-md sm:grid-cols-2 lg:grid-cols-4">
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
              className="group rounded-3xl border border-slate-100 bg-white p-6 text-right shadow-md transition hover:-translate-y-1 hover:border-red-100 hover:shadow-xl disabled:opacity-60"
              disabled={detailLoading}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FileText size={21} />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
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

              {selected.can_act && (
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    تغییر وضعیت درخواست
                    {selected.status !== "submitted" ? " (در صورت اشتباه قابل اصلاح است)" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void updateStatus("approved")}
                      disabled={actionLoading || selected.status === "approved"}
                      className={`gap-2 ${
                        selected.status === "approved"
                          ? "bg-emerald-700 hover:bg-emerald-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {selected.status === "approved" ? "انجام‌شده" : "تایید"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void updateStatus("rejected")}
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
                    {selected.status === "submitted" && (
                      <Button
                        type="button"
                        onClick={() => void openReferPanel()}
                        disabled={actionLoading}
                        className="gap-2 bg-sky-600 font-bold text-white hover:bg-sky-700"
                      >
                        <Forward className="h-4 w-4" />
                        ارجاع
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {referOpen && selected.can_act && selected.status === "submitted" && (
                <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-800">ارجاع به همکار</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setReferOpen(false)}
                      className="h-8 px-2 text-slate-500"
                    >
                      <X size={16} />
                    </Button>
                  </div>
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
                      filteredColleagues.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedColleagueId(user.id)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm transition ${
                            selectedColleagueId === user.id
                              ? "bg-red-50 text-red-700"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="font-medium">
                            <UserDisplayName user={user} />
                          </span>
                          <span className="text-xs text-slate-500">
                            {user.job_title || user.department || user.username}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <Input
                    value={referNote}
                    onChange={(event) => setReferNote(event.target.value)}
                    placeholder="یادداشت ارجاع (اختیاری)"
                    className="h-10 rounded-xl bg-white"
                  />
                  <Button
                    type="button"
                    onClick={() => void submitRefer()}
                    disabled={actionLoading || selectedColleagueId == null}
                    className="gap-2"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Forward className="h-4 w-4" />
                    )}
                    ثبت ارجاع
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
