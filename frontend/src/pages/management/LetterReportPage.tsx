import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import AppShell from "../../components/layout/AppShell";
import { API_BASE } from "../../config/portal";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

type LetterRecipientStatus = {
  user_id: number | null;
  display_name: string;
  status: string;
  status_updated_at: string | null;
  submission_id: number;
  referred_to?: string | null;
};

type LetterReportItem = {
  batch_id: string;
  subject: string;
  description: string;
  attachment_name: string | null;
  attachment_names?: string[];
  created_at: string;
  sent_by: string;
  sent_by_id: number;
  recipients: LetterRecipientStatus[];
};

function displayStatus(status: string) {
  if (status === "approved") return "انجام‌شده";
  if (status === "rejected") return "رد‌شده";
  if (status === "referred") return "ارجاع‌شده";
  if (status === "submitted") return "اقدام‌نشده";
  return status || "اقدام‌نشده";
}

function statusBadgeClass(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "referred") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function batchSummary(item: LetterReportItem) {
  const total = item.recipients.length;
  const done = item.recipients.filter((row) => row.status === "approved").length;
  const rejected = item.recipients.filter((row) => row.status === "rejected").length;
  const referred = item.recipients.filter((row) => row.status === "referred").length;
  const pending = total - done - rejected - referred;
  return { total, done, rejected, referred, pending };
}

export default function LetterReportPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<LetterReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const access = await client.get<{ allowed: boolean }>(
        endpoints.managementLetterAccess,
      );
      setAllowed(access.data.allowed);
      if (!access.data.allowed) return;
      const { data } = await client.get<LetterReportItem[]>(
        endpoints.managementLetterReport,
      );
      setItems(data);
    } catch {
      setAllowed(false);
      setError("دریافت گزارش نامه‌ها با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return items;
    return items.filter((item) =>
      [
        item.subject,
        item.description,
        item.sent_by,
        ...item.recipients.map((row) => row.display_name),
      ]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(query),
    );
  }, [items, search]);

  const downloadAttachment = async (item: LetterReportItem, index = 0) => {
    const submissionId = item.recipients[0]?.submission_id;
    const names =
      item.attachment_names?.length
        ? item.attachment_names
        : item.attachment_name
          ? [item.attachment_name]
          : [];
    const name = names[index];
    if (!submissionId || !name) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(
        `${API_BASE}/submissions/${submissionId}/attachment?index=${index}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        setError("دانلود پیوست با مشکل مواجه شد.");
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
      setError("دانلود پیوست با مشکل مواجه شد.");
    }
  };

  if (allowed === false) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/management-workflow"
              className="inline-flex items-center gap-2 font-semibold text-red-600 hover:text-red-700"
            >
              <ChevronLeft size={18} />
              بازگشت
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <BarChart3 size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">گزارش نامه‌ها</h1>
                <p className="mt-1 text-sm text-slate-500">
                  وضعیت انجام نامه‌های ارسال‌شده برای هر گیرنده
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            className="gap-2 rounded-xl"
          >
            <RefreshCw size={16} />
            بروزرسانی
          </Button>
        </div>

        <div className="mb-5 relative max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در موضوع یا گیرنده"
            className="h-11 rounded-xl pr-9"
          />
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl bg-white shadow-sm">
            <Loader2 className="animate-spin text-red-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
            <Users className="mx-auto text-slate-300" size={36} />
            <p className="mt-4 font-bold text-slate-600">نامه‌ای ثبت نشده است</p>
            <p className="mt-1 text-sm text-slate-400">
              پس از ارسال نامه از بخش «ارسال نامه»، وضعیت اینجا نمایش داده می‌شود.
            </p>
            <Link
              to="/management-workflow/send"
              className="mt-5 inline-block font-bold text-red-600"
            >
              ارسال نامه جدید
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => {
              const summary = batchSummary(item);
              return (
                <article
                  key={item.batch_id}
                  className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-extrabold text-slate-900">
                        {item.subject}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {item.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>ارسال‌کننده: {item.sent_by}</span>
                        <span>تاریخ: {item.created_at}</span>
                        {(item.attachment_names?.length
                          ? item.attachment_names
                          : item.attachment_name
                            ? [item.attachment_name]
                            : []
                        ).map((name, index) => (
                          <button
                            key={`${item.batch_id}-${name}-${index}`}
                            type="button"
                            onClick={() => void downloadAttachment(item, index)}
                            className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline"
                          >
                            <Paperclip size={12} />
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                        {summary.total.toLocaleString("fa-IR")} گیرنده
                      </Badge>
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                        {summary.pending.toLocaleString("fa-IR")} اقدام‌نشده
                      </Badge>
                      {summary.referred > 0 && (
                        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                          {summary.referred.toLocaleString("fa-IR")} ارجاع‌شده
                        </Badge>
                      )}
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {summary.done.toLocaleString("fa-IR")} انجام‌شده
                      </Badge>
                      {summary.rejected > 0 && (
                        <Badge className="border-red-200 bg-red-50 text-red-700">
                          {summary.rejected.toLocaleString("fa-IR")} رد‌شده
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-right font-bold">گیرنده</th>
                          <th className="px-4 py-3 text-right font-bold">وضعیت</th>
                          <th className="px-4 py-3 text-right font-bold">ارجاع به</th>
                          <th className="px-4 py-3 text-right font-bold">آخرین تغییر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.recipients.map((recipient) => (
                          <tr key={recipient.submission_id}>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {recipient.display_name}
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={statusBadgeClass(recipient.status)}>
                                {displayStatus(recipient.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {recipient.referred_to || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {recipient.status_updated_at || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
