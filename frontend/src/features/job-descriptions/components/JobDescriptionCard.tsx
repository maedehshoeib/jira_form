import {
  Download,
  Eye,
  Briefcase,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type { JobDescriptionItem } from "../types";

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} کیلوبایت`
    : `${(bytes / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;

type JobDescriptionCardProps = {
  item: JobDescriptionItem;
  isAdmin: boolean;
  working: boolean;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function JobDescriptionCard({
  item,
  isAdmin,
  working,
  onView,
  onDownload,
  onEdit,
  onDelete,
}: JobDescriptionCardProps) {
  return (
    <article className="flex min-h-64 flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        {item.photo_url ? (
          <img
            src={item.photo_url}
            alt={item.organizational_position}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Briefcase size={24} />
          </div>
        )}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                type="button"
                disabled={working}
                onClick={onEdit}
                aria-label={`ویرایش ${item.organizational_position}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
              >
                <Pencil size={16} />
              </Button>
              <Button
                type="button"
                disabled={working}
                onClick={onDelete}
                aria-label={`حذف ${item.organizational_position}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-card text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
          {item.has_attachment && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              فایل · {fileSize(item.attachment_size)}
            </span>
          )}
        </div>
      </div>

      <h2 className="mt-5 text-lg font-extrabold text-foreground">
        {item.organizational_position}
      </h2>
      <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        {item.organizational_unit}
      </p>
      <p className="mt-3 flex-1 line-clamp-3 text-sm leading-7 text-muted-foreground">
        {item.unit_responsibility}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={onView}
          className="h-11 gap-2 rounded-xl"
        >
          {working ? <Loader2 size={17} className="animate-spin" /> : <Eye size={17} />}
          مشاهده
        </Button>
        <Button
          type="button"
          disabled={working || !item.has_attachment}
          onClick={onDownload}
          className="h-11 gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Download size={17} />
          دانلود فایل
        </Button>
      </div>
    </article>
  );
}
