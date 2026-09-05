import { Label } from "@/components/ui/label";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  FileText,
  Loader2,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import AppShell from "@/components/layout/AppShell";
import RedirectTo from "@/app/_components/RedirectTo";
import UserDisplayName from "@/components/UserDisplayName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE } from "@/config/portal";
import { normalizePersianDate, PERSIAN_DATE_FORMAT } from "@/lib/persianDate";
import { LETTER_WORKFLOWS, LetterType } from "./letterWorkflow";

type LetterRecipient = {
  id: number;
  username: string;
  display_name: string;
  department: string;
  job_title: string;
  birth_date?: string | null;
  is_birthday?: boolean;
};

type LetterSendResponse = {
  system_letter_number: string;
};

const NEEDS_REPLY_OPTIONS = ["دارد", "ندارد"] as const;
const NEEDS_ACTION_OPTIONS = ["دارد", "ندارد(جهت اطلاع)"] as const;
const SENDER_OPTIONS = [
  "بانک",
  "شرکت های گروه",
  "سایر",
  "هلدینگ",
] as const;
const HOLDING_OPTIONS = [
  "فناوری اطلاعات",
  "مالی",
  "کسب و کار",
  "سایر",
] as const;

type NeedsReplyOption = (typeof NEEDS_REPLY_OPTIONS)[number];
type NeedsActionOption = (typeof NEEDS_ACTION_OPTIONS)[number];
type SenderOption = (typeof SENDER_OPTIONS)[number];
type HoldingOption = (typeof HOLDING_OPTIONS)[number];

function apiErrorDetail(err: unknown, fallback: string) {
  if (!err || typeof err !== "object" || !("response" in err)) return fallback;
  const detail = (err as { response?: { data?: { detail?: unknown } } }).response
    ?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
}

