import { NativeSelect } from "@/components/ui/native-select";
import { Table } from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Forward,
  Grid2X2,
  Loader2,
  Paperclip,
  RefreshCw,
  Rows3,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import AppShell from "@/components/layout/AppShell";
import TaskConversation from "@/components/tasks/TaskConversation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE, FormField, FormTemplate } from "@/config/portal";
import { useAuth } from "@/context/AuthContext";
import {
  formatPersianDateTime,
  getTehranNowDate,
} from "@/lib/persianDate";

import {
  INTERNAL_LETTERS_FILTER,
  INTERNAL_LETTERS_TITLE,
  STATUS_TABS,
  WORKFLOW_STATUS_META,
} from "../constants";
import type {
  SortOrder,
  StatusTab,
  SubmissionDetail,
  SubmissionListItem,
  TimeRange,
  TimelineItem,
  ViewMode,
  WorkflowStatus,
} from "../types";
import {
  compactNames,
  downloadWithAuth,
  isInternalLetterRequest,
  normalizedProgress,
  parseSubmittedAt,
  parseTimelineEntityId,
  timelineEventDotClass,
  timelineEventLabel,
  uniqueNames,
  workflowStatusMeta,
  workflowStepIndex,
} from "../utils";

function WorkflowStatusIcon({
  status,
  size = 15,
}: {
  status: WorkflowStatus;
  size?: number;
}) {
  if (status === "unseen") return <EyeOff size={size} aria-hidden="true" />;
  if (status === "seen") return <Eye size={size} aria-hidden="true" />;
  if (status === "referred") return <Forward size={size} aria-hidden="true" />;
  if (status === "in_progress") return <Clock3 size={size} aria-hidden="true" />;
  if (status === "completed") return <CheckCircle2 size={size} aria-hidden="true" />;
  return <XCircle size={size} aria-hidden="true" />;
}

