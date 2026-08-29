import { Table } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  ChevronLeft,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import AppShell from "@/components/layout/AppShell";
import RedirectTo from "@/app/_components/RedirectTo";
import { API_BASE } from "@/config/portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatPersianDate,
  formatPersianDateTime,
  normalizePersianDate,
  PERSIAN_DATE_FORMAT,
} from "@/lib/persianDate";
import { LETTER_WORKFLOWS, LetterType } from "./letterWorkflow";

type LetterRecipientStatus = {
  user_id: number | null;
  display_name: string;
  status: string;
  status_updated_at: string | null;
  submission_id: number;
  referred_to?: string | null;
  comment?: string;
};

type LetterReportItem = {
  batch_id: string;
  subject: string;
  description: string;
  letter_number?: string;
  system_letter_number?: string;
  needs_reply?: string;
  needs_action?: string;
  due_date?: string;
  sender?: string;
  sender_detail?: string;
  attachment_name: string | null;
  attachment_names?: string[];
  created_at: string;
  sent_by: string;
  sent_by_id: number;
  recipients: LetterRecipientStatus[];
};

const datePickerInputClass =
  "h-11 w-full rounded-xl border border-border bg-card px-4 text-right text-sm shadow-sm outline-none transition focus:border-red-500";

function formatLetterSender(item: LetterReportItem) {
  const sender = (item.sender || "").trim();
  const detail = (item.sender_detail || "").trim();
  if (!sender) return "";
  if (sender === "هلدینگ" && detail) return `هلدینگ / ${detail}`;
  return sender;
}

function displayStatus(status: string) {
  if (status === "in_progress") return "در حال انجام";
  if (status === "approved") return "انجام‌شده";
  if (status === "rejected") return "رد‌شده";
  if (status === "referred") return "ارجاع‌شده";
  if (status === "submitted") return "اقدام‌نشده";
  return status || "اقدام‌نشده";
}

