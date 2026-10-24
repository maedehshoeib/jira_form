"use client";

import { useState } from "react";
import { Download, Eye, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { fetchCardFile, requestErrorMessage } from "../api";
import type { PortalCardDetail, PortalCardFile } from "../types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString("fa-IR")} بایت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("fa-IR")} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
}

export default function DocumentView({ card }: { card: PortalCardDetail }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function openFile(file: PortalCardFile, mode: "view" | "download") {
    setBusyId(file.id);
    setError("");
    try {
      const blob = await fetchCardFile(card.id, file.id);
      const url = URL.createObjectURL(blob);
      if (mode === "view") {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.file_name;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(requestErrorMessage(err, "دریافت فایل ممکن نیست."));
    } finally {
      setBusyId(null);
    }
  }

  const hasContent = card.content.trim().length > 0;

  return (
    <div className="space-y-6">
      {hasContent && (
        <article className="whitespace-pre-wrap rounded-3xl border border-primary/10 bg-card p-6 text-base leading-8 text-foreground shadow-sm">
          {card.content}
        </article>
      )}

      {card.files.length > 0 && (
        <ul className="space-y-3">
          {card.files.map((file) => (
            <li
              key={file.id}
              className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-primary" size={22} />
                <div>
                  <p className="font-medium text-foreground">{file.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.file_name} · {formatSize(file.file_size)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {file.is_pdf && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === file.id}
                    onClick={() => openFile(file, "view")}
                  >
                    <Eye /> مشاهده
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === file.id}
                  onClick={() => openFile(file, "download")}
                >
                  {busyId === file.id ? <Loader2 className="animate-spin" /> : <Download />}
                  دانلود
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!hasContent && card.files.length === 0 && (
        <p className="rounded-3xl border border-dashed border-primary/20 bg-card p-8 text-center text-sm text-muted-foreground">
          محتوایی برای این مستند ثبت نشده است.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
