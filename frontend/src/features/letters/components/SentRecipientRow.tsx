"use client";

import type { ReactNode } from "react";
import { Eye, EyeOff, Forward } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPersianDateTime } from "@/lib/persianDate";
import { cn } from "@/lib/utils";

import type { SentRecipient } from "../sentLetters";

export const FINAL_RECIPIENT_STATUSES = new Set(["approved", "rejected"]);

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

/** The sender can re-refer a direct copy until it is closed (approved/rejected). */
export function canReferRecipient(row: SentRecipient) {
  return row.delivery_type !== "cc" && !FINAL_RECIPIENT_STATUSES.has(row.status);
}

type Props = {
  row: SentRecipient;
  canRefer: boolean;
  referOpen: boolean;
  onToggleRefer: () => void;
  /** Rendered under the row, e.g. the re-refer form. */
  children?: ReactNode;
};

export function SentRecipientRow({
  row,
  canRefer,
  referOpen,
  onToggleRefer,
  children,
}: Props) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{row.display_name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {row.referred_to ? `ارجاع به ${row.referred_to} · ` : ""}
            {row.delivery_type !== "cc"
              ? `پیشرفت ${(row.progress_percent ?? 0).toLocaleString("fa-IR")}٪ · `
              : ""}
            {formatPersianDateTime(row.status_updated_at) || "بدون تغییر وضعیت"}
          </p>
          {row.comment ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
              {row.comment}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {canRefer && canReferRecipient(row) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-expanded={referOpen}
              onClick={onToggleRefer}
              className="h-7 gap-1 rounded-lg border-sky-200 px-2.5 text-[11px] font-bold text-sky-700 hover:bg-sky-50"
            >
              <Forward size={12} />
              ارجاع مجدد
            </Button>
          ) : null}
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
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </li>
  );
}
