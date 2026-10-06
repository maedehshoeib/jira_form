"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Forward,
  GitBranch,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Search,
} from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import AppShell from "@/components/layout/AppShell";
import TaskConversation from "@/components/tasks/TaskConversation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE, FormTemplate } from "@/config/portal";
import { formatPersianDate, formatPersianDateTime } from "@/lib/persianDate";
import { cn } from "@/lib/utils";
import {
  DisplayValue,
  isActionableLetter,
  isManagementLetterTask,
  LETTER_NO_ACTION_VALUE,
  parseSubmittedAt,
  timelineEventLabel,
  type SubmissionDetail,
  type SubmissionListItem,
} from "@/features/tasks";

import { LetterActionsPanel } from "../components/LetterActionsPanel";

type LetterFolder = "inbox" | "unread" | "actionable" | "cc" | "inform";
type DetailTab = "body" | "attachments" | "workflow" | "notes";

const FOLDERS: { id: LetterFolder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "صندوق ورودی", icon: Inbox },
  { id: "unread", label: "خوانده‌نشده", icon: Mail },
  { id: "actionable", label: "نیاز به اقدام", icon: Forward },
  { id: "cc", label: "رونوشت", icon: MailOpen },
  { id: "inform", label: "جهت اطلاع", icon: MailOpen },
];

const META_FIELD_KEYS = new Set([
  "subject",
  "letter_number",
  "system_letter_number",
  "sender",
  "sender_detail",
  "letter_type",
  "needs_action",
  "needs_reply",
  "due_date",
  "recipient_id",
  "recipient_name",
  "recipient_delivery_type",
  "letter_batch_id",
  "attachment",
  "attachments",
]);

function dataStr(data: Record<string, unknown> | undefined, key: string) {
  if (!data) return "";
  const value = data[key];
  if (value == null) return "";
  return String(value).trim();
}

function letterTitle(letter: SubmissionListItem) {
  return letter.subject || letter.section_title || letter.form_title || "نامه";
}

function letterNumber(letter: SubmissionDetail) {
  return (
    dataStr(letter.data, "system_letter_number") ||
    dataStr(letter.data, "letter_number") ||
    letter.id.toLocaleString("fa-IR")
  );
}

function letterSender(letter: SubmissionDetail) {
  const sender = dataStr(letter.data, "sender");
  const detail = dataStr(letter.data, "sender_detail");
  if (sender === "هلدینگ" && detail) return `هلدینگ / ${detail}`;
  if (sender) return sender;
  return letter.submitted_by || "—";
}

function letterTypeLabel(letter: SubmissionDetail) {
  const type = dataStr(letter.data, "letter_type");
  if (type === "external") return "برون‌سازمانی";
  return "داخلی";
}

function letterPriorityLabel(letter: SubmissionDetail) {
  const needsAction = dataStr(letter.data, "needs_action");
  if (needsAction === LETTER_NO_ACTION_VALUE) return "جهت اطلاع";
  if (needsAction === "دارد") return "نیاز به اقدام";
  return "عادی";
}

function letterRecipient(letter: SubmissionDetail) {
  return dataStr(letter.data, "recipient_name") || "—";
}

function letterAttachmentNames(letter: SubmissionDetail) {
  const fromArray = letter.data.attachments;
  if (Array.isArray(fromArray)) {
    return fromArray.map((item) => String(item)).filter(Boolean);
  }
  const single = dataStr(letter.data, "attachment") || letter.attachment_name;
  return single ? [single] : letter.attachment_names ?? [];
}

function resolveAttachmentNames(letter: SubmissionDetail) {
  if (letter.attachment_names?.length) return letter.attachment_names;
  if (letter.attachment_name) return [letter.attachment_name];
  return letterAttachmentNames(letter);
}

function matchesFolder(letter: SubmissionListItem, folder: LetterFolder) {
  if (folder === "unread") return letter.is_read === false;
  if (folder === "actionable") return isActionableLetter(letter);
  if (folder === "cc") return Boolean(letter.is_announcement);
  if (folder === "inform") {
    return (
      !letter.is_announcement && letter.needs_action === LETTER_NO_ACTION_VALUE
    );
  }
  return true;
}

