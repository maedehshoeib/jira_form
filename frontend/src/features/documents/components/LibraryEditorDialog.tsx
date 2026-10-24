import { FormEvent } from "react";
import { FilePlus2, Loader2, Pencil, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LIBRARY_FILE_ACCEPT,
  LIBRARY_UPLOAD_HINT,
  libraryFileRejection,
  type PdfLibraryConfig,
} from "@/features/pdf-forms";

type EditorMode = "create" | "edit";

type LibraryEditorDialogProps = {
  config: PdfLibraryConfig;
  mode: EditorMode;
  title: string;
  description: string;
  file: File | null;
  existingFileName: string;
  saving: boolean;
  error: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onReject: (message: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

export default function LibraryEditorDialog({
  config,
  mode,
  title,
  description,
  file,
  existingFileName,
  saving,
  error,
  onTitleChange,
  onDescriptionChange,
  onFileChange,
  onReject,
  onClose,
  onSubmit,
}: LibraryEditorDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-library-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <form
        dir="rtl"
        onSubmit={onSubmit}
        className="w-full max-w-xl rounded-3xl bg-card p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${config.accent.iconBg} ${config.accent.iconText}`}
            >
              {mode === "create" ? <FilePlus2 size={24} /> : <Pencil size={24} />}
            </div>
            <div>
              <h2 id="pdf-library-editor-title" className="text-xl font-extrabold text-foreground">
                {mode === "create" ? config.addLabel : `ویرایش ${config.singular}`}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {mode === "create"
                  ? "فایل و اطلاعات مرتبط با آن را وارد کنید."
                  : "عنوان، توضیحات یا فایل را به‌روزرسانی کنید."}
              </p>
            </div>
          </div>
          <Button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="بستن پنجره"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="space-y-5">
          <Label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">عنوان {config.singular}</span>
            <Input
              required
              autoFocus
              maxLength={256}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={`عنوان ${config.singular}`}
              className={`h-12 w-full rounded-xl border border-border px-4 outline-none transition focus:ring-4 ${config.accent.focusBorder} ${config.accent.focusRing}`}
            />
          </Label>

          <Label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">توضیحات</span>
            <Textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder={`توضیح کوتاهی درباره ${config.singular}`}
              className={`w-full resize-none rounded-xl border border-border px-4 py-3 outline-none transition focus:ring-4 ${config.accent.focusBorder} ${config.accent.focusRing}`}
            />
          </Label>

          <Label className="block">
            <span className="mb-2 block text-sm font-bold text-foreground">
              فایل
              {mode === "edit" && (
                <span className="mr-2 font-normal text-muted-foreground">(اختیاری — برای جایگزینی فایل)</span>
              )}
            </span>
            <span className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 text-center transition hover:border-border hover:bg-muted/70">
              <Upload size={23} className={`mb-2 ${config.accent.iconText}`} />
              <span className="max-w-full truncate text-sm font-bold text-foreground">
                {file?.name ||
                  (mode === "edit" ? existingFileName || "برای جایگزینی فایل کلیک کنید" : "برای انتخاب فایل کلیک کنید")}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{LIBRARY_UPLOAD_HINT}</span>
              <Input
                type="file"
                required={mode === "create"}
                accept={LIBRARY_FILE_ACCEPT}
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  if (!selected) {
                    onFileChange(null);
                    return;
                  }
                  const rejection = libraryFileRejection(selected);
                  if (rejection) {
                    onFileChange(null);
                    onReject(rejection);
                    event.target.value = "";
                    return;
                  }
                  onReject("");
                  onFileChange(selected);
                }}
              />
            </span>
          </Label>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose} className="h-11 rounded-xl px-5">
            انصراف
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className={`h-11 gap-2 rounded-xl px-6 text-white ${config.accent.button} ${config.accent.buttonHover}`}
          >
            {saving ? (
              <Loader2 size={17} className="animate-spin" />
            ) : mode === "create" ? (
              <Upload size={17} />
            ) : (
              <Pencil size={17} />
            )}
            {mode === "create" ? "بارگذاری و انتشار" : "ذخیره تغییرات"}
          </Button>
        </div>
      </form>
    </div>
  );
}
