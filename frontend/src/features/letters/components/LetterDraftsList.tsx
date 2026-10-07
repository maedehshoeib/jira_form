"use client";

import Link from "next/link";
import { FilePenLine, Loader2, Paperclip, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { letterDraftEditHref, type LetterDraftSummary } from "@/api/letterDrafts";

type LetterDraftsListProps = {
  drafts: LetterDraftSummary[];
  loading: boolean;
  deletingId: number | null;
  onDelete: (draft: LetterDraftSummary) => void;
};

export function LetterDraftsList({
  drafts,
  loading,
  deletingId,
  onDelete,
}: LetterDraftsListProps) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={18} />
        در حال دریافت...
      </div>
    );
  }
  if (drafts.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        پیش‌نویسی ذخیره نشده است.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {drafts.map((draft) => (
        <li key={draft.id} className="flex items-start gap-2 px-4 py-3">
          <Link
            href={letterDraftEditHref(draft)}
            className="min-w-0 flex-1 space-y-1 rounded-lg text-right outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="line-clamp-1 text-sm font-semibold text-foreground">
                {draft.subject || "بدون موضوع"}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{draft.updated_at}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-[10px] text-amber-800"
              >
                <FilePenLine size={11} className="ml-1" />
                پیش‌نویس {draft.letter_type === "internal" ? "داخلی" : "برون‌سازمانی"}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <Users size={11} />
                {draft.recipient_count.toLocaleString("fa-IR")}
              </span>
              {draft.attachment_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip size={11} />
                  {draft.attachment_count.toLocaleString("fa-IR")}
                </span>
              )}
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="حذف پیش‌نویس"
            disabled={deletingId === draft.id}
            onClick={() => onDelete(draft)}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
          >
            {deletingId === draft.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </Button>
        </li>
      ))}
    </ul>
  );
}
