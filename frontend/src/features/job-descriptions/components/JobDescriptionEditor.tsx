"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness, Loader2, Pencil, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { JobDescriptionDraft, JobDescriptionItem } from "../types";
import {
  ClickableImage,
  FullscreenImageViewer,
} from "./FullscreenImageViewer";

type EditorMode = "create" | "edit";

type JobDescriptionEditorProps = {
  mode: EditorMode;
  draft: JobDescriptionDraft;
  editingItem: JobDescriptionItem | null;
  saving: boolean;
  saveError: string;
  onChange: (next: JobDescriptionDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

export default function JobDescriptionEditor({
  mode,
  draft,
  editingItem,
  saving,
  saveError,
  onChange,
  onClose,
  onSubmit,
}: JobDescriptionEditorProps) {
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null);
  const closeFullscreen = useCallback(() => setFullscreenSrc(null), []);

  useEffect(() => {
    if (!draft.photo) {
      setLocalPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(draft.photo);
    setLocalPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.photo]);

  const photoPreviewSrc =
    localPhotoPreview ||
    (!draft.remove_photo ? editingItem?.photo_url : null) ||
    null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-description-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <form
        dir="rtl"
        onSubmit={onSubmit}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              {mode === "create" ? (
                <BriefcaseBusiness size={24} />
              ) : (
                <Pencil size={24} />
              )}
            </div>
            <div>
              <h2
                id="job-description-editor-title"
                className="text-xl font-extrabold text-foreground"
              >
                {mode === "create" ? "افزودن شرح وظایف" : "ویرایش شرح وظایف"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                فیلدها و در صورت نیاز تصویر و فایل پیوست را تکمیل کنید.
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
          <Field
            label="سمت سازمانی"
            value={draft.organizational_position}
            maxLength={256}
            required
            autoFocus
            onChange={(value) =>
              onChange({ ...draft, organizational_position: value })
            }
          />
          <Field
            label="واحد سازمانی"
            value={draft.organizational_unit}
            maxLength={256}
            required
            onChange={(value) => onChange({ ...draft, organizational_unit: value })}
          />
          <AreaField
            label="مسئولیت معاونت/واحد"
            value={draft.unit_responsibility}
            onChange={(value) => onChange({ ...draft, unit_responsibility: value })}
          />
          <AreaField
            label="شرایط احراز"
            value={draft.qualification_requirements}
            onChange={(value) =>
              onChange({ ...draft, qualification_requirements: value })
            }
          />

          <PhotoField
            currentName={
              draft.photo?.name ||
              (!draft.remove_photo ? editingItem?.photo_name : "") ||
              ""
            }
            previewSrc={photoPreviewSrc}
            onFile={(file) =>
              onChange({ ...draft, photo: file, remove_photo: false })
            }
            onOpenFullscreen={() => {
              if (photoPreviewSrc) setFullscreenSrc(photoPreviewSrc);
            }}
            onClear={
              mode === "edit" && (editingItem?.photo_url || draft.photo)
                ? () =>
                    onChange({
                      ...draft,
                      photo: null,
                      remove_photo: true,
                    })
                : draft.photo
                  ? () => onChange({ ...draft, photo: null, remove_photo: false })
                  : undefined
            }
          />

          <FileField
            label="فایل پیوست"
            hint="PDF، Word، Excel، TXT یا ZIP — حداکثر ۲۰ مگابایت"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,application/pdf"
            currentName={
              draft.attachment?.name ||
              (!draft.remove_attachment ? editingItem?.attachment_name : "") ||
              ""
            }
            onFile={(file) =>
              onChange({
                ...draft,
                attachment: file,
                remove_attachment: false,
              })
            }
            onClear={
              mode === "edit" && (editingItem?.has_attachment || draft.attachment)
                ? () =>
                    onChange({
                      ...draft,
                      attachment: null,
                      remove_attachment: true,
                    })
                : undefined
            }
          />
        </div>

        {saveError && (
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            {saveError}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
            className="h-11 rounded-xl px-5"
          >
            انصراف
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="h-11 gap-2 rounded-xl bg-emerald-600 px-6 text-white hover:bg-emerald-700"
          >
            {saving ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Upload size={17} />
            )}
            {mode === "create" ? "ثبت و انتشار" : "ذخیره تغییرات"}
          </Button>
        </div>
      </form>

      {fullscreenSrc && (
        <FullscreenImageViewer
          src={fullscreenSrc}
          alt={draft.organizational_position || "تصویر شرح وظایف"}
          onClose={closeFullscreen}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
  required,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Label className="block">
      <span className="mb-2 block text-sm font-bold text-foreground">{label}</span>
      <Input
        required={required}
        autoFocus={autoFocus}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-border px-4 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
      />
    </Label>
  );
}

function AreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="block">
      <span className="mb-2 block text-sm font-bold text-foreground">{label}</span>
      <Textarea
        required
        rows={4}
        maxLength={10000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none rounded-xl border border-border px-4 py-3 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
      />
    </Label>
  );
}

function PhotoField({
  currentName,
  previewSrc,
  onFile,
  onClear,
  onOpenFullscreen,
}: {
  currentName: string;
  previewSrc: string | null;
  onFile: (file: File | null) => void;
  onClear?: () => void;
  onOpenFullscreen: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-foreground">تصویر</span>
        {onClear && currentName && (
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-8 px-2 text-xs text-primary"
          >
            حذف
          </Button>
        )}
      </div>

      {previewSrc ? (
        <div className="space-y-3">
          <ClickableImage
            src={previewSrc}
            alt={currentName || "پیش‌نمایش تصویر"}
            onOpen={onOpenFullscreen}
            fit="contain"
            className="mx-auto aspect-[4/3] w-full max-w-md border border-border bg-muted/40 shadow-sm"
          />
          <p className="text-center text-xs text-muted-foreground">
            برای نمایش تمام‌صفحه روی تصویر کلیک کنید
          </p>
          <Label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground transition hover:border-emerald-300 hover:bg-emerald-50/50">
            <Upload size={16} className="text-emerald-600" />
            تغییر تصویر
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(event) => onFile(event.target.files?.[0] || null)}
            />
          </Label>
        </div>
      ) : (
        <Label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40">
          <Upload size={28} className="mb-2 text-emerald-600" />
          <span className="max-w-full truncate text-sm font-bold text-foreground">
            برای انتخاب تصویر کلیک کنید
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            JPG، PNG یا WebP — حداکثر ۱۰ مگابایت
          </span>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0] || null)}
          />
        </Label>
      )}
    </div>
  );
}

function FileField({
  label,
  hint,
  accept,
  currentName,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  accept: string;
  currentName: string;
  onFile: (file: File | null) => void;
  onClear?: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-foreground">{label}</span>
        {onClear && currentName && (
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-8 px-2 text-xs text-primary"
          >
            حذف
          </Button>
        )}
      </div>
      <Label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 text-center transition hover:border-border hover:bg-muted/70">
        <Upload size={23} className="mb-2 text-emerald-600" />
        <span className="max-w-full truncate text-sm font-bold text-foreground">
          {currentName || "برای انتخاب فایل کلیک کنید"}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">{hint}</span>
        <Input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0] || null)}
        />
      </Label>
    </div>
  );
}
