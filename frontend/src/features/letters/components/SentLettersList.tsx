"use client";

import { Eye, Loader2, Paperclip, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPersianDateTime } from "@/lib/persianDate";
import { cn } from "@/lib/utils";

import {
  sentAttachmentNames,
  sentIsOverdue,
  sentReadSummary,
  sentStatusLabel,
  type SentLetter,
} from "../sentLetters";

type SentLettersListProps = {
  letters: SentLetter[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (letter: SentLetter) => void;
};

function recipientNames(letter: SentLetter) {
  const names = letter.recipients.map((row) => row.display_name);
  if (names.length <= 2) return names.join("، ");
  return `${names.slice(0, 2).join("، ")} و ${(names.length - 2).toLocaleString("fa-IR")} نفر دیگر`;
}

export function SentLettersList({ letters, loading, selectedId, onSelect }: SentLettersListProps) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
        در حال دریافت...
      </div>
    );
  }
  if (letters.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        نامه‌ای در این پوشه نیست.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {letters.map((letter) => {
        const active = selectedId === letter.batch_id;
        const read = sentReadSummary(letter);
        const attachments = sentAttachmentNames(letter).length;
        return (
          <li key={letter.batch_id}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSelect(letter)}
              className={cn(
                "h-auto w-full flex-col items-stretch gap-1 rounded-none px-4 py-3 text-right whitespace-normal",
                active && "bg-primary/10",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-1 text-sm font-semibold text-foreground">
                  {letter.subject || "نامه"}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatPersianDateTime(letter.created_at)}
                </span>
              </div>
              <p className="line-clamp-1 text-sm text-foreground/80">
                از: {letter.sent_by || "فرستنده نامشخص"}
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                به: {recipientNames(letter) || "—"}
              </p>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    sentIsOverdue(letter)
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-slate-200 bg-slate-50 text-slate-700",
                  )}
                >
                  {sentStatusLabel(letter)}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Eye size={11} />
                  {read.read.toLocaleString("fa-IR")}/{read.total.toLocaleString("fa-IR")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users size={11} />
                  {letter.letter_type === "internal" ? "داخلی" : "برون‌سازمانی"}
                </span>
                {attachments > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip size={11} />
                    {attachments.toLocaleString("fa-IR")}
                  </span>
                )}
              </div>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
