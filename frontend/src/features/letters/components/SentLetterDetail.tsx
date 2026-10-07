"use client";

import { useState } from "react";
import { Download, Eye, EyeOff, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/portal";
import { formatPersianDate, formatPersianDateTime } from "@/lib/persianDate";
import { cn } from "@/lib/utils";

import { downloadAuthFile } from "../download";
import {
  sentAttachmentNames,
  sentIsOverdue,
  sentReadSummary,
  sentStatusLabel,
  type SentLetter,
  type SentRecipient,
} from "../sentLetters";

function recipientStatus(row: SentRecipient) {
  if (row.delivery_type === "cc") return "رونوشت";
  if (row.status === "in_progress") return "در حال انجام";
  if (row.status === "approved") return "انجام‌شده";
  if (row.status === "rejected") return "رد‌شده";
  if (row.status === "referred") return "ارجاع‌شده";
  return "اقدام‌نشده";
}

function recipientStatusClass(row: SentRecipient) {
  if (row.delivery_type === "cc") return "border-violet-200 bg-violet-50 text-violet-700";
  if (row.status === "in_progress") return "border-sky-200 bg-sky-50 text-sky-700";
  if (row.status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (row.status === "rejected") return "border-primary/30 bg-primary/10 text-primary";
  if (row.status === "referred") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function letterSender(letter: SentLetter) {
  const sender = (letter.sender || "").trim();
  const detail = (letter.sender_detail || "").trim();
  if (sender === "هلدینگ" && detail) return `هلدینگ / ${detail}`;
  return sender || letter.sent_by;
}

export function SentLetterDetail({ letter }: { letter: SentLetter }) {
  const [error, setError] = useState("");
  const attachments = sentAttachmentNames(letter);
  const read = sentReadSummary(letter);
  const meta = [
    {
      label: "شماره نامه",
      value: letter.system_letter_number || letter.letter_number || "—",
      dir: "ltr" as const,
    },
    { label: "تاریخ ارسال", value: formatPersianDate(letter.created_at) || "—" },
    { label: "فرستنده", value: letterSender(letter) },
    { label: "مهلت انجام", value: letter.due_date || "—" },
  ];

  const download = async (index: number, name: string) => {
    const submissionId = letter.recipients[0]?.submission_id;
    if (!submissionId) return;
    const ok = await downloadAuthFile(
      `${API_BASE}/submissions/${submissionId}/attachment?index=${index}`,
      name,
    );
    setError(ok ? "" : "دانلود پیوست با مشکل مواجه شد.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="max-w-3xl text-xl font-extrabold leading-8 text-foreground">
          {letter.subject || "نامه"}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">
            {letter.letter_type === "internal" ? "نامه داخلی" : "نامه برون‌سازمانی"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              sentIsOverdue(letter)
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-slate-200 bg-slate-50 text-slate-700",
            )}
          >
            {sentStatusLabel(letter)}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            خوانده‌شده {read.read.toLocaleString("fa-IR")} از {read.total.toLocaleString("fa-IR")}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
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

      {error && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {error}
        </div>
      )}

      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {letter.description ? (
          <div className="whitespace-pre-wrap text-sm leading-8 text-foreground">
            {letter.description}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">متن نامه ثبت نشده است.</p>
        )}
        {attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
            {attachments.map((name, index) => (
              <Button
                key={`${name}-${index}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void download(index, name)}
                className="h-8 gap-1.5 rounded-lg text-xs"
              >
                <Paperclip size={12} />
                <span className="max-w-48 truncate">{name}</span>
                <Download size={12} className="text-primary" />
              </Button>
            ))}
          </div>
        )}
      </article>

      <section className="rounded-2xl border border-border bg-card">
        <h4 className="border-b border-border px-4 py-3 text-sm font-bold text-foreground">
          گیرندگان و پیگیری
        </h4>
        <ul className="divide-y divide-border">
          {letter.recipients.map((row) => (
            <li
              key={row.submission_id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{row.display_name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {row.referred_to ? `ارجاع به ${row.referred_to} · ` : ""}
                  {formatPersianDateTime(row.status_updated_at) || "بدون تغییر وضعیت"}
                </p>
                {row.comment ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {row.comment}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-[10px]",
                    row.is_read
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {row.is_read ? <Eye size={11} /> : <EyeOff size={11} />}
                  {row.is_read ? "خوانده شد" : "خوانده نشده"}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px]", recipientStatusClass(row))}>
                  {recipientStatus(row)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