function formatSenderLabel(
  sender: SenderOption | "",
  holdingUnit: HoldingOption | "",
) {
  if (!sender) return "—";
  if (sender === "هلدینگ" && holdingUnit) return `هلدینگ / ${holdingUnit}`;
  return sender;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLocaleLowerCase("en").endsWith(".pdf")
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SenderDropdown({
  sender,
  holdingUnit,
  onSelect,
}: {
  sender: SenderOption | "";
  holdingUnit: HoldingOption | "";
  onSelect: (nextSender: SenderOption, nextHolding: HoldingOption | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const [holdingOpen, setHoldingOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHoldingOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setHoldingOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = formatSenderLabel(sender, holdingUnit);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-border bg-card px-3 text-sm shadow-sm outline-none transition focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={sender ? "font-semibold text-foreground" : "text-muted-foreground"}>
          {sender ? label : "انتخاب فرستنده"}
        </span>
        <ChevronLeft
          size={16}
          className={`text-muted-foreground transition ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </Button>

      {open && (
        <div
          role="listbox"
          className="absolute z-40 mt-2 w-full rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {SENDER_OPTIONS.map((option) => {
            if (option === "هلدینگ") {
              return (
                <div
                  key={option}
                  className="relative"
                  onMouseEnter={() => setHoldingOpen(true)}
                  onMouseLeave={() => setHoldingOpen(false)}
                >
                  <Button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                      sender === "هلدینگ"
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/40"
                    }`}
                    onClick={() => setHoldingOpen((current) => !current)}
                  >
                    هلدینگ
                    <ChevronLeft
                      size={14}
                      className={`text-muted-foreground transition ${
                        holdingOpen ? "-rotate-90" : "rotate-90"
                      }`}
                    />
                  </Button>
                  {holdingOpen && (
                    <div className="mr-3 mt-1 space-y-0.5 border-r border-border pr-2">
                      {HOLDING_OPTIONS.map((unit) => (
                        <Button
                          key={unit}
                          type="button"
                          role="option"
                          className={`block w-full rounded-lg px-3 py-2 text-right text-sm font-semibold transition ${
                            sender === "هلدینگ" && holdingUnit === unit
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted/40"
                          }`}
                          onClick={() => {
                            onSelect("هلدینگ", unit);
                            setOpen(false);
                            setHoldingOpen(false);
                          }}
                        >
                          {unit}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Button
                key={option}
                type="button"
                role="option"
                className={`block w-full rounded-lg px-3 py-2.5 text-right text-sm font-semibold transition ${
                  sender === option
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted/40"
                }`}
                onClick={() => {
                  onSelect(option, "");
                  setOpen(false);
                  setHoldingOpen(false);
                }}
              >
                {option}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SendLetterPage({ letterType }: { letterType: LetterType }) {
  const workflow = LETTER_WORKFLOWS[letterType];
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [recipients, setRecipients] = useState<LetterRecipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [ccIds, setCcIds] = useState<Set<number>>(new Set());
  const [sharedComment, setSharedComment] = useState("");
  const [commentTargetIds, setCommentTargetIds] = useState<Set<number>>(
    new Set(),
  );
  const [recipientComments, setRecipientComments] = useState<
    Record<number, string>
  >({});
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [letterNumber, setLetterNumber] = useState("");
  const [needsReply, setNeedsReply] = useState<NeedsReplyOption | "">("");
  const [needsAction, setNeedsAction] = useState<NeedsActionOption | "">("");
  const [dueDate, setDueDate] = useState("");
  const [sender, setSender] = useState<SenderOption | "">("");
  const [holdingUnit, setHoldingUnit] = useState<HoldingOption | "">("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedSystemLetterNumber, setSubmittedSystemLetterNumber] = useState("");
  const [error, setError] = useState("");

  const attachmentPreviewUrls = useMemo(
    () =>
      attachments.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [attachments],
  );

  useEffect(() => {
    return () => {
      attachmentPreviewUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [attachmentPreviewUrls]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const access = await client.get<{ allowed: boolean }>(
          endpoints.managementLetterAccess,
          { params: { letter_type: letterType } },
        );
        if (!active) return;
        setAllowed(access.data.allowed);
        if (!access.data.allowed) return;
        const { data } = await client.get<LetterRecipient[]>(
          endpoints.managementLetterRecipients,
          { params: { letter_type: letterType } },
        );
        if (!active) return;
        setRecipients(data);
      } catch {
        if (active) {
          setAllowed(false);
          setError("دریافت اطلاعات ارسال نامه با مشکل مواجه شد.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [letterType]);

  useEffect(() => {
    if (!reviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setReviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [reviewOpen, saving]);

  const filteredRecipients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa");
    if (!query) return recipients;
    return recipients.filter((user) =>
      [user.display_name, user.username, user.department, user.job_title]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(query),
    );
  }, [recipients, search]);

  const selectedRecipients = useMemo(
    () => recipients.filter((user) => selectedIds.has(user.id) || ccIds.has(user.id)),
    [ccIds, recipients, selectedIds],
  );

  const setRecipientSelected = (id: number, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
    if (selected) {
      setCcIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
    setCommentTargetIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!selected && !ccIds.has(id)) {
      setRecipientComments((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const setCcSelected = (id: number, selected: boolean) => {
    setCcIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
    if (selected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setCommentTargetIds((current) => new Set(current).add(id));
    } else if (!selectedIds.has(id)) {
      setCommentTargetIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setRecipientComments((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const toggleCommentTarget = (id: number) => {
    setCommentTargetIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySharedComment = () => {
    const comment = sharedComment.trim();
    if (!comment || commentTargetIds.size === 0) return;
    setRecipientComments((current) => {
      const next = { ...current };
      commentTargetIds.forEach((id) => {
        if (selectedIds.has(id) || ccIds.has(id)) next[id] = comment;
      });
      return next;
    });
    setSharedComment("");
  };

  const resetForm = ({ keepDone = false }: { keepDone?: boolean } = {}) => {
    setSubject("");
    setDescription("");
    setLetterNumber("");
    setNeedsReply("");
    setNeedsAction("");
    setDueDate("");
    setSender("");
    setHoldingUnit("");
    setAttachments([]);
    setSelectedIds(new Set());
    setCcIds(new Set());
    setSharedComment("");
    setCommentTargetIds(new Set());
    setRecipientComments({});
    if (!keepDone) {
      setDone(false);
      setSubmittedSystemLetterNumber("");
    }
    setError("");
  };

  const validateForm = () => {
    if (!subject.trim() || !description.trim()) {
      return "موضوع و توضیحات الزامی است.";
    }
    if (letterType === "external" && !letterNumber.trim()) {
      return "شماره نامه الزامی است.";
    }
    if (!needsReply) {
      return "نیاز به پاسخ را مشخص کنید.";
    }
    if (!needsAction) {
      return "نیاز به اقدام را مشخص کنید.";
    }
    if ((needsReply === "دارد" || needsAction === "دارد") && !dueDate.trim()) {
      return "مهلت انجام را مشخص کنید.";
    }
    if (letterType === "external" && !sender) {
      return "فرستنده را انتخاب کنید.";
    }
    if (letterType === "external" && sender === "هلدینگ" && !holdingUnit) {
      return "واحد هلدینگ را انتخاب کنید.";
    }
    if (selectedIds.size + ccIds.size === 0) {
      return "حداقل یک گیرنده را انتخاب کنید.";
    }
    if (sharedComment.trim()) {
      return "برای ثبت یادداشت مشترک، ابتدا دکمه «اعمال» را بزنید.";
    }
    return "";
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setDone(false);
    setReviewOpen(true);
  };

  const confirmSend = async () => {
    if (saving) return;
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setReviewOpen(false);
      return;
    }

    setSaving(true);
    setError("");
    setDone(false);

    const fd = new FormData();
    fd.append("letter_type", letterType);
    fd.append("subject", subject.trim());
    fd.append("description", description.trim());
    if (letterType === "external") {
      fd.append("letter_number", letterNumber.trim());
    }
    fd.append("needs_reply", needsReply);
    fd.append("needs_action", needsAction);
    fd.append(
      "due_date",
      needsReply === "دارد" || needsAction === "دارد" ? dueDate.trim() : "",
    );
    if (letterType === "external") {
      fd.append("sender", sender);
      fd.append("sender_detail", sender === "هلدینگ" ? holdingUnit : "");
    }
    fd.append("recipient_ids", JSON.stringify([...selectedIds]));
    fd.append("cc_recipient_ids", JSON.stringify([...ccIds]));
    fd.append(
      "recipient_comments",
      JSON.stringify(
        Object.fromEntries(
          [...selectedIds, ...ccIds]
            .map((id) => [String(id), (recipientComments[id] || "").trim()])
            .filter(([, comment]) => Boolean(comment)),
        ),
      ),
    );
    attachments.forEach((file) => fd.append("attachments", file));

    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_BASE}${endpoints.managementLetters}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const payload = (await res.json().catch(() => null)) as
        | (Partial<LetterSendResponse> & { detail?: unknown })
        | null;
      if (!res.ok) {
        throw new Error(
          typeof payload?.detail === "string"
            ? payload.detail
            : "ارسال نامه انجام نشد.",
        );
      }
      setReviewOpen(false);
      resetForm({ keepDone: true });
      setSubmittedSystemLetterNumber(
        typeof payload?.system_letter_number === "string"
          ? payload.system_letter_number
          : "",
      );
      setDone(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : apiErrorDetail(requestError, "ارسال نامه انجام نشد."),
      );
      setReviewOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (allowed === false) {
    return <RedirectTo href="/" />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <Link
          href={workflow.homePath}
          className="inline-flex items-center gap-2 font-semibold text-primary hover:text-primary"
        >
          <ChevronLeft size={18} />
          بازگشت
        </Link>

        <div className="mt-8 mb-8 rounded-3xl bg-card p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Send size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">
                {workflow.sendTitle}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                هر مخاطب را به‌صورت «مستقیم» (وظیفه) یا «رونوشت» (اعلان فقط‌خواندنی) انتخاب کنید
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl bg-card shadow-sm">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-3xl border border-border bg-card p-8 shadow-xl"
          >
            {done && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                <CheckCircle2 size={20} />
                <div>
                  <p>نامه با موفقیت ارسال شد؛ گیرندگان مستقیم آن را در وظایف و افراد رونوشت‌شده آن را به‌صورت اعلان دریافت کردند.</p>
                  {submittedSystemLetterNumber && (
                    <p className="mt-1 font-extrabold">
                      شماره نامه سیستمی: {submittedSystemLetterNumber}
                    </p>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary">
                {error}
              </div>
            )}

            <div>
              <Label className="mb-2 block text-sm font-bold text-foreground">
                موضوع درخواست
              </Label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                className="h-12 rounded-xl"
                placeholder="موضوع نامه"
              />
            </div>

            {letterType === "external" && (
              <div>
                <Label className="mb-2 block text-sm font-bold text-foreground">
                  شماره نامه
                </Label>
                <Input
                  value={letterNumber}
                  onChange={(event) => setLetterNumber(event.target.value)}
                  required
                  className="h-12 rounded-xl"
                  placeholder="شماره نامه"
                />
              </div>
            )}

            <div>
              <Label className="mb-2 block text-sm font-bold text-foreground">
                شماره نامه سیستمی
              </Label>
              <Input
                value={`پس از ارسال، به‌صورت خودکار صادر می‌شود (مانند ${workflow.numberExample})`}
                readOnly
                aria-readonly="true"
                className="h-12 rounded-xl bg-muted/40 text-muted-foreground"
              />
            </div>

            <div>
              <Label className="mb-2 block text-sm font-bold text-foreground">
                نیاز به پاسخ
              </Label>
              <Select
                value={needsReply || undefined}
                onValueChange={(value) => {
                  const next = value as NeedsReplyOption;
                  setNeedsReply(next);
                  if (next !== "دارد" && needsAction !== "دارد") setDueDate("");
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-xl border-border bg-card text-right shadow-sm">
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {NEEDS_REPLY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-bold text-foreground">
                نیاز به اقدام
              </Label>
              <Select
                value={needsAction || undefined}
                onValueChange={(value) => {
                  const next = value as NeedsActionOption;
                  setNeedsAction(next);
                  if (next !== "دارد" && needsReply !== "دارد") setDueDate("");
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-xl border-border bg-card text-right shadow-sm">
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {NEEDS_ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(needsReply === "دارد" || needsAction === "دارد") && (
              <div>
                <Label className="mb-2 block text-sm font-bold text-foreground">
                  مهلت انجام
                </Label>
                <DatePicker
                  calendar={persian}
                  locale={persian_fa}
                  format={PERSIAN_DATE_FORMAT}
                  value={dueDate || undefined}
                  onChange={(date) => setDueDate(normalizePersianDate(date))}
                  inputClass="w-full h-12 rounded-xl border border-border bg-card px-4 text-right shadow-sm outline-none focus:border-red-500"
                  calendarPosition="bottom-right"
                  placeholder="انتخاب تاریخ"
                  containerClassName="w-full"
                />
              </div>
            )}

            {letterType === "external" && (
              <div>
                <Label className="mb-2 block text-sm font-bold text-foreground">
                  فرستنده
                </Label>
                <SenderDropdown
                  sender={sender}
                  holdingUnit={holdingUnit}
                  onSelect={(nextSender, nextHolding) => {
                    setSender(nextSender);
                    setHoldingUnit(nextHolding);
                  }}
                />
              </div>
            )}

            <div>
              <Label className="mb-2 block text-sm font-bold text-foreground">
                توضیحات
              </Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={6}
                className="rounded-xl"
                placeholder="شرح نامه"
              />
            </div>

            <div>
              <Label className="mb-2 block text-sm font-bold text-foreground">
                پیوست‌ها
                <span className="mr-2 text-xs font-medium text-muted-foreground">
                  (امکان انتخاب چند فایل)
                </span>
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <Label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted">
                  <Paperclip size={16} />
                  افزودن فایل
                  <Input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []);
                      if (!files.length) return;
                      setAttachments((current) => {
                        const existing = new Set(
                          current.map((file) => `${file.name}:${file.size}`),
                        );
                        const next = [...current];
                        files.forEach((file) => {
                          const key = `${file.name}:${file.size}`;
                          if (!existing.has(key)) next.push(file);
                        });
                        return next;
                      });
                      event.target.value = "";
                    }}
                  />
                </Label>
                {attachments.map((file, index) => (
                  <span
                    key={`${file.name}-${file.size}-${index}`}
                    className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    {file.name}
                    <Button
                      type="button"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="text-muted-foreground hover:text-primary"
                      aria-label="حذف پیوست"
                    >
                      <X size={14} />
                    </Button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <Label className="text-sm font-bold text-foreground">
                  مخاطبان نامه
                  <span className="mr-2 text-xs font-medium text-muted-foreground">
                    ({(selectedIds.size + ccIds.size).toLocaleString("fa-IR")} انتخاب‌شده)
                  </span>
                </Label>
                <div className="relative w-full max-w-xs">
                  <Search
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="جستجوی گیرنده"
                    className="h-10 rounded-xl pr-9"
                  />
                </div>
              </div>

              {recipients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                  {letterType === "internal"
                    ? "کاربر فعال دیگری برای دریافت نامه یافت نشد."
                    : "هنوز گیرنده‌ای توسط مدیر سیستم مشخص نشده است. از بخش مدیریت کاربران، گزینه «دریافت‌کننده نامه‌های برون‌سازمانی» را فعال کنید."}
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border p-3">
                  {filteredRecipients.map((user) => {
                    const isDirect = selectedIds.has(user.id);
                    const isCc = ccIds.has(user.id);
                    const checked = isDirect || isCc;
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center gap-3 rounded-xl p-3 text-sm transition ${
                          checked
                            ? "bg-primary/10 ring-1 ring-red-200"
                            : "bg-muted/40 hover:bg-muted"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground">
                            <UserDisplayName user={user} />
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {[user.department, user.job_title]
                              .filter(Boolean)
                            .join(" · ") || user.username}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${isDirect ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                            <Input
                              type="checkbox"
                              checked={isDirect}
                              onChange={(event) => setRecipientSelected(user.id, event.target.checked)}
                              className="sr-only"
                            />
                            مستقیم
                          </Label>
                          <Label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${isCc ? "border-violet-500 bg-violet-50 text-violet-700" : "border-border bg-card text-muted-foreground"}`}>
                            <Input
                              type="checkbox"
                              checked={isCc}
                              onChange={(event) => setCcSelected(user.id, event.target.checked)}
                              className="sr-only"
                            />
                            رونوشت (CC)
                          </Label>
                        </div>
                      </div>
                    );
                  })}
                  {filteredRecipients.length === 0 && (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      گیرنده‌ای با این جستجو یافت نشد.
                    </p>
                  )}
                </div>
              )}
            </div>

            <section className="rounded-2xl border border-border bg-muted/40 p-5">
              <div>
                <h3 className="text-sm font-extrabold text-foreground">
                  یادداشت برای گیرندگان
                </h3>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  یک یادداشت را برای همه یا چند گیرنده اعمال کنید و در صورت
                  نیاز، متن هر نفر را جداگانه تغییر دهید.
                </p>
              </div>

              {selectedRecipients.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                  ابتدا حداقل یک گیرنده را انتخاب کنید.
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <Label className="text-sm font-bold text-foreground">
                      یادداشت مشترک
                    </Label>
                    <Textarea
                      value={sharedComment}
                      onChange={(event) => setSharedComment(event.target.value)}
                      rows={3}
                      maxLength={4000}
                      className="mt-2 rounded-xl"
                      placeholder="متن یادداشت را بنویسید"
                    />

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-muted-foreground">
                        این یادداشت برای چه کسانی اعمال شود؟
                      </p>
                      <div className="flex gap-3 text-xs font-bold">
                        <Button
                          type="button"
                          onClick={() =>
                            setCommentTargetIds(new Set([...selectedIds, ...ccIds]))
                          }
                          className="text-primary hover:text-primary"
                        >
                          انتخاب همه
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setCommentTargetIds(new Set())}
                          className="text-muted-foreground hover:text-muted-foreground"
                        >
                          لغو انتخاب
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
                      {selectedRecipients.map((user) => (
                        <Label
                          key={user.id}
                          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            commentTargetIds.has(user.id)
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          <Input
                            type="checkbox"
                            checked={commentTargetIds.has(user.id)}
                            onChange={() => toggleCommentTarget(user.id)}
                            className="h-3.5 w-3.5 accent-red-600"
                          />
                          <UserDisplayName user={user} />
                        </Label>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          !sharedComment.trim() || commentTargetIds.size === 0
                        }
                        onClick={applySharedComment}
                        className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                      >
                        اعمال برای{" "}
                        {commentTargetIds.size.toLocaleString("fa-IR")} گیرنده
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        اعمال یادداشت، متن فعلی گیرندگان انتخاب‌شده را جایگزین
                        می‌کند.
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-bold text-foreground">
                      یادداشت اختصاصی هر گیرنده
                    </p>
                    <div className="max-h-[32rem] space-y-3 overflow-y-auto pl-1">
                      {selectedRecipients.map((user) => (
                        <div
                          key={user.id}
                          className="rounded-2xl border border-border bg-card p-4"
                        >
                          <Label className="text-sm font-bold text-foreground">
                            <UserDisplayName user={user} />
                          </Label>
                          <Textarea
                            value={recipientComments[user.id] || ""}
                            onChange={(event) =>
                              setRecipientComments((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            maxLength={4000}
                            className="mt-2 rounded-xl"
                            placeholder="یادداشت اختصاصی این گیرنده (اختیاری)"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="flex justify-end gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => resetForm()}
                className="rounded-xl"
              >
                پاک کردن
              </Button>
              <Button
                disabled={saving || recipients.length === 0}
                className="gap-2 rounded-xl bg-primary px-6 hover:bg-primary/90"
              >
                ارسال نامه
              </Button>
            </div>
          </form>
        )}
      </div>

      {reviewOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          dir="rtl"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setReviewOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="letter-review-title"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2
                  id="letter-review-title"
                  className="text-lg font-extrabold text-foreground"
                >
                  بررسی نهایی نامه
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  قبل از ارسال، اطلاعات را مرور کنید
                </p>
              </div>
              <Button
                type="button"
                disabled={saving}
                onClick={() => setReviewOpen(false)}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="بستن"
              >
                <X size={18} />
              </Button>
            </header>

            <div className="space-y-4 overflow-y-auto px-5 py-5 text-sm">
              <ReviewRow label="موضوع" value={subject.trim()} />
              {letterType === "external" && (
                <ReviewRow label="شماره نامه" value={letterNumber.trim()} />
              )}
              <ReviewRow
                label="شماره نامه سیستمی"
                value="پس از تأیید و ارسال صادر می‌شود"
              />
              <ReviewRow label="نیاز به پاسخ" value={needsReply || "—"} />
              <ReviewRow label="نیاز به اقدام" value={needsAction || "—"} />
              {(needsReply === "دارد" || needsAction === "دارد") && (
                <ReviewRow label="مهلت انجام" value={dueDate || "—"} />
              )}
              {letterType === "external" && (
                <ReviewRow
                  label="فرستنده"
                  value={formatSenderLabel(sender, holdingUnit)}
                />
              )}
              <ReviewRow label="توضیحات" value={description.trim()} multiline />
              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">پیوست‌ها</p>
                {attachmentPreviewUrls.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 font-semibold text-foreground">
                    بدون پیوست
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attachmentPreviewUrls.map(({ file, url }, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="overflow-hidden rounded-2xl border border-border bg-muted/40"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {file.name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-xs font-bold text-primary hover:underline"
                          >
                            مشاهده
                          </a>
                        </div>
                        {isImageFile(file) ? (
                          <div className="bg-card p-3">
                            <img
                              src={url}
                              alt={file.name}
                              className="mx-auto max-h-56 w-auto max-w-full rounded-xl object-contain"
                            />
                          </div>
                        ) : isPdfFile(file) ? (
                          <iframe
                            title={file.name}
                            src={url}
                            className="h-64 w-full bg-card"
                          />
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-5 text-muted-foreground">
                            <FileText size={28} className="shrink-0 text-muted-foreground" />
                            <p className="text-sm font-semibold">
                              پیش‌نمایش برای این نوع فایل در دسترس نیست
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold text-muted-foreground">
                  گیرندگان و یادداشت‌ها
                </p>
                <div className="space-y-2">
                  {selectedRecipients.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-border bg-muted/40 px-4 py-3"
                    >
                      <p className="font-bold text-foreground">
                        <UserDisplayName user={user} />
                        <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${ccIds.has(user.id) ? "bg-violet-100 text-violet-700" : "bg-primary/10 text-primary"}`}>
                          {ccIds.has(user.id) ? "رونوشت (اعلان)" : "گیرنده مستقیم (وظیفه)"}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                        {(recipientComments[user.id] || "").trim() ||
                          "بدون یادداشت"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setReviewOpen(false)}
                className="rounded-xl"
              >
                بازگشت و ویرایش
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void confirmSend()}
                className="gap-2 rounded-xl bg-primary px-6 hover:bg-primary/90"
              >
                {saving && <Loader2 className="animate-spin" size={16} />}
                تأیید و ارسال
              </Button>
            </footer>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function ReviewRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-semibold text-foreground ${
          multiline ? "whitespace-pre-wrap leading-7" : ""
        }`}
      >
        {value || "—"}
      </p>
    </div>
  );
}
