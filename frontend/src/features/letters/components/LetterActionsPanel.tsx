"use client";

import { useEffect, useMemo, useState } from "react";
import { AtSign, Forward, Loader2, Paperclip, X } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import UserDisplayName from "@/components/UserDisplayName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REFERRAL_NOTE_MAX_LENGTH,
  apiErrorDetail,
  normalizedProgress,
  type Colleague,
  type SubmissionDetail,
} from "@/features/tasks";

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
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [colleaguesLoading, setColleaguesLoading] = useState(false);
  const [colleagueQuery, setColleagueQuery] = useState("");
  const [selectedColleagueIds, setSelectedColleagueIds] = useState<number[]>([]);
  const [mentionedColleagueIds, setMentionedColleagueIds] = useState<number[]>([]);
  const [referNote, setReferNote] = useState("");
  const [referAttachments, setReferAttachments] = useState<File[]>([]);
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
    setSelectedColleagueIds([]);
    setMentionedColleagueIds([]);
    setReferNote("");
    setReferAttachments([]);
  }, [selected.id, selected.viewer_progress_percent, selected.status]);

  const previouslyReferred = useMemo(
    () => new Set((selected.referrals ?? []).map((item) => item.to_user_id)),
    [selected.referrals],
  );
  const isRepeatReferral = previouslyReferred.size > 0;

  const filteredColleagues = useMemo(() => {
    const q = colleagueQuery.trim().toLocaleLowerCase("fa");
    return colleagues.filter((user) => {
      if (!q) return true;
      return [user.display_name, user.username, user.department, user.job_title]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(q);
    });
  }, [colleagues, colleagueQuery]);

  const openReferPanel = async () => {
    setReferOpen(true);
    onError("");
    if (colleagues.length > 0) return;
    setColleaguesLoading(true);
    try {
      const { data } = await client.get<Colleague[]>(endpoints.taskColleagues);
      setColleagues(data);
    } catch {
      onError("دریافت فهرست همکاران با مشکل مواجه شد.");
    } finally {
      setColleaguesLoading(false);
    }
  };

  const toggleColleague = (id: number) => {
    setSelectedColleagueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const submitRefer = async () => {
    if (!canAct || selectedColleagueIds.length === 0) return;
    onActionLoading(true);
    onError("");
    try {
      const formData = new FormData();
      selectedColleagueIds.forEach((id) => formData.append("to_user_ids", String(id)));
      mentionedColleagueIds.forEach((id) =>
        formData.append("mentioned_user_ids", String(id)),
      );
      formData.append("note", referNote.trim());
      if (isRepeatReferral) formData.append("allow_repeat", "true");
      referAttachments.forEach((file) => formData.append("attachments", file));
      const { data } = await client.post<SubmissionDetail>(
        `${endpoints.tasks}/${selected.id}/refer`,
        formData,
      );
      onUpdated(data);
      setReferOpen(false);
      setSelectedColleagueIds([]);
      setMentionedColleagueIds([]);
      setReferNote("");
      setReferAttachments([]);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
      window.dispatchEvent(new Event("letters:refresh-notifications"));
    } catch (err: unknown) {
      onError(apiErrorDetail(err, "ارجاع نامه با مشکل مواجه شد."));
    } finally {
      onActionLoading(false);
    }
  };

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
          onClick={() => void openReferPanel()}
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
        <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">
              {isRepeatReferral ? "ارجاع مجدد به همکاران" : "ارجاع به همکاران"}
            </h4>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReferOpen(false)}
              className="h-8 px-2 text-muted-foreground"
            >
              <X size={16} />
            </Button>
          </div>
          <Input
            value={colleagueQuery}
            onChange={(event) => setColleagueQuery(event.target.value)}
            placeholder="جستجوی نام همکار..."
            className="h-10 rounded-xl bg-card"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {colleaguesLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال دریافت...
              </div>
            ) : filteredColleagues.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                همکاری یافت نشد.
              </p>
            ) : (
              filteredColleagues.map((user) => {
                const picked = selectedColleagueIds.includes(user.id);
                return (
                  <Button
                    key={user.id}
                    type="button"
                    variant="ghost"
                    onClick={() => toggleColleague(user.id)}
                    className={`flex h-auto w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm ${
                      picked ? "bg-primary/10 text-primary" : "hover:bg-muted/40"
                    }`}
                  >
                    <span className="font-medium">
                      <UserDisplayName user={user} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {previouslyReferred.has(user.id)
                        ? "قبلاً ارجاع شده"
                        : user.job_title || user.department || ""}
                    </span>
                  </Button>
                );
              })
            )}
          </div>
          <Textarea
            value={referNote}
            onChange={(event) => setReferNote(event.target.value)}
            placeholder="یادداشت ارجاع (اختیاری)"
            className="min-h-20 rounded-xl bg-card"
            maxLength={REFERRAL_NOTE_MAX_LENGTH}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AtSign size={14} className="text-sky-600" />
            برای رونوشت می‌توانید همکاران را در فهرست بالا انتخاب کنید.
          </p>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              پیوست ارجاع (اختیاری)
            </Label>
            <Input
              type="file"
              multiple
              onChange={(event) =>
                setReferAttachments(Array.from(event.target.files ?? []))
              }
              className="h-10 rounded-xl bg-card file:ml-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-sky-700"
            />
            {referAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {referAttachments.map((file) => (
                  <span
                    key={file.name}
                    className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-800"
                  >
                    <Paperclip size={12} />
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button
            type="button"
            onClick={() => void submitRefer()}
            disabled={actionLoading || selectedColleagueIds.length === 0}
            className="gap-2 bg-sky-600 hover:bg-sky-700"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
            ثبت ارجاع
          </Button>
        </div>
      )}
    </div>
  );
}
