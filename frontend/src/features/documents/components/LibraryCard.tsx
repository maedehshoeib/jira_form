import { Download, Eye, FileText, Loader2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  libraryFileKind,
  libraryPreviewKind,
  type PdfFormItem,
  type PdfLibraryConfig,
} from "@/features/pdf-forms";

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} کیلوبایت`
    : `${(bytes / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;

export default function LibraryCard({
  item,
  config,
  Icon,
  isAdmin,
  working,
  onView,
  onDownload,
  onEdit,
  onDelete,
}: {
  item: PdfFormItem;
  config: PdfLibraryConfig;
  Icon: typeof FileText;
  isAdmin: boolean;
  working: boolean;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const previewKind = libraryPreviewKind(item.file_name);
  return (
    <article className="flex min-h-64 flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${config.accent.iconBg} ${config.accent.iconText}`}
        >
          <Icon size={23} />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                type="button"
                disabled={working}
                onClick={onEdit}
                aria-label={`ویرایش ${item.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
              >
                <Pencil size={16} />
              </Button>
              <Button
                type="button"
                disabled={working}
                onClick={onDelete}
                aria-label={`حذف ${item.title}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-card text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {libraryFileKind(item.file_name)} · {fileSize(item.file_size)}
          </span>
        </div>
      </div>
      <h2 className="mt-5 text-lg font-extrabold text-foreground">{item.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-7 text-muted-foreground">
        {item.description || config.defaultItemDescription}
      </p>
      <div className={previewKind ? "mt-5 grid grid-cols-2 gap-3" : "mt-5"}>
        {previewKind && (
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
        )}
        <Button
          type="button"
          disabled={working}
          onClick={onDownload}
          className={`h-11 gap-2 rounded-xl text-white ${config.accent.button} ${config.accent.buttonHover} ${
            previewKind ? "" : "w-full"
          }`}
        >
          <Download size={17} />
          دانلود
        </Button>
      </div>
    </article>
  );
}
