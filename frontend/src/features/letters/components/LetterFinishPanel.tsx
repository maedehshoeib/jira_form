"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorDetail, LETTER_NO_ACTION_VALUE } from "@/features/tasks";

import type { SentLetter, SentRecipient } from "../sentLetters";

const FINAL = new Set(["approved", "rejected"]);

type Props = {
  letter: SentLetter;
  canFinish: boolean;
  onUpdated: () => void;
};

export function LetterFinishPanel({ letter, canFinish, onUpdated }: Props) {
  const direct = letter.recipients.filter((row) => row.delivery_type !== "cc");
  const openRows = direct.filter((row) => !FINAL.has(row.status));
  const closedRows = direct.filter((row) => FINAL.has(row.status));
  const readyRows = openRows.filter((row) => (row.progress_percent ?? 0) >= 99);

  const [note, setNote] = useState("");
  const [loadingId, setLoadingId] = useState<number | "all" | null>(null);
  const [error, setError] = useState("");

  if (!canFinish || letter.needs_action === LETTER_NO_ACTION_VALUE) {
    return null;
  }
  if (direct.length === 0) return null;

  const updateStatus = async (
    submissionId: number,
    status: "approved" | "rejected" | "submitted",
  ) => {
    setLoadingId(submissionId);
    setError("");
    try {
      await client.patch(`${endpoints.submissions}/${submissionId}/status`, {
        status,
        note: note.trim(),
      });
      setNote("");
      onUpdated();
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
      window.dispatchEvent(new Event("letters:refresh-notifications"));
    } catch (err: unknown) {
      setError(apiErrorDetail(err, "ثبت نتیجه نهایی نامه با مشکل مواجه شد."));
    } finally {
      setLoadingId(null);
    }
  };

  const finishAllReady = async () => {
    if (readyRows.length === 0) return;
    setLoadingId("all");
    setError("");
    try {
      for (const row of readyRows) {
        await client.patch(`${endpoints.submissions}/${row.submission_id}/status`, {
          status: "approved",
          note: note.trim(),
        });
      }
      setNote("");
      onUpdated();
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
      window.dispatchEvent(new Event("letters:refresh-notifications"));
    } catch (err: unknown) {
      setError(apiErrorDetail(err, "بستن نامه‌های آماده با مشکل مواجه شد."));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div>
        <h4 className="text-sm font-bold text-foreground">نتیجه نهایی نامه</h4>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          فقط شما به‌عنوان فرستنده می‌توانید نامه را پس از پیشرفت گیرنده ببندید.
          وقتی پیشرفت به ۹۹٪ برسد، بستن نامه در دسترس است.
        </p>
      </div>

      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={512}
        placeholder="توضیح نتیجه نهایی (اختیاری)"
        className="min-h-16 bg-card text-sm"
      />

      {error ? (
        <p role="alert" className="text-sm font-semibold text-primary">
          {error}
        </p>
      ) : null}

      {readyRows.length > 1 ? (
        <Button
          type="button"
          onClick={() => void finishAllReady()}
          disabled={loadingId !== null}
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {loadingId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          بستن همه گیرنده‌های ۹۹٪
        </Button>
      ) : null}

      <ul className="space-y-2">
        {direct.map((row) => (
          <RecipientFinishRow
            key={row.submission_id}
            row={row}
            loading={loadingId === row.submission_id || loadingId === "all"}
            onFinish={(status) => void updateStatus(row.submission_id, status)}
          />
        ))}
      </ul>

      {closedRows.length > 0 && openRows.length === 0 ? (
        <p className="text-xs font-semibold text-emerald-800">
          همه گیرنده‌های مستقیم این نامه بسته شده‌اند.
        </p>
      ) : null}
    </section>
  );
}

function RecipientFinishRow({
  row,
  loading,
  onFinish,
}: {
  row: SentRecipient;
  loading: boolean;
  onFinish: (status: "approved" | "rejected" | "submitted") => void;
}) {
  const progress = row.progress_percent ?? 0;
  const isFinal = FINAL.has(row.status);
  const canClose = !isFinal && progress >= 99;

  return (
    <li className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{row.display_name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
            پیشرفت {progress.toLocaleString("fa-IR")}٪
            {canClose ? " · آماده بستن" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!isFinal ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => onFinish("approved")}
                disabled={loading || !canClose}
                title={
                  canClose
                    ? "بستن نامه به‌عنوان انجام‌شده"
                    : "پس از رسیدن پیشرفت به ۹۹٪ فعال می‌شود"
                }
                className="h-8 gap-1 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                انجام شد
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onFinish("rejected")}
                disabled={loading}
                className="h-8 gap-1 border-primary/30 px-2.5 text-xs text-primary hover:bg-primary/10"
              >
                <XCircle className="h-3.5 w-3.5" />
                انجام نشد
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onFinish("submitted")}
              disabled={loading}
              className="h-8 gap-1 border-amber-200 px-2.5 text-xs text-amber-800 hover:bg-amber-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              بازگشایی
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
