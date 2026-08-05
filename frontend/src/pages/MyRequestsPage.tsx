import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  FileText,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import client from "../api/client";
import { endpoints } from "../api/endpoints";
import AppShell from "../components/layout/AppShell";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { FormField, FormTemplate } from "../config/portal";
import { useAuth } from "../context/AuthContext";
import { formatPersianDateTime } from "../lib/persianDate";

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
  created_at: string;
  submitted_by?: string;
  submitted_by_username?: string;
};

type SubmissionDetail = SubmissionListItem & {
  data: Record<string, unknown>;
};

type TimeRange = "all" | "today" | "7days" | "30days" | "90days";
type SortOrder = "newest" | "oldest";

function parseSubmittedAt(value: string) {
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function displayStatus(status: string) {
  if (status === "approved") return "تایید‌شده";
  if (status === "rejected") return "رد‌شده";
  if (status === "submitted") return "ثبت‌شده";
  return status || "ثبت‌شده";
}

function statusBadgeClass(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
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
      (row) => row && typeof row === "object" && Object.values(row).some(Boolean)
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
                <th key={column.key} className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-pre-wrap px-3 py-2 text-slate-700">
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
    return Array.from(items, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title, "fa")
    );
  }, [requests, departmentFilter]);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("fa");
    const now = new Date();
    let cutoff: Date | null = null;

    if (timeRange === "today") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeRange !== "all") {
      const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
      cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return requests
      .filter((request) => {
        const searchableText = [
          request.id,
          request.subject,
          request.form_title,
          request.department_title,
          request.section_title,
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
          `${request.department_id}::${request.section_id}` !== sectionFilter
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
  }, [requests, searchQuery, departmentFilter, sectionFilter, timeRange, sortOrder]);

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

  const openRequest = async (request: SubmissionListItem) => {
    setDetailLoading(true);
    setError("");
    try {
      const [detailResponse, templateResponse] = await Promise.all([
        client.get<SubmissionDetail>(`${endpoints.submissions}/${request.id}`),
        client.get<FormTemplate>(`${endpoints.forms}/${request.form_id}`),
      ]);
      setSelected(detailResponse.data);
      setTemplate(templateResponse.data);
    } catch {
      setError("نمایش جزئیات این درخواست با مشکل مواجه شد.");
    } finally {
      setDetailLoading(false);
    }
  };

  const visibleFields = useMemo(() => {
    if (!selected) return [];
    const fieldsByName = new Map(template?.fields.map((field) => [field.name, field]));
    return Object.entries(selected.data)
      .filter(([name]) => name !== "_report_id" && name !== "attachment")
      .map(([name, value]) => ({ name, value, field: fieldsByName.get(name) }));
  }, [selected, template]);

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <ClipboardList size={25} />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900">
                {user?.is_admin ? "همه درخواست‌ها" : "درخواست‌های من"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
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

      {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {!loading && requests.length > 0 && (
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
                placeholder="جستجوی عنوان، فرم یا شناسه..."
                aria-label="جستجوی درخواست‌ها"
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
                <option key={department.id} value={department.id}>{department.title}</option>
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
                <option key={section.id} value={section.id}>{section.title}</option>
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
            {filteredRequests.length.toLocaleString("fa-IR")} درخواست از {requests.length.toLocaleString("fa-IR")} درخواست
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500">
          <Loader2 className="animate-spin" /> در حال دریافت درخواست‌ها...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
          <FileText className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-xl font-bold text-slate-700">هنوز درخواستی ثبت نکرده‌اید</h3>
          <p className="mt-2 text-slate-500">پس از ثبت هر فرم، آن را در این صفحه خواهید دید.</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
          <Search className="mx-auto mb-4 text-slate-300" size={48} />
          <h3 className="text-xl font-bold text-slate-700">درخواستی با این مشخصات پیدا نشد</h3>
          <p className="mt-2 text-slate-500">عبارت جستجو یا فیلترها را تغییر دهید.</p>
          <Button variant="outline" onClick={resetFilters} className="mt-5 rounded-xl px-5">
            پاک کردن فیلترها
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredRequests.map((request) => (
            <button
              type="button"
              key={request.id}
              onClick={() => void openRequest(request)}
              className="group rounded-3xl border border-slate-100 bg-white p-6 text-right shadow-md transition hover:-translate-y-1 hover:border-red-100 hover:shadow-xl disabled:opacity-60"
              disabled={detailLoading}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FileText size={21} />
                </div>
                <Badge variant="outline" className={statusBadgeClass(request.status)}>
                  {displayStatus(request.status)}
                </Badge>
              </div>
              <h3 className="line-clamp-2 text-lg font-bold text-slate-800">
                {request.subject || request.section_title || request.form_title}
              </h3>
              <p className="mt-2 text-sm text-slate-500">{request.section_title || request.form_title}</p>
              {request.department_title && <p className="mt-1 text-xs text-slate-400">{request.department_title}</p>}
              {user?.is_admin && request.submitted_by && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  ثبت‌کننده: {request.submitted_by}
                </p>
              )}
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><CalendarDays size={14} />{formatPersianDateTime(request.created_at)}</span>
                <span className="flex items-center gap-1 font-medium text-red-600">مشاهده جزئیات <ChevronLeft size={15} /></span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={() => setSelected(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="جزئیات درخواست"
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white/95 p-6 backdrop-blur">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusBadgeClass(selected.status)}>{displayStatus(selected.status)}</Badge>
                  <span className="text-xs text-slate-400">شناسه درخواست: {selected.id}</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{selected.subject || selected.section_title || selected.form_title}</h3>
                <p className="mt-1 text-sm text-slate-500">{selected.department_title} / {selected.section_title || selected.form_title}</p>
              </div>
              <Button variant="outline" onClick={() => setSelected(null)} className="shrink-0 rounded-xl">بستن</Button>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div><span className="text-slate-500">تاریخ ثبت:</span> <span className="font-semibold text-slate-700">{formatPersianDateTime(selected.created_at)}</span></div>
                <div><span className="text-slate-500">نوع فرم:</span> <span className="font-semibold text-slate-700">{selected.form_title}</span></div>
                {selected.attachment_name && (
                  <div className="flex items-center gap-2 sm:col-span-2"><Paperclip size={16} className="text-red-500" /><span className="text-slate-500">پیوست:</span><span className="font-semibold text-slate-700">{selected.attachment_name}</span></div>
                )}
              </div>

              <div className="space-y-4">
                {visibleFields.map(({ name, value, field }) => (
                  <div key={name} className="rounded-2xl border border-slate-100 p-4">
                    <div className="mb-2 text-sm font-semibold text-slate-500">{field?.label ?? name}</div>
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
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl"><Loader2 className="animate-spin text-red-600" />در حال دریافت جزئیات...</div>
        </div>
      )}
    </AppShell>
  );
}