function LetterInfoBox({ letter }: { letter: SubmissionDetail }) {
  const meta = [
    { label: "شماره نامه", value: letterNumber(letter), dir: "ltr" as const },
    { label: "تاریخ ثبت", value: formatPersianDate(letter.created_at) || "—" },
    { label: "فرستنده", value: letterSender(letter) },
    {
      label: "اولویت / طبقه‌بندی",
      value: `${letterPriorityLabel(letter)} / ${letterTypeLabel(letter)}`,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {meta.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{item.label}</p>
            <p
              dir={item.dir}
              className="mt-1 truncate text-sm font-bold text-foreground"
              title={item.value}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        <span className="text-xs font-semibold text-muted-foreground">به:</span>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-foreground">
          {letterRecipient(letter)}
        </span>
      </div>
    </div>
  );
}

export default function MyLettersPage() {
  const searchParams = useSearchParams();
  const openedFromQueryRef = useRef<number | null>(null);
  const [letters, setLetters] = useState<SubmissionListItem[]>([]);
  const [selected, setSelected] = useState<SubmissionDetail | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [folder, setFolder] = useState<LetterFolder>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("body");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const syncLetter = (updated: SubmissionDetail) => {
    setLetters((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
    setSelected((prev) =>
      prev && prev.id === updated.id
        ? { ...updated, data: updated.data ?? prev.data }
        : prev,
    );
  };

  const loadLetters = async () => {
    setLoading(true);
    setError("");
    try {
      const allItems: SubmissionListItem[] = [];
      const pageSize = 500;
      let offset = 0;
      while (true) {
        const { data } = await client.get<SubmissionListItem[]>(endpoints.tasks, {
          params: { limit: pageSize, offset },
        });
        allItems.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
      }
      setLetters(allItems.filter(isManagementLetterTask));
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
      window.dispatchEvent(new Event("letters:refresh-notifications"));
    } catch {
      setError("دریافت نامه‌ها با مشکل مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLetters();
  }, []);

  const folderCounts = useMemo(() => {
    const counts: Record<LetterFolder, number> = {
      inbox: letters.length,
      unread: 0,
      actionable: 0,
      cc: 0,
      inform: 0,
    };
    letters.forEach((letter) => {
      if (letter.is_read === false) counts.unread += 1;
      if (isActionableLetter(letter)) counts.actionable += 1;
      if (letter.is_announcement) counts.cc += 1;
      if (!letter.is_announcement && letter.needs_action === LETTER_NO_ACTION_VALUE) {
        counts.inform += 1;
      }
    });
    return counts;
  }, [letters]);

  const filteredLetters = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("fa");
    return letters
      .filter((letter) => matchesFolder(letter, folder))
      .filter((letter) => {
        if (!query) return true;
        const haystack = [
          letter.subject,
          letter.form_title,
          letter.section_title,
          letter.department_title,
          letter.submitted_by,
        ]
          .join(" ")
          .toLocaleLowerCase("fa");
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aTime = parseSubmittedAt(a.created_at)?.getTime() ?? 0;
        const bTime = parseSubmittedAt(b.created_at)?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [letters, folder, searchQuery]);

  const openLetter = async (letter: SubmissionListItem) => {
    setDetailLoading(true);
    setError("");
    setActionError("");
    try {
      const [detailResponse, templateResponse] = await Promise.all([
        client.get<SubmissionDetail>(`${endpoints.tasks}/${letter.id}`),
        client.get<FormTemplate>(`${endpoints.forms}/${letter.form_id}`, {
          params: {
            department: letter.department_id,
            section: letter.section_id,
          },
        }),
      ]);
      setLetters((prev) =>
        prev.map((item) =>
          item.id === letter.id ? { ...item, ...detailResponse.data, is_read: true } : item,
        ),
      );
      setSelected(detailResponse.data);
      setTemplate(templateResponse.data);
      setDetailTab("body");
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
      window.dispatchEvent(new Event("letters:refresh-notifications"));
    } catch {
      setError("نمایش جزئیات نامه با مشکل مواجه شد.");
    } finally {
      setDetailLoading(false);
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
    const names = resolveAttachmentNames(selected);
    const name = fileName || names[index];
    if (!name) return;
    await downloadAuthFile(
      `${API_BASE}/tasks/${selected.id}/attachment?index=${index}`,
      name,
    );
  };

  useEffect(() => {
    if (loading || letters.length === 0) return;
    const raw = searchParams.get("open");
    if (!raw) return;
    const openId = Number(raw);
    if (!Number.isFinite(openId) || openId <= 0) return;
    if (openedFromQueryRef.current === openId) return;
    const letter = letters.find((item) => item.id === openId);
    if (!letter) return;
    openedFromQueryRef.current = openId;
    void openLetter(letter);
  }, [loading, letters, searchParams]);

  const detailFields = useMemo(() => {
    if (!selected || !template) return [];
    const fieldsByName = new Map(template.fields.map((field) => [field.name, field]));
    return Object.entries(selected.data)
      .filter(([name, value]) => {
        if (name.startsWith("_")) return false;
        if (META_FIELD_KEYS.has(name)) return false;
        if (value == null || String(value).trim() === "") return false;
        return true;
      })
      .map(([name, value]) => ({
        name,
        value,
        field: fieldsByName.get(name),
      }));
  }, [selected, template]);

  const letterBody = selected ? dataStr(selected.data, "description") : "";
  const attachmentNames = selected ? resolveAttachmentNames(selected) : [];

  const statusBadgeForList = (letter: SubmissionListItem) => {
    if (letter.is_announcement) return "رونوشت";
    if (letter.needs_action === LETTER_NO_ACTION_VALUE) return "جهت اطلاع";
    if (letter.status === "in_progress") return "در حال انجام";
    if (letter.status === "approved") return "انجام‌شده";
    if (letter.status === "rejected") return "رد‌شده";
    return "در انتظار اقدام";
  };

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-foreground">نامه‌ها</h2>
            <p className="text-sm text-muted-foreground">
              صندوق نامه‌های رونوشت و جهت اطلاع — جدا از وظایف قابل اقدام
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadLetters()}
          disabled={loading}
          className="h-10 gap-2 rounded-xl px-4"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
          به‌روزرسانی
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          {error}
        </div>
      )}

      <div className="flex min-h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-md">
        {/* Folders (RTL start = right) */}
        <aside className="hidden w-52 shrink-0 border-l border-border bg-muted/30 p-3 md:block">
          <p className="mb-2 px-2 text-[11px] font-bold text-muted-foreground">پوشه‌ها</p>
          <nav className="space-y-1" aria-label="پوشه‌های نامه">
            {FOLDERS.map((item) => {
              const Icon = item.icon;
              const active = folder === item.id;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  onClick={() => setFolder(item.id)}
                  className={cn(
                    "h-10 w-full justify-between rounded-xl px-3 text-sm font-semibold",
                    active
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "min-w-6 rounded-full px-1.5 text-center text-[11px] font-extrabold",
                      active ? "bg-white/20" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {folderCounts[item.id].toLocaleString("fa-IR")}
                  </span>
                </Button>
              );
            })}
          </nav>
        </aside>

        {/* Letter list */}
        <section className="flex w-full max-w-md shrink-0 flex-col border-l border-border md:w-[22rem]">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="جستجوی نامه..."
                aria-label="جستجوی نامه"
                className="h-10 rounded-xl pr-9"
              />
            </div>
            <div className="mt-2 flex gap-1 overflow-x-auto md:hidden">
              {FOLDERS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={folder === item.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFolder(item.id)}
                  className="shrink-0 rounded-lg text-xs"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={18} />
                در حال دریافت...
              </div>
            ) : filteredLetters.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                نامه‌ای در این پوشه نیست.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredLetters.map((letter) => {
                  const active = selected?.id === letter.id;
                  const unread = letter.is_read === false;
                  return (
                    <li key={letter.id}>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={detailLoading}
                        onClick={() => void openLetter(letter)}
                        className={cn(
                          "h-auto w-full flex-col items-stretch gap-1 rounded-none px-4 py-3 text-right whitespace-normal",
                          active && "bg-primary/10",
                          unread && !active && "bg-amber-50/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "line-clamp-1 text-sm",
                              unread ? "font-extrabold text-foreground" : "font-semibold text-foreground",
                            )}
                          >
                            {letter.submitted_by || "فرستنده نامشخص"}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatPersianDateTime(letter.created_at)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "line-clamp-1 text-sm",
                            unread ? "font-bold text-foreground" : "text-foreground/80",
                          )}
                        >
                          {letterTitle(letter)}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {unread && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-100 text-[10px] text-amber-900"
                            >
                              خوانده‌نشده
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-[10px] text-slate-700"
                          >
                            {statusBadgeForList(letter)}
                          </Badge>
                        </div>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Reading pane */}
        <section className="hidden min-w-0 flex-1 flex-col bg-background lg:flex">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
              <MailOpen size={48} className="text-slate-300" />
              <p className="text-base font-semibold">یک نامه را از فهرست انتخاب کنید</p>
              <p className="max-w-sm text-sm">
                محتوای نامه، فرستنده و جزئیات فرم اینجا نمایش داده می‌شود.
              </p>
            </div>
          ) : detailLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" />
              در حال بارگذاری نامه...
            </div>
          ) : (
            <div className="flex h-full flex-col overflow-hidden">
              <header className="shrink-0 space-y-4 border-b border-border bg-card px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="max-w-3xl text-xl font-extrabold leading-8 text-foreground">
                    {letterTitle(selected)}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-teal-200 bg-teal-50 text-teal-800"
                    >
                      {letterTypeLabel(selected) === "داخلی" ? "نامه داخلی" : "نامه برون‌سازمانی"}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {statusBadgeForList(selected)}
                    </Badge>
                  </div>
                </div>

                <LetterInfoBox letter={selected} />

                {(actionError || error) && (
                  <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                    {actionError || error}
                  </div>
                )}

                <LetterActionsPanel
                  selected={selected}
                  actionLoading={actionLoading}
                  onActionLoading={setActionLoading}
                  onError={setActionError}
                  onUpdated={syncLetter}
                />
              </header>

              <div className="shrink-0 border-b border-border bg-card px-6">
                <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="بخش‌های نامه">
                  {(
                    [
                      { id: "body" as const, label: "متن نامه" },
                      {
                        id: "attachments" as const,
                        label: `پیوست‌ها${attachmentNames.length ? ` ${attachmentNames.length.toLocaleString("fa-IR")}` : ""}`,
                      },
                      { id: "workflow" as const, label: "گردش کار و پیگیری" },
                      { id: "notes" as const, label: "یادداشت‌ها" },
                    ] as const
                  ).map((tab) => (
                    <Button
                      key={tab.id}
                      type="button"
                      variant="ghost"
                      role="tab"
                      aria-selected={detailTab === tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      className={cn(
                        "h-11 rounded-none border-b-2 px-4 text-sm font-bold",
                        detailTab === tab.id
                          ? "border-teal-600 text-teal-700 hover:bg-transparent hover:text-teal-700"
                          : "border-transparent text-muted-foreground hover:bg-transparent hover:text-foreground",
                      )}
                    >
                      {tab.id === "workflow" && <GitBranch size={14} className="ml-1.5" />}
                      {tab.id === "notes" && <MessageSquareText size={14} className="ml-1.5" />}
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {detailTab === "body" ? (
                  <>
                    {(selected.is_announcement ||
                      selected.needs_action === LETTER_NO_ACTION_VALUE) && (
                      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800">
                        {selected.is_announcement
                          ? "این نامه برای اطلاع شما رونوشت شده است و نیازی به اقدام ندارد."
                          : "این نامه جهت اطلاع ارسال شده و نیاز به اقدام ندارد."}
                      </div>
                    )}

                    <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                      <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
                        <div>
                          <p className="text-sm font-extrabold text-foreground">شرکت وثوق</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {letterTypeLabel(selected) === "داخلی"
                              ? "نامه داخلی"
                              : "نامه برون‌سازمانی"}
                          </p>
                        </div>
                        <div className="text-left text-xs text-muted-foreground" dir="ltr">
                          <p>{letterNumber(selected)}</p>
                          <p className="mt-1" dir="rtl">
                            {formatPersianDate(selected.created_at)}
                          </p>
                        </div>
                      </div>

                      <p className="mb-4 text-sm font-semibold text-foreground">با سلام و احترام،</p>
                      {letterBody ? (
                        <div className="whitespace-pre-wrap text-sm leading-8 text-foreground">
                          {letterBody}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">متن نامه ثبت نشده است.</p>
                      )}

                      {detailFields
                        .filter((item) => item.name !== "description" && item.name !== "recipient_comment")
                        .map(({ name, value, field }) => (
                          <div key={name} className="mt-4 border-t border-border/60 pt-3">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {field?.label || name}
                            </p>
                            <div className="mt-1 text-sm">{DisplayValue(value, field)}</div>
                          </div>
                        ))}

                      {dataStr(selected.data, "recipient_comment") && (
                        <div className="mt-5 rounded-xl border border-border bg-muted/30 px-4 py-3">
                          <p className="text-xs font-semibold text-muted-foreground">یادداشت فرستنده</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                            {dataStr(selected.data, "recipient_comment")}
                          </p>
                        </div>
                      )}

                      <div className="mt-10 text-left">
                        <p className="text-sm font-bold text-foreground">{letterSender(selected)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">شرکت وثوق</p>
                      </div>
                    </article>
                  </>
                ) : detailTab === "attachments" ? (
                  attachmentNames.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    پیوستی برای این نامه ثبت نشده است.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {attachmentNames.map((name, index) => (
                      <li key={`${name}-${index}`}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void downloadAttachment(index, name)}
                          className="flex h-auto w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Paperclip size={16} className="shrink-0 text-muted-foreground" />
                            <span className="truncate" title={name}>
                              {name}
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">
                            <Download size={14} />
                            دانلود
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )
                ) : detailTab === "workflow" ? (
                  <div className="space-y-5">
                    <section className="rounded-2xl border border-border bg-card p-5">
                      <h4 className="mb-4 text-sm font-bold text-foreground">گردش کار و پیگیری</h4>
                      {(selected.timeline?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          هنوز رویدادی برای این نامه ثبت نشده است.
                        </p>
                      ) : (
                        <ol className="relative space-y-4 border-r border-border pr-5">
                          {(selected.timeline ?? []).map((item) => (
                            <li key={item.id} className="relative">
                              <span className="absolute -right-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-teal-600 ring-4 ring-teal-100" />
                              <p className="text-sm font-bold text-foreground">
                                {timelineEventLabel(item)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.actor_name || "سامانه"} ·{" "}
                                {formatPersianDateTime(item.created_at)}
                              </p>
                              {item.note ? (
                                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">
                                  {item.note}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>

                    {(selected.referrals?.length ?? 0) > 0 && (
                      <section className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5">
                        <h4 className="mb-3 text-sm font-bold text-foreground">سوابق ارجاع</h4>
                        <div className="space-y-2">
                          {selected.referrals?.map((referral) => (
                            <div
                              key={referral.id}
                              className="rounded-xl border border-sky-100 bg-card px-3 py-2 text-xs text-sky-900"
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
                      </section>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <TaskConversation
                      submissionId={selected.id}
                      canRemind={Boolean(selected.can_act)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Mobile reading sheet */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 p-0 backdrop-blur-sm lg:hidden">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="جزئیات نامه"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-card/95 p-4 backdrop-blur">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-foreground">{letterTitle(selected)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {letterSender(selected)} · {formatPersianDateTime(selected.created_at)}
                </p>
              </div>
              <Button variant="outline" className="shrink-0 rounded-xl" onClick={() => setSelected(null)}>
                بستن
              </Button>
            </div>
            <div className="space-y-4 p-4">
              <LetterInfoBox letter={selected} />
              <article className="rounded-2xl border border-border p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">با سلام و احترام،</p>
                {letterBody ? (
                  <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {letterBody}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">متن نامه ثبت نشده است.</p>
                )}
              </article>
              {attachmentNames.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">پیوست‌ها</p>
                  {attachmentNames.map((name, index) => (
                    <Button
                      key={`${name}-${index}`}
                      type="button"
                      variant="outline"
                      onClick={() => void downloadAttachment(index, name)}
                      className="flex h-auto w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip size={14} />
                        <span className="truncate">{name}</span>
                      </span>
                      <Download size={14} className="shrink-0 text-primary" />
                    </Button>
                  ))}
                </div>
              )}
              <div className="rounded-2xl border border-border p-3">
                <TaskConversation
                  submissionId={selected.id}
                  canRemind={Boolean(selected.can_act)}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