function WorkflowOverview({ status }: { status: WorkflowStatus }) {
  const currentStep = workflowStepIndex(status);
  const statusMeta = workflowStatusMeta(status);
  const steps = [
    "ثبت درخواست",
    "مشاهده توسط مسئول",
    status === "referred"
      ? "ارجاع به مسئول"
      : status === "in_progress"
        ? "در حال رسیدگی"
        : "رسیدگی درخواست",
    status === "completed"
      ? "انجام‌شده"
      : status === "rejected"
        ? "رد‌شده"
        : "نتیجه نهایی",
  ];

  return (
    <section
      aria-label="جایگاه فعلی درخواست در فرایند رسیدگی"
      className="rounded-3xl border border-border bg-muted/40 p-4 sm:p-5"
    >
      <div className="mb-5 flex items-start gap-3">
        <div
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border " +
            statusMeta.badgeClass
          }
        >
          <WorkflowStatusIcon status={status} size={19} />
        </div>
        <div>
          <h4 className="font-bold text-foreground">
            جایگاه فعلی: {statusMeta.label}
          </h4>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {statusMeta.description}
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((label, index) => {
          const passed = index < currentStep;
          const current = index === currentStep;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={[
                "flex min-h-20 items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold transition",
                passed
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : current
                    ? statusMeta.badgeClass
                    : "border-border bg-card text-muted-foreground",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                  passed
                    ? "bg-emerald-600 text-white"
                    : current
                      ? "bg-card/80"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {passed ? (
                  <CheckCircle2 size={15} aria-hidden="true" />
                ) : current ? (
                  <WorkflowStatusIcon status={status} size={14} />
                ) : (
                  (index + 1).toLocaleString("fa-IR")
                )}
              </span>
              <span className="leading-5">{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function displayValue(value: unknown, field?: FormField) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">ثبت نشده</span>;
  }

  if (field?.type === "select") {
    const option = field.options?.find((item) => item.value === String(value));
    return option?.label ?? String(value);
  }

  if (Array.isArray(value)) {
    const rows = value.filter(
      (row) => row && typeof row === "object" && Object.values(row).some(Boolean)
    ) as Record<string, unknown>[];
    if (!rows.length) return <span className="text-muted-foreground">ثبت نشده</span>;

    const columns = field?.columns?.length
      ? field.columns
      : Object.keys(rows[0]).map((key) => ({ key, title: key }));

    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-3 py-2 text-right font-semibold text-muted-foreground">
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-card">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-pre-wrap px-3 py-2 text-foreground">
                    {String(row[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }

  if (typeof value === "object") {
    return <pre className="overflow-x-auto text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

export default function MyRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SubmissionListItem[]>([]);
  const [selected, setSelected] = useState<SubmissionDetail | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const loadRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const allRequests: SubmissionListItem[] = [];
      const pageSize = 500;
      let offset = 0;

      while (true) {
        const { data } = await client.get<SubmissionListItem[]>(endpoints.submissions, {
          params: { limit: pageSize, offset },
        });
        allRequests.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      setRequests(allRequests);
    } catch {
      setError("دریافت درخواست‌ها با مشکل مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const departments = useMemo(() => {
    const items = new Map<string, string>();
    requests.forEach((request) => {
      if (request.department_id) {
        items.set(request.department_id, request.department_title || request.department_id);
      }
    });
    return Array.from(items, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "fa")
    );
  }, [requests]);

  const sections = useMemo(() => {
    const items = new Map<string, string>();
    const hasInternalLetters = requests.some(
      (request) =>
        (departmentFilter === "all" || request.department_id === departmentFilter) &&
        isInternalLetterRequest(request),
    );
    requests
      .filter(
        (request) =>
          departmentFilter === "all" || request.department_id === departmentFilter
      )
      .forEach((request) => {
        const key = `${request.department_id}::${request.section_id}`;
        if (request.section_id) {
          items.set(key, request.section_title || request.form_title);
        }
      });
    if (hasInternalLetters) {
      items.set(INTERNAL_LETTERS_FILTER, INTERNAL_LETTERS_TITLE);
    }
    return Array.from(items, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "fa")
    );
  }, [requests, departmentFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      all: requests.length,
      unseen: 0,
      seen: 0,
      referred: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
    };
    requests.forEach((request) => {
      if (request.workflow_status in WORKFLOW_STATUS_META) {
        counts[request.workflow_status] += 1;
      }
    });
    return counts;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("fa");
    const now = getTehranNowDate();
    let cutoff: Date | null = null;

    if (timeRange === "today") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeRange !== "all") {
      const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
      cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return requests
      .filter((request) => {
        if (statusTab !== "all" && request.workflow_status !== statusTab) return false;

        const searchableText = [
          request.id,
          request.subject,
          request.form_title,
          request.department_title,
          request.section_title,
          ...(request.initial_assignees ?? []).flatMap((assignee) => [
            assignee.display_name,
            assignee.username,
          ]),
          ...(request.referrals ?? []).flatMap((referral) => [
            referral.from_user_name,
            referral.to_user_name,
          ]),
        ]
          .join(" ")
          .toLocaleLowerCase("fa");

        if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false;
        if (
          departmentFilter !== "all" &&
          request.department_id !== departmentFilter
        ) {
          return false;
        }
        if (
          sectionFilter !== "all" &&
          sectionFilter !== INTERNAL_LETTERS_FILTER &&
          `${request.department_id}::${request.section_id}` !== sectionFilter
        ) {
          return false;
        }
        if (
          sectionFilter === INTERNAL_LETTERS_FILTER &&
          !isInternalLetterRequest(request)
        ) {
          return false;
        }
        if (cutoff) {
          const submittedAt = parseSubmittedAt(request.created_at);
          if (!submittedAt || submittedAt < cutoff) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = parseSubmittedAt(a.created_at)?.getTime() ?? 0;
        const bTime = parseSubmittedAt(b.created_at)?.getTime() ?? 0;
        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [
    requests,
    statusTab,
    searchQuery,
    departmentFilter,
    sectionFilter,
    timeRange,
    sortOrder,
  ]);

  const hasActiveFilters =
    statusTab !== "all" ||
    searchQuery !== "" ||
    departmentFilter !== "all" ||
    sectionFilter !== "all" ||
    timeRange !== "all" ||
    sortOrder !== "newest";

  const resetFilters = () => {
    setStatusTab("all");
    setSearchQuery("");
    setDepartmentFilter("all");
    setSectionFilter("all");
    setTimeRange("all");
    setSortOrder("newest");
  };

  const openRequest = async (request: SubmissionListItem) => {
    setDetailLoading(true);
    setError("");
    try {
      const detailResponse = await client.get<SubmissionDetail>(
        `${endpoints.submissions}/${request.id}`,
      );
      setSelected(detailResponse.data);
      setTemplate(null);

      // Historical details remain available if form access changed or the
      // original template is no longer available.
      void client
        .get<FormTemplate>(`${endpoints.forms}/${request.form_id}`, {
          params: {
            department: request.department_id,
            section: request.section_id,
          },
        })
        .then((response) => setTemplate(response.data))
        .catch(() => undefined);
    } catch {
      setError("نمایش جزئیات این درخواست با مشکل مواجه شد.");
    } finally {
      setDetailLoading(false);
    }
  };

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

  const selectedInitialAssigneeNames = selected
    ? uniqueNames(
        (selected.initial_assignees ?? []).map(
          (assignee) => assignee.display_name || assignee.username,
        ),
      )
    : [];
  const selectedReferralTargetNames = selected
    ? uniqueNames(
        (selected.referrals ?? []).map((referral) => referral.to_user_name),
      )
    : [];

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList size={25} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-foreground">
                {user?.is_admin ? "همه درخواست‌ها" : "درخواست‌های من"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.is_admin
                  ? "مشاهده و پایش درخواست‌های ثبت‌شده توسط همه کاربران"
                  : "فرم‌هایی که تاکنون ثبت کرده‌اید"}
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => void loadRequests()} disabled={loading} className="h-10 gap-2 rounded-xl px-4">
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
          به‌روزرسانی
        </Button>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary">{error}</div>}

      {!loading && requests.length > 0 && (
        <div
          role="tablist"
          aria-label="فیلتر درخواست‌ها بر اساس وضعیت"
          className="mb-6 flex gap-2 overflow-x-auto rounded-3xl border border-border bg-card p-2 shadow-md"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.id;
            const activeClass =
              tab.id === "all"
                ? "bg-slate-900 text-white shadow-slate-900/20"
                : workflowStatusMeta(tab.id).activeTabClass;
            return (
              <Button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusTab(tab.id)}
                className={[
                  "flex min-w-max items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2",
                  active
                    ? activeClass + " shadow-md"
                    : "text-muted-foreground hover:bg-muted/40",
                ].join(" ")}
              >
                <span>{tab.label}</span>
                <span
                  className={[
                    "min-w-7 rounded-full px-2 py-0.5 text-center text-xs font-extrabold",
                    active ? "bg-card/20 text-white" : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {tabCounts[tab.id].toLocaleString("fa-IR")}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <SlidersHorizontal size={18} className="text-primary" />
              جستجو و فیلتر
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                type="button"
                onClick={resetFilters}
                className="gap-1.5 text-muted-foreground hover:text-primary"
              >
                <X size={15} />
                پاک کردن فیلترها
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="جستجوی عنوان، فرم یا شناسه..."
                aria-label="جستجوی درخواست‌ها"
                className="h-11 rounded-xl pr-10"
              />
            </div>

            <NativeSelect
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setSectionFilter("all");
              }}
              aria-label="فیلتر دسته‌بندی سازمانی"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">همه دسته‌بندی‌ها</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.title}</option>
              ))}
            </NativeSelect>

            <NativeSelect
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              aria-label="فیلتر نوع درخواست"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">همه نوع‌های درخواست</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>{section.title}</option>
              ))}
            </NativeSelect>

            <NativeSelect
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRange)}
              aria-label="فیلتر زمان ثبت"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">همه زمان‌ها</option>
              <option value="today">امروز</option>
              <option value="7days">۷ روز گذشته</option>
              <option value="30days">۳۰ روز گذشته</option>
              <option value="90days">۹۰ روز گذشته</option>
            </NativeSelect>

            <NativeSelect
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              aria-label="ترتیب نمایش"
              className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="newest">جدیدترین ابتدا</option>
              <option value="oldest">قدیمی‌ترین ابتدا</option>
            </NativeSelect>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {filteredRequests.length.toLocaleString("fa-IR")} درخواست از {requests.length.toLocaleString("fa-IR")} درخواست
            </p>
            <div
              role="group"
              aria-label="نوع نمایش درخواست‌ها"
              className="flex items-center rounded-xl border border-border bg-muted/40 p-1"
            >
              <Button
                type="button"
                aria-pressed={viewMode === "cards"}
                onClick={() => setViewMode("cards")}
                className={[
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                  viewMode === "cards"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Grid2X2 size={15} aria-hidden="true" />
                کارت‌ها
              </Button>
              <Button
                type="button"
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
                className={[
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
                  viewMode === "table"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Rows3 size={16} aria-hidden="true" />
                جدول
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="animate-spin" /> در حال دریافت درخواست‌ها...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-14 text-center shadow-sm">
          <FileText className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-xl font-bold text-foreground">هنوز درخواستی ثبت نکرده‌اید</h3>
          <p className="mt-2 text-muted-foreground">پس از ثبت هر فرم، آن را در این صفحه خواهید دید.</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-14 text-center shadow-sm">
          <Search className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-xl font-bold text-foreground">درخواستی با این مشخصات پیدا نشد</h3>
          <p className="mt-2 text-muted-foreground">عبارت جستجو یا فیلترها را تغییر دهید.</p>
          <Button variant="outline" onClick={resetFilters} className="mt-5 rounded-xl px-5">
            پاک کردن فیلترها
          </Button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredRequests.map((request) => {
            const statusMeta = workflowStatusMeta(request.workflow_status);
            const progress = normalizedProgress(request.progress_percent);
            const showProgress =
              progress > 0 ||
              request.workflow_status === "in_progress" ||
              request.workflow_status === "completed";
            const requestTitle =
              request.subject || request.section_title || request.form_title;
            const initialAssigneeNames = uniqueNames(
              (request.initial_assignees ?? []).map(
                (assignee) => assignee.display_name || assignee.username,
              ),
            );
            const referralTargetNames = uniqueNames(
              (request.referrals ?? []).map((referral) => referral.to_user_name),
            );
            return (
              <Button
                variant="ghost"
                type="button"
                key={request.id}
                onClick={() => void openRequest(request)}
                aria-label={
                  "مشاهده جزئیات درخواست " +
                  requestTitle +
                  "، وضعیت " +
                  statusMeta.label +
                  "، ارسال اولیه به " +
                  compactNames(initialAssigneeNames) +
                  (referralTargetNames.length > 0
                    ? "، ارجاع‌شده به " + compactNames(referralTargetNames)
                    : "")
                }
                className={[
                  "group relative h-auto min-h-[22rem] w-full flex-col items-stretch justify-start overflow-hidden whitespace-normal rounded-xl border p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60",
                  request.workflow_status === "unseen"
                    ? "border-amber-200 bg-amber-50/30 hover:border-amber-300"
                    : "border-border bg-card hover:border-primary/20",
                ].join(" ")}
                disabled={detailLoading}
              >
                <div className={"absolute inset-x-0 top-0 h-1 " + statusMeta.barClass} />
                <div className="mb-4 flex w-full items-start justify-between gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText size={21} />
                  </div>
                  <Badge
                    variant="outline"
                    aria-label={"وضعیت درخواست: " + statusMeta.label}
                    className={statusMeta.badgeClass}
                  >
                    {statusMeta.label}
                  </Badge>
                </div>
                <h3 className="w-full line-clamp-2 text-base font-bold leading-7 text-foreground">
                  {requestTitle}
                </h3>
                <p className="mt-2 w-full text-sm leading-6 text-muted-foreground">
                  {request.section_title || request.form_title}
                </p>
                {request.department_title && (
                  <p className="mt-1 w-full text-xs leading-5 text-muted-foreground">
                    {request.department_title}
                  </p>
                )}
                <div className="mt-3 w-full space-y-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs">
                  <p className="flex min-w-0 items-center gap-1.5">
                    <UserRound
                      size={13}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="shrink-0 text-muted-foreground">
                      ارسال اولیه به:
                    </span>
                    <span
                      className="min-w-0 truncate font-semibold text-foreground"
                      title={initialAssigneeNames.join("، ") || "نامشخص"}
                    >
                      {compactNames(initialAssigneeNames)}
                    </span>
                  </p>
                  {referralTargetNames.length > 0 && (
                    <p className="flex min-w-0 items-center gap-1.5 text-violet-700">
                      <Forward size={13} className="shrink-0" aria-hidden="true" />
                      <span className="shrink-0">ارجاع‌شده به:</span>
                      <span
                        className="min-w-0 truncate font-bold"
                        title={referralTargetNames.join("، ")}
                      >
                        {compactNames(referralTargetNames)}
                      </span>
                    </p>
                  )}
                </div>
                {(request.jira_issue_key || request.jira_status) && (
                  <div className="mt-3 grid w-full gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs sm:grid-cols-2">
                    {request.jira_issue_key && (
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-muted-foreground">شماره Jira:</span>
                        <span dir="ltr" className="min-w-0 truncate font-bold text-blue-700" title={request.jira_issue_key}>
                          {request.jira_issue_key}
                        </span>
                      </p>
                    )}
                    {request.jira_status && (
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-muted-foreground">وضعیت Jira:</span>
                        <span className="min-w-0 truncate font-semibold text-foreground" title={request.jira_status}>
                          {request.jira_status}
                        </span>
                      </p>
                    )}
                  </div>
                )}
                {user?.is_admin && request.submitted_by && (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    ثبت‌کننده: {request.submitted_by}
                  </p>
                )}

                {showProgress && (
                  <div className="mt-5 w-full rounded-lg bg-muted/40 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted-foreground">میزان پیشرفت</span>
                      <span className="font-extrabold text-foreground">
                        {progress.toLocaleString("fa-IR")}٪
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="میزان پیشرفت رسیدگی"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                      className="h-2 overflow-hidden rounded-full bg-slate-200"
                    >
                      <div
                        className={"h-full rounded-full transition-all " + statusMeta.barClass}
                        style={{ width: progress + "%" }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={14} />
                    {formatPersianDateTime(request.created_at)}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-primary">
                    مشاهده جزئیات <ChevronLeft size={15} />
                  </span>
                </div>
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-md">
          <div className="overflow-x-auto">
            <Table className="w-full min-w-[980px] text-right text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-4">شناسه</th>
                  <th scope="col" className="px-4 py-4">درخواست</th>
                  <th scope="col" className="px-4 py-4">دسته‌بندی</th>
                  <th scope="col" className="px-4 py-4">مسئول رسیدگی</th>
                  {user?.is_admin && <th scope="col" className="px-4 py-4">ثبت‌کننده</th>}
                  <th scope="col" className="px-4 py-4">وضعیت</th>
                  <th scope="col" className="px-4 py-4">پیشرفت</th>
                  <th scope="col" className="px-4 py-4">زمان ثبت</th>
                  <th scope="col" className="px-4 py-4">
                    <span className="sr-only">عملیات</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((request) => {
                  const statusMeta = workflowStatusMeta(request.workflow_status);
                  const progress = normalizedProgress(request.progress_percent);
                  const requestTitle =
                    request.subject || request.section_title || request.form_title;
                  const initialAssigneeNames = uniqueNames(
                    (request.initial_assignees ?? []).map(
                      (assignee) => assignee.display_name || assignee.username,
                    ),
                  );
                  const referralTargetNames = uniqueNames(
                    (request.referrals ?? []).map((referral) => referral.to_user_name),
                  );
                  const currentAssignees =
                    referralTargetNames.length > 0
                      ? referralTargetNames
                      : initialAssigneeNames;

                  return (
                    <tr
                      key={request.id}
                      className={
                        request.workflow_status === "unseen"
                          ? "bg-amber-50/30 transition hover:bg-amber-50/60"
                          : "bg-card transition hover:bg-muted/40"
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-bold text-muted-foreground">
                        {request.id.toLocaleString("fa-IR")}
                      </td>
                      <td className="max-w-64 px-4 py-4">
                        <Button
                          type="button"
                          onClick={() => void openRequest(request)}
                          disabled={detailLoading}
                          className="block max-w-full text-right font-bold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60"
                        >
                          <span className="block truncate" title={requestTitle}>
                            {requestTitle}
                          </span>
                          <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                            {request.section_title || request.form_title}
                          </span>
                        </Button>
                      </td>
                      <td className="max-w-48 px-4 py-4 text-muted-foreground">
                        <span className="block truncate" title={request.department_title}>
                          {request.department_title || "—"}
                        </span>
                      </td>
                      <td className="max-w-52 px-4 py-4 text-muted-foreground">
                        <span
                          className="block truncate"
                          title={currentAssignees.join("، ") || "نامشخص"}
                        >
                          {compactNames(currentAssignees)}
                        </span>
                        {referralTargetNames.length > 0 && (
                          <span className="mt-1 block text-xs font-semibold text-violet-600">
                            ارجاع‌شده
                          </span>
                        )}
                      </td>
                      {user?.is_admin && (
                        <td className="max-w-40 px-4 py-4 text-muted-foreground">
                          <span className="block truncate" title={request.submitted_by}>
                            {request.submitted_by || "—"}
                          </span>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-4">
                        <Badge variant="outline" className={statusMeta.badgeClass}>
                          {statusMeta.label}
                        </Badge>
                      </td>
                      <td className="w-36 px-4 py-4">
                        <span className="mb-1.5 block text-xs font-bold text-foreground">
                          {progress.toLocaleString("fa-IR")}٪
                        </span>
                        <div
                          role="progressbar"
                          aria-label={`پیشرفت درخواست ${request.id}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progress}
                          className="h-1.5 overflow-hidden rounded-full bg-slate-200"
                        >
                          <div
                            className={"h-full rounded-full " + statusMeta.barClass}
                            style={{ width: progress + "%" }}
                          />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                        {formatPersianDateTime(request.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          type="button"
                          onClick={() => void openRequest(request)}
                          disabled={detailLoading}
                          aria-label={`مشاهده جزئیات درخواست ${requestTitle}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-60"
                        >
                          <ChevronLeft size={18} aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={() => setSelected(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="جزئیات درخواست"
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card/95 p-6 backdrop-blur">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    aria-label={
                      "وضعیت درخواست: " +
                      workflowStatusMeta(selected.workflow_status).label
                    }
                    className={
                      "gap-1.5 " +
                      workflowStatusMeta(selected.workflow_status).badgeClass
                    }
                  >
                    <WorkflowStatusIcon status={selected.workflow_status} />
                    {workflowStatusMeta(selected.workflow_status).label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">شناسه درخواست: {selected.id}</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground">{selected.subject || selected.section_title || selected.form_title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selected.department_title} / {selected.section_title || selected.form_title}</p>
              </div>
              <Button variant="outline" onClick={() => setSelected(null)} className="shrink-0 rounded-xl">بستن</Button>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <WorkflowOverview status={selected.workflow_status} />

              <section
                aria-label="میزان پیشرفت رسیدگی"
                className="rounded-3xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-foreground">
                      {selected.workflow_status === "rejected"
                        ? "پیشرفت ثبت‌شده تا زمان رد"
                        : "میزان پیشرفت رسیدگی"}
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      آخرین درصدی که مسئول رسیدگی ثبت کرده است
                    </p>
                  </div>
                  <span className="text-2xl font-extrabold text-foreground">
                    {normalizedProgress(selected.progress_percent).toLocaleString("fa-IR")}٪
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="درصد پیشرفت درخواست"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={normalizedProgress(selected.progress_percent)}
                  className="h-3 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={
                      "h-full rounded-full transition-all " +
                      workflowStatusMeta(selected.workflow_status).barClass
                    }
                    style={{
                      width: normalizedProgress(selected.progress_percent) + "%",
                    }}
                  />
                </div>
              </section>

              <div className="grid gap-3 rounded-2xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">تاریخ ثبت:</span> <span className="font-semibold text-foreground">{formatPersianDateTime(selected.created_at)}</span></div>
                <div><span className="text-muted-foreground">نوع فرم:</span> <span className="font-semibold text-foreground">{selected.form_title}</span></div>
                {(selected.jira_issue_key || selected.jira_status) && (
                  <div className="sm:col-span-2 rounded-2xl border border-border bg-card p-3">
                    <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Jira</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selected.jira_issue_key && (
                        <div>
                          <span className="text-muted-foreground">Jira Issue:</span>{" "}
                          <span className="font-semibold text-foreground">
                            {selected.jira_issue_key}
                          </span>
                        </div>
                      )}
                      {selected.jira_status && (
                        <div>
                          <span className="text-muted-foreground">Jira Status:</span>{" "}
                          <span className="whitespace-pre-wrap font-semibold text-foreground">
                            {selected.jira_status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 sm:col-span-2">
                  <UserRound
                    size={16}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="shrink-0 text-muted-foreground">
                    ارسال اولیه به:
                  </span>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {selectedInitialAssigneeNames.length > 0 ? (
                      selectedInitialAssigneeNames.map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground"
                        >
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="font-semibold text-muted-foreground">نامشخص</span>
                    )}
                  </div>
                </div>
                {selectedReferralTargetNames.length > 0 && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <Forward
                      size={16}
                      className="mt-0.5 shrink-0 text-violet-600"
                      aria-hidden="true"
                    />
                    <span className="shrink-0 text-muted-foreground">
                      ارجاع‌شده به:
                    </span>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {selectedReferralTargetNames.map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 sm:col-span-2">
                  {selected.first_viewed_at ? (
                    <Eye size={16} className="text-sky-600" aria-hidden="true" />
                  ) : (
                    <EyeOff size={16} className="text-amber-600" aria-hidden="true" />
                  )}
                  <span className="text-muted-foreground">اولین مشاهده توسط مسئول:</span>
                  <span className="font-semibold text-foreground">
                    {selected.first_viewed_at
                      ? formatPersianDateTime(selected.first_viewed_at)
                      : "هنوز مشاهده نشده"}
                  </span>
                </div>
                {selected.attachment_name && (
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Paperclip size={16} className="text-red-500" />
                    <span className="text-muted-foreground">پیوست:</span>
                    <Button
                      type="button"
                      onClick={async () => {
                        const token = localStorage.getItem("access_token");
                        const res = await fetch(
                          `${API_BASE}/submissions/${selected.id}/attachment`,
                          {
                            headers: token
                              ? { Authorization: `Bearer ${token}` }
                              : {},
                          },
                        );
                        if (!res.ok) return;
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = selected.attachment_name!;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                      }}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {selected.attachment_name}
                    </Button>
                  </div>
                )}
              </div>

              <TaskConversation submissionId={selected.id} canRemind />

              <section aria-labelledby="request-timeline-title" className="space-y-4">
                <div>
                  <h4
                    id="request-timeline-title"
                    className="text-lg font-extrabold text-foreground"
                  >
                    مسیر درخواست
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    همه تغییرات از زمان ثبت تا وضعیت فعلی
                  </p>
                </div>

                {(selected.timeline ?? []).length > 0 ? (
                  <ol className="relative space-y-1 before:absolute before:bottom-5 before:right-[7px] before:top-5 before:w-px before:bg-slate-200">
                    {(selected.timeline ?? []).map((item) => {
                      const eventProgress =
                        item.to_progress_percent ?? item.progress_percent;
                      return (
                        <li key={item.id} className="relative flex gap-4 pb-5">
                          <span
                            className={
                              "relative z-[1] mt-2 h-3.5 w-3.5 shrink-0 rounded-full ring-4 " +
                              timelineEventDotClass(item)
                            }
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-foreground">
                                  {timelineEventLabel(item)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.event_type === "referred" &&
                                  item.to_user_name ? (
                                    <>
                                      از{" "}
                                      <span className="font-semibold text-foreground">
                                        {item.actor_name || "سامانه"}
                                      </span>{" "}
                                      به{" "}
                                      <span className="font-semibold text-violet-700">
                                        {item.to_user_name}
                                      </span>
                                    </>
                                  ) : (
                                    <>توسط {item.actor_name || "سامانه"}</>
                                  )}
                                </p>
                              </div>
                              <time className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatPersianDateTime(item.created_at)}
                              </time>
                            </div>

                            {(eventProgress !== null ||
                              item.note ||
                              item.attachment_name) && (
                              <div className="mt-3 flex flex-wrap items-start gap-2">
                                {eventProgress !== null && (
                                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                    پیشرفت:{" "}
                                    {normalizedProgress(eventProgress).toLocaleString(
                                      "fa-IR",
                                    )}
                                    ٪
                                  </span>
                                )}
                                {item.note && (
                                  <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-xl bg-muted/40 px-3 py-2 text-xs leading-6 text-muted-foreground">
                                    {item.note}
                                  </p>
                                )}
                                {item.attachment_name && (
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      void (async () => {
                                        if (item.event_type === "referred") {
                                          const referralId = parseTimelineEntityId(
                                            item.id,
                                            "referral",
                                          );
                                          if (!referralId) return;
                                          await downloadWithAuth(
                                            `${API_BASE}/submissions/${selected.id}/referrals/${referralId}/attachment`,
                                            item.attachment_name!,
                                          );
                                          return;
                                        }
                                        if (item.event_type === "status_changed") {
                                          const historyId = parseTimelineEntityId(
                                            item.id,
                                            "status",
                                          );
                                          if (!historyId) return;
                                          await downloadWithAuth(
                                            `${API_BASE}/submissions/${selected.id}/status-history/${historyId}/attachment`,
                                            item.attachment_name!,
                                          );
                                        }
                                      })();
                                    }}
                                    className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                                  >
                                    <Paperclip size={12} />
                                    {item.attachment_name}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                    هنوز رویدادی برای این درخواست ثبت نشده است.
                  </div>
                )}
              </section>

              <div className="space-y-4">
                {visibleFields.map(({ name, value, field }) => (
                  <div key={name} className="rounded-2xl border border-border p-4">
                    <div className="mb-2 text-sm font-semibold text-muted-foreground">{field?.label ?? name}</div>
                    <div className="text-foreground">{displayValue(value, field)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/20">
          <div className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-xl"><Loader2 className="animate-spin text-primary" />در حال دریافت جزئیات...</div>
        </div>
      )}
    </AppShell>
  );
}
