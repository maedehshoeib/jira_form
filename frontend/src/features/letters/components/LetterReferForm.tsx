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
import { RecipientGroupBar } from "@/features/recipient-groups";
import {
  REFERRAL_NOTE_MAX_LENGTH,
  apiErrorDetail,
  type Colleague,
  type SubmissionDetail,
} from "@/features/tasks";

type Props = {
  submissionId: number;
  /** Inbox recipients refer through /tasks; the letter sender refers through /submissions. */
  apiScope: "tasks" | "submissions";
  title: string;
  previouslyReferredIds: number[];
  allowRepeat: boolean;
  actionLoading: boolean;
  onActionLoading: (value: boolean) => void;
  onError: (message: string) => void;
  onReferred: (data: SubmissionDetail) => void;
  onClose: () => void;
};

export function LetterReferForm({
  submissionId,
  apiScope,
  title,
  previouslyReferredIds,
  allowRepeat,
  actionLoading,
  onActionLoading,
  onError,
  onReferred,
  onClose,
}: Props) {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [colleaguesLoading, setColleaguesLoading] = useState(true);
  const [colleagueQuery, setColleagueQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const previouslyReferred = useMemo(
    () => new Set(previouslyReferredIds),
    [previouslyReferredIds],
  );

  useEffect(() => {
    let cancelled = false;
    onError("");
    client
      .get<Colleague[]>(endpoints.taskColleagues)
      .then(({ data }) => {
        if (!cancelled) setColleagues(data);
      })
      .catch(() => {
        if (!cancelled) onError("دریافت فهرست همکاران با مشکل مواجه شد.");
      })
      .finally(() => {
        if (!cancelled) setColleaguesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per opened form
  }, [submissionId]);

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

  const toggleColleague = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    if (selectedIds.length === 0) return;
    onActionLoading(true);
    onError("");
    try {
      const formData = new FormData();
      selectedIds.forEach((id) => formData.append("to_user_ids", String(id)));
      formData.append("note", note.trim());
      if (allowRepeat) formData.append("allow_repeat", "true");
      attachments.forEach((file) => formData.append("attachments", file));
      const base = apiScope === "tasks" ? endpoints.tasks : endpoints.submissions;
      const { data } = await client.post<SubmissionDetail>(
        `${base}/${submissionId}/refer`,
        formData,
      );
      onReferred(data);
      window.dispatchEvent(new Event("tasks:refresh-notifications"));
      window.dispatchEvent(new Event("letters:refresh-notifications"));
    } catch (err: unknown) {
      onError(apiErrorDetail(err, "ارجاع نامه با مشکل مواجه شد."));
    } finally {
      onActionLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          aria-label="بستن فرم ارجاع"
          className="h-8 px-2 text-muted-foreground"
        >
          <X size={16} />
        </Button>
      </div>
      <RecipientGroupBar
        people={colleagues}
        selectedIds={selectedIds}
        disabled={actionLoading}
        onSelectedIdsChange={setSelectedIds}
      />
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
            const picked = selectedIds.includes(user.id);
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
        value={note}
        onChange={(event) => setNote(event.target.value)}
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
          onChange={(event) => setAttachments(Array.from(event.target.files ?? []))}
          className="h-10 rounded-xl bg-card file:ml-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-sky-700"
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file) => (
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
        onClick={() => void submit()}
        disabled={actionLoading || selectedIds.length === 0}
        className="gap-2 bg-sky-600 hover:bg-sky-700"
      >
        {actionLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Forward className="h-4 w-4" />
        )}
        ثبت ارجاع
      </Button>
    </div>
  );
}