function statusBadgeClass(status: string) {
  if (status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "referred") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function batchSummary(item: LetterReportItem) {
  const total = item.recipients.length;
  const done = item.recipients.filter((row) => row.status === "approved").length;
  const rejected = item.recipients.filter((row) => row.status === "rejected").length;
  const referred = item.recipients.filter((row) => row.status === "referred").length;
  const inProgress = item.recipients.filter(
    (row) => row.status === "in_progress",
  ).length;
  const pending = total - done - rejected - referred - inProgress;
  return { total, done, rejected, referred, inProgress, pending };
}

export default function LetterReportPage({ letterType }: { letterType: LetterType }) {
  const workflow = LETTER_WORKFLOWS[letterType];
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<LetterReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const access = await client.get<{ allowed: boolean }>(
        endpoints.managementLetterAccess,
        { params: { letter_type: letterType } },
      );
      setAllowed(access.data.allowed);
      if (!access.data.allowed) return;
      const { data } = await client.get<LetterReportItem[]>(
        endpoints.managementLetterReport,
        { params: { letter_type: letterType } },
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
  }, [letterType]);

  const dateFiltered = useMemo(() => {
    if (fromDate && toDate && fromDate > toDate) return [];

    return items.filter((item) => {
      const sentDate = formatPersianDate(item.created_at);
      return (
        (!fromDate || sentDate >= fromDate) &&
        (!toDate || sentDate <= toDate)
      );
    });
  }, [fromDate, items, toDate]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return dateFiltered;
    return dateFiltered.filter((item) =>
      [
        item.subject,
        item.description,
        item.letter_number,
        item.system_letter_number,
        item.needs_reply,
        item.needs_action,
        item.due_date,
        item.sender,
        item.sender_detail,
        item.sent_by,
        formatPersianDateTime(item.created_at),
        ...item.recipients.flatMap((row) => [
          row.display_name,
          row.comment,
          formatPersianDateTime(row.status_updated_at),
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(query),
    );
  }, [dateFiltered, search]);

  const hasActiveFilters = Boolean(search.trim() || fromDate || toDate);
  const hasInvalidRange = Boolean(fromDate && toDate && fromDate > toDate);

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
  };

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
    return <RedirectTo href="/" />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={workflow.homePath}
              className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary"
            >
              <ChevronLeft size={18} />
              بازگشت
            </Link>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <BarChart3 size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">
                  {workflow.reportTitle}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
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
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجو در موضوع یا گیرنده"
            className="h-11 rounded-xl pr-9"
          />
        </div>

        <div className='mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm'>
          <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-2 text-sm font-bold text-foreground'>
              <CalendarRange size={18} className='text-primary' />
              بازه زمانی ارسال
            </div>
            {hasActiveFilters && (
              <Button
                type='button'
                onClick={clearFilters}
                className='inline-flex items-center gap-1 text-xs font-bold text-muted-foreground transition hover:text-primary'
              >
                <X size={14} />
                پاک کردن فیلترها
              </Button>
            )}
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <Label>
              <span className='mb-1.5 block text-xs font-bold text-muted-foreground'>
                از تاریخ ارسال
              </span>
              <DatePicker
                calendar={persian}
                locale={persian_fa}
                format={PERSIAN_DATE_FORMAT}
                value={fromDate || undefined}
                maxDate={toDate || undefined}
                onChange={(date) => setFromDate(normalizePersianDate(date))}
                inputClass={datePickerInputClass}
                containerClassName='w-full'
                calendarPosition='bottom-right'
                placeholder='انتخاب تاریخ شروع'
              />
            </Label>

            <Label>
              <span className='mb-1.5 block text-xs font-bold text-muted-foreground'>
                تا تاریخ ارسال
              </span>
              <DatePicker
                calendar={persian}
                locale={persian_fa}
                format={PERSIAN_DATE_FORMAT}
                value={toDate || undefined}
                minDate={fromDate || undefined}
                onChange={(date) => setToDate(normalizePersianDate(date))}
                inputClass={datePickerInputClass}
                containerClassName='w-full'
                calendarPosition='bottom-right'
                placeholder='انتخاب تاریخ پایان'
              />
            </Label>
          </div>

          {hasInvalidRange ? (
            <p className='mt-3 text-xs font-semibold text-primary'>
              تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.
            </p>
          ) : hasActiveFilters ? (
            <p className='mt-3 text-xs text-muted-foreground'>
              نمایش {filtered.length.toLocaleString('fa-IR')} نامه از{' '}
              {items.length.toLocaleString('fa-IR')} نامه
            </p>
          ) : null}
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl bg-card shadow-sm">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 && hasActiveFilters ? (
          <div className='rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-sm'>
            <Users className='mx-auto text-slate-300' size={36} />
            <p className='mt-4 font-bold text-muted-foreground'>
              نامه‌ای در بازه یا فیلتر انتخاب‌شده پیدا نشد
            </p>
            <p className='mt-1 text-sm text-muted-foreground'>
              بازه زمانی یا عبارت جستجو را تغییر دهید.
            </p>
            <Button
              type='button'
              onClick={clearFilters}
              className='mt-5 font-bold text-primary hover:text-primary'
            >
              پاک کردن فیلترها
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
            <Users className="mx-auto text-slate-300" size={36} />
            <p className="mt-4 font-bold text-muted-foreground">نامه‌ای ثبت نشده است</p>
            <p className="mt-1 text-sm text-muted-foreground">
              پس از ارسال نامه از بخش «ارسال نامه»، وضعیت اینجا نمایش داده می‌شود.
            </p>
            <Link
              href={`${workflow.homePath}/send`}
              className="mt-5 inline-block font-bold text-primary"
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
                  className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-extrabold text-foreground">
                        {item.subject}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                        {item.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {letterType === "external" && item.letter_number && (
                          <span>شماره نامه: {item.letter_number}</span>
                        )}
                        {item.system_letter_number && (
                          <span>
                            شماره نامه سیستمی: {item.system_letter_number}
                          </span>
                        )}
                        {item.needs_reply && (
                          <span>نیاز به پاسخ: {item.needs_reply}</span>
                        )}
                        {item.needs_action && (
                          <span>نیاز به اقدام: {item.needs_action}</span>
                        )}
                        {item.due_date && (
                          <span>مهلت انجام: {item.due_date}</span>
                        )}
                        {letterType === "external" &&
                          formatLetterSender(item) && (
                            <span>فرستنده: {formatLetterSender(item)}</span>
                          )}
                        <span>ارسال‌کننده: {item.sent_by}</span>
                        <span>
                          تاریخ: {formatPersianDateTime(item.created_at) || "—"}
                        </span>
                        {(item.attachment_names?.length
                          ? item.attachment_names
                          : item.attachment_name
                            ? [item.attachment_name]
                            : []
                        ).map((name, index) => (
                          <Button
                            key={`${item.batch_id}-${name}-${index}`}
                            type="button"
                            onClick={() => void downloadAttachment(item, index)}
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            <Paperclip size={12} />
                            {name}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-border bg-muted/40 text-muted-foreground">
                        {summary.total.toLocaleString("fa-IR")} گیرنده
                      </Badge>
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                        {summary.pending.toLocaleString("fa-IR")} اقدام‌نشده
                      </Badge>
                      {summary.inProgress > 0 && (
                        <Badge className="border-sky-200 bg-sky-50 text-sky-700">
                          {summary.inProgress.toLocaleString("fa-IR")} در حال انجام
                        </Badge>
                      )}
                      {summary.referred > 0 && (
                        <Badge className="border-blue-200 bg-blue-50 text-blue-700">
                          {summary.referred.toLocaleString("fa-IR")} ارجاع‌شده
                        </Badge>
                      )}
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        {summary.done.toLocaleString("fa-IR")} انجام‌شده
                      </Badge>
                      {summary.rejected > 0 && (
                        <Badge className="border-primary/30 bg-primary/10 text-primary">
                          {summary.rejected.toLocaleString("fa-IR")} رد‌شده
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                    <Table className="min-w-[850px] w-full text-sm">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-right font-bold">گیرنده</th>
                          <th className="px-4 py-3 text-right font-bold">یادداشت</th>
                          <th className="px-4 py-3 text-right font-bold">وضعیت</th>
                          <th className="px-4 py-3 text-right font-bold">ارجاع به</th>
                          <th className="px-4 py-3 text-right font-bold">آخرین تغییر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.recipients.map((recipient) => (
                          <tr key={recipient.submission_id}>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {recipient.display_name}
                            </td>
                            <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3 leading-6 text-muted-foreground">
                              {recipient.comment || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={statusBadgeClass(recipient.status)}>
                                {displayStatus(recipient.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {recipient.referred_to || "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatPersianDateTime(recipient.status_updated_at) ||
                                "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
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
