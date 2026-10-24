import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { SubmissionDetail } from "../types";

type RequestFinalStatusPanelProps = {
  selected: SubmissionDetail;
  onUpdated: (updated: SubmissionDetail) => void;
};

/** Sender-only close / reject / reopen, exactly as for any other request. */
export function RequestFinalStatusPanel({
  selected,
  onUpdated,
}: RequestFinalStatusPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const updateFinalStatus = async (status: "approved" | "rejected" | "submitted") => {
    setLoading(true);
    setError("");
    try {
      const { data } = await client.patch<SubmissionDetail>(
        `${endpoints.submissions}/${selected.id}/status`,
        {
          status,
          note: note.trim(),
          // A multi-recipient letter is closed/reopened once for all recipients.
          apply_to_letter_batch: selected.form_id === "management-letter-form",
        },
      );
      onUpdated(data);
      setNote("");
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
    } catch {
      setError("ثبت نتیجه نهایی درخواست با مشکل مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5">
      <div>
        <h4 className="font-bold text-foreground">نتیجه نهایی درخواست</h4>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          فقط شما به‌عنوان ارسال‌کننده می‌توانید انجام‌شدن یا انجام‌نشدن این درخواست را
          تأیید کنید.
        </p>
      </div>
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={512}
        placeholder="توضیح نتیجه نهایی (اختیاری)"
        className="min-h-20 bg-card"
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void updateFinalStatus("approved")}
          disabled={loading || selected.status === "approved"}
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          انجام شده است
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void updateFinalStatus("rejected")}
          disabled={loading || selected.status === "rejected"}
          className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
        >
          <XCircle className="h-4 w-4" />
          انجام نشده است
        </Button>
        {(selected.status === "approved" || selected.status === "rejected") && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void updateFinalStatus("submitted")}
            disabled={loading}
            className="border-amber-200 text-amber-800 hover:bg-amber-50"
          >
            بازگشایی درخواست
          </Button>
        )}
      </div>
    </section>
  );
}
