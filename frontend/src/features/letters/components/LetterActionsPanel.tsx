"use client";

import { useEffect, useMemo, useState } from "react";
import { Forward, Loader2, Paperclip } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiErrorDetail,
  normalizedProgress,
  type SubmissionDetail,
} from "@/features/tasks";

import { LetterReferForm } from "./LetterReferForm";

type Props = {
  selected: SubmissionDetail;
  actionLoading: boolean;
  onActionLoading: (value: boolean) => void;
  onError: (message: string) => void;
  onUpdated: (data: SubmissionDetail) => void;
};

export function LetterActionsPanel({
  selected,
  actionLoading,
  onActionLoading,
  onError,
  onUpdated,
}: Props) {
  const canAct =
    Boolean(selected.can_act) &&
    (selected.status === "submitted" || selected.status === "in_progress");

  const [referOpen, setReferOpen] = useState(false);
  const [progressDraft, setProgressDraft] = useState(
    normalizedProgress(selected.viewer_progress_percent ?? 0, selected.status),
  );
  const [progressNote, setProgressNote] = useState("");
  const [progressAttachment, setProgressAttachment] = useState<File | null>(null);

  useEffect(() => {
    setProgressDraft(
      normalizedProgress(selected.viewer_progress_percent ?? 0, selected.status),
    );
    setProgressNote("");
    setProgressAttachment(null);
    setReferOpen(false);
  }, [selected.id, selected.viewer_progress_percent, selected.status]);

  const previouslyReferredIds = useMemo(
    () => (selected.referrals ?? []).map((item) => item.to_user_id),
    [selected.referrals],
  );
  const isRepeatReferral = previouslyReferredIds.length > 0;

  const updateProgress = async () => {
    if (!canAct) return;
    const nextProgress = Math.min(99, Math.max(0, Math.round(progressDraft)));
    const note = progressNote.trim();
    if (
      selected.status === "in_progress" &&
      nextProgress === normalizedProgress(selected.viewer_progress_percent ?? 0) &&
      !note &&
      !progressAttachment
    ) {
      return;
    }
    onActionLoading(true);
    onError("");
    try {
      let data: SubmissionDetail;
      if (progressAttachment) {
        const formData = new FormData();
        formData.append("status", "in_progress");
        formData.append("progress_percent", String(nextProgress));
        formData.append("note", note);
        formData.append("attachment", progressAttachment);
        const response = await client.patch<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/status`,
          formData,
        );
        data = response.data;
      } else {
        const response = await client.patch<SubmissionDetail>(
          `${endpoints.tasks}/${selected.id}/status`,
          {
            status: "in_progress",
            progress_percent: nextProgress,
            note,
          },
        );
        data = response.data;
      }
      onUpdated(data);
      setProgressNote("");
      setProgressAttachment(null);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
      window.dispatchEvent(new Event("letters:refresh-notifications"));
    } catch (err: unknown) {
      onError(apiErrorDetail(err, "ثبت پیشرفت با مشکل مواجه شد."));
    } finally {
      onActionLoading(false);
    }
  };

  if (!canAct) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setReferOpen(true)}
          disabled={actionLoading}
          className="gap-2 bg-sky-600 font-bold text-white hover:bg-sky-700"
        >
          <Forward className="h-4 w-4" />
          {isRepeatReferral ? "ارجاع مجدد" : "ارجاع نامه"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <Label
          htmlFor={`letter-progress-${selected.id}`}
          className="shrink-0 text-xs font-semibold text-muted-foreground"
        >
          پیشرفت
        </Label>
        <Input
          id={`letter-progress-${selected.id}`}
          type="range"
          min={0}
          max={99}
          step={1}
          value={progressDraft}
          dir="ltr"
          aria-label="درصد پیشرفت"
          onChange={(event) => setProgressDraft(Number(event.target.value))}
          className="h-1.5 min-w-[8rem] flex-1 cursor-pointer accent-blue-600"
        />
        <span
          dir="ltr"
          className="w-10 shrink-0 text-left text-xs font-extrabold tabular-nums text-foreground"
        >
          {progressDraft}%
        </span>
        <Input
          type="text"
          value={progressNote}
          maxLength={512}
          onChange={(event) => setProgressNote(event.target.value)}
          placeholder="یادداشت (اختیاری)"
          className="h-8 min-w-[10rem] flex-1 rounded-md text-xs"
        />
        <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted">
          <Paperclip size={12} />
          پیوست
          <input
            type="file"
            className="sr-only"
            onChange={(event) => setProgressAttachment(event.target.files?.[0] ?? null)}
          />
        </label>
        {progressAttachment ? (
          <span className="max-w-[7rem] truncate text-[10px] text-muted-foreground" title={progressAttachment.name}>
            {progressAttachment.name}
          </span>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={() => void updateProgress()}
          disabled={actionLoading}
          className="h-8 gap-1.5 bg-blue-600 px-3 text-xs hover:bg-blue-700"
        >
          {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          ثبت
        </Button>
      </div>

      {referOpen && (
        <LetterReferForm
          submissionId={selected.id}
          apiScope="tasks"
          title={isRepeatReferral ? "ارجاع مجدد به همکاران" : "ارجاع به همکاران"}
          previouslyReferredIds={previouslyReferredIds}
          allowRepeat={isRepeatReferral}
          actionLoading={actionLoading}
          onActionLoading={onActionLoading}
          onError={onError}
          onReferred={(data) => {
            onUpdated(data);
            setReferOpen(false);
          }}
          onClose={() => setReferOpen(false)}
        />
      )}
    </div>
  );
}
