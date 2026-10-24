import { useMemo, useState } from "react";
import { Forward, Loader2, Paperclip } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import UserDisplayName from "@/components/UserDisplayName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RecipientGroupBar } from "@/features/recipient-groups";

import type { Colleague, SubmissionDetail } from "../types";

type RequestReferPanelProps = {
  selected: SubmissionDetail;
  onUpdated: (updated: SubmissionDetail) => void;
};

export function RequestReferPanel({ selected, onUpdated }: RequestReferPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [colleaguesLoading, setColleaguesLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const referred = (selected.referrals?.length ?? 0) > 0;
  const actionLabel = referred ? "ارجاع مجدد" : "ارجاع";

  const reset = () => {
    setError("");
    setQuery("");
    setSelectedIds([]);
    setNote("");
    setAttachments([]);
  };

  const openPanel = async () => {
    setOpen(true);
    reset();
    if (colleagues.length > 0) return;
    setColleaguesLoading(true);
    try {
      const { data } = await client.get<Colleague[]>(endpoints.taskColleagues);
      setColleagues(data);
    } catch {
      setError("دریافت فهرست همکاران با مشکل مواجه شد.");
    } finally {
      setColleaguesLoading(false);
    }
  };

  const submit = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      selectedIds.forEach((id) => formData.append("to_user_ids", String(id)));
      formData.append("note", note.trim());
      formData.append("allow_repeat", String(referred));
      attachments.forEach((file) => formData.append("attachments", file));
      const { data } = await client.post<SubmissionDetail>(
        `${endpoints.submissions}/${selected.id}/refer`,
        formData,
      );
      onUpdated(data);
      setOpen(false);
      reset();
    } catch {
      setError("ارجاع مجدد درخواست با مشکل مواجه شد.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("fa");
    if (!text) return colleagues;
    return colleagues.filter((colleague) =>
      [colleague.display_name, colleague.username, colleague.department, colleague.job_title]
        .join(" ")
        .toLocaleLowerCase("fa")
        .includes(text),
    );
  }, [query, colleagues]);

  return (
    <section className="space-y-3 rounded-3xl border border-sky-100 bg-sky-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-foreground">
            {referred ? "ارجاع مجدد درخواست" : "ارجاع درخواست"}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            درخواست را همراه با چند پیوست برای یک یا چند همکار ارسال کنید.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => (open ? setOpen(false) : void openPanel())}
          disabled={loading}
          className="gap-2 bg-sky-600 text-white hover:bg-sky-700"
        >
          <Forward size={16} />
          {actionLabel}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-sky-100 pt-4">
          <RecipientGroupBar
            people={colleagues}
            selectedIds={selectedIds}
            disabled={loading}
            onSelectedIdsChange={setSelectedIds}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی نام همکار..."
            className="bg-card"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {colleaguesLoading ? (
              <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال دریافت...
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">همکاری یافت نشد.</p>
            ) : (
              filtered.map((colleague) => {
                const isSelected = selectedIds.includes(colleague.id);
                const wasReferred = (selected.referrals ?? []).some(
                  (item) => item.to_user_id === colleague.id,
                );
                return (
                  <Button
                    key={colleague.id}
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setSelectedIds((ids) =>
                        ids.includes(colleague.id)
                          ? ids.filter((id) => id !== colleague.id)
                          : [...ids, colleague.id],
                      )
                    }
                    className={
                      "flex h-auto w-full justify-between rounded-xl px-3 py-2 text-right " +
                      (isSelected ? "bg-sky-100 text-sky-800" : "")
                    }
                  >
                    <UserDisplayName user={colleague} />
                    <span className="text-xs text-muted-foreground">
                      {wasReferred
                        ? "قبلاً ارجاع شده"
                        : colleague.job_title || colleague.department || colleague.username}
                    </span>
                  </Button>
                );
              })
            )}
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={512}
            placeholder="یادداشت ارجاع (اختیاری)"
            className="min-h-20 bg-card"
          />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              پیوست‌ها (اختیاری، امکان انتخاب چند فایل)
            </Label>
            <Input
              type="file"
              multiple
              onChange={(event) => {
                const added = Array.from(event.target.files ?? []);
                setAttachments((current) => [
                  ...current,
                  ...added.filter(
                    (file) =>
                      !current.some(
                        (item) =>
                          item.name === file.name &&
                          item.size === file.size &&
                          item.lastModified === file.lastModified,
                      ),
                  ),
                ]);
                event.currentTarget.value = "";
              }}
              className="bg-card"
            />
            {attachments.map((file, index) => (
              <div
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Paperclip size={13} />
                <span className="font-semibold">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAttachments((files) => files.filter((_, i) => i !== index))}
                  className="h-7 px-2"
                >
                  حذف
                </Button>
              </div>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-primary">
              {error}
            </p>
          )}
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={loading || selectedIds.length === 0}
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
            ثبت {actionLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
