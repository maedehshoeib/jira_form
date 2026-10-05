"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { JobDescriptionItem } from "../types";
import {
  ClickableImage,
  FullscreenImageViewer,
} from "./FullscreenImageViewer";

type JobDescriptionDetailProps = {
  item: JobDescriptionItem;
  onClose: () => void;
  onDownload: () => void;
};

export default function JobDescriptionDetail({
  item,
  onClose,
  onDownload,
}: JobDescriptionDetailProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const closeFullscreen = useCallback(() => setFullscreenOpen(false), []);

  useEffect(() => {
    if (fullscreenOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, fullscreenOpen]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir="rtl">
      <Button
        variant="ghost"
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-description-detail-title"
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id="job-description-detail-title"
              className="text-lg font-extrabold leading-8 text-foreground"
            >
              {item.organizational_position}
            </h2>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              {item.organizational_unit}
            </p>
          </div>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="بستن جزئیات"
          >
            <X size={20} />
          </Button>
        </header>

        <div className="overflow-y-auto px-5 py-5">
          {item.photo_url && (
            <div className="mb-5">
              <ClickableImage
                src={item.photo_url}
                alt={item.organizational_position}
                onOpen={() => setFullscreenOpen(true)}
                fit="contain"
                className="mx-auto aspect-[4/3] w-full max-h-[28rem] border border-border bg-muted/30"
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                برای نمایش تمام‌صفحه روی تصویر کلیک کنید
              </p>
            </div>
          )}

          <DetailBlock title="مسئولیت معاونت/واحد" body={item.unit_responsibility} />
          <DetailBlock title="شرایط احراز" body={item.qualification_requirements} />

          {item.has_attachment && (
            <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
              <p className="text-sm font-bold text-foreground">فایل پیوست</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.attachment_name}</p>
              <Button
                type="button"
                onClick={onDownload}
                className="mt-3 h-10 gap-2 rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700"
              >
                <Download size={16} />
                دانلود فایل
              </Button>
            </div>
          )}
        </div>
      </section>

      {fullscreenOpen && item.photo_url && (
        <FullscreenImageViewer
          src={item.photo_url}
          alt={item.organizational_position}
          onClose={closeFullscreen}
        />
      )}
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
