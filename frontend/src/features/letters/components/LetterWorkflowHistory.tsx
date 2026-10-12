"use client";

import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_BASE } from "@/config/portal";
import { formatPersianDateTime } from "@/lib/persianDate";
import {
  normalizedProgress,
  parseTimelineEntityId,
  timelineEventDotClass,
  timelineEventLabel,
  type AssigneeProgress,
  type CcRecipient,
  type ReferralItem,
  type TimelineItem,
} from "@/features/tasks";

import { downloadAuthFile } from "../download";

type LetterWorkflowHistoryProps = {
  submissionId: number;
  /** Inbox letters use /tasks; sent-letter owner/admin views use /submissions. */
  apiScope?: "tasks" | "submissions";
  timeline?: TimelineItem[];
  referrals?: ReferralItem[];
  assigneeProgress?: AssigneeProgress[];
  ccRecipients?: CcRecipient[];
  statusNote?: string;
  statusAttachmentName?: string | null;
  onError?: (message: string) => void;
};

function attachmentNames(item: {
  attachment_name?: string | null;
  attachment_names?: string[];
}) {
  if (item.attachment_names?.length) return item.attachment_names;
  return item.attachment_name ? [item.attachment_name] : [];
}

export function LetterWorkflowHistory({
  submissionId,
  apiScope = "tasks",
  timeline = [],
  referrals = [],
  assigneeProgress = [],
  ccRecipients = [],
  statusNote = "",
  statusAttachmentName = null,
  onError,
}: LetterWorkflowHistoryProps) {
  const base = `${API_BASE}/${apiScope}/${submissionId}`;

  const download = async (url: string, fileName: string) => {
    const ok = await downloadAuthFile(url, fileName);
    if (!ok) onError?.("دانلود پیوست با مشکل مواجه شد.");
  };

  const downloadTimelineAttachment = async (
    item: TimelineItem,
    index: number,
    fileName: string,
  ) => {
    if (item.event_type === "referred") {
      const referralId = parseTimelineEntityId(item.id, "referral");
      if (!referralId) return;
      await download(
        `${base}/referrals/${referralId}/attachment?index=${index}`,
        fileName,
      );
      return;
    }
    if (item.event_type === "status_changed") {
      const historyId = parseTimelineEntityId(item.id, "status");
      if (!historyId) return;
      await download(`${base}/status-history/${historyId}/attachment`, fileName);
    }
  };

  const progressRows = assigneeProgress.filter(
    (row) => row.progress_percent > 0 || row.updated_at,
  );

  return (
    <div className="space-y-5">
      {(statusNote.trim() || statusAttachmentName) && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h4 className="mb-3 text-sm font-bold text-foreground">پاسخ نهایی</h4>
          {statusNote.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
              {statusNote}
            </p>
          ) : null}
          {statusAttachmentName ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void download(`${base}/status-attachment`, statusAttachmentName)
              }
              className="mt-3 h-8 gap-1.5 rounded-lg text-xs"
            >
              <Paperclip size={12} />
              {statusAttachmentName}
            </Button>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h4 className="mb-1 text-sm font-bold text-foreground">گردش کار و پیگیری</h4>
        <p className="mb-4 text-xs text-muted-foreground">
          همه پاسخ‌ها، ارجاع‌ها و پیوست‌های ثبت‌شده برای این نامه
        </p>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            هنوز رویدادی برای این نامه ثبت نشده است.
          </p>
        ) : (
          <ol className="relative space-y-1 before:absolute before:bottom-5 before:right-[7px] before:top-5 before:w-px before:bg-border">
            {timeline.map((item) => {
              const eventProgress =
                item.to_progress_percent ?? item.progress_percent ?? null;
              const files = attachmentNames(item);
              return (
                <li key={item.id} className="relative flex gap-4 pb-5">
                  <span
                    className={
                      "relative z-[1] mt-2 h-3.5 w-3.5 shrink-0 rounded-full ring-4 " +
                      timelineEventDotClass(item)
                    }
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {timelineEventLabel(item)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.event_type === "referred" && item.to_user_name ? (
                            <>
                              از{" "}
                              <span className="font-semibold text-foreground">
                                {item.actor_name || "سامانه"}
                              </span>{" "}
                              به{" "}
                              <span className="font-semibold text-violet-700">
                                {item.to_user_name}
                              </span>
                            </>
                          ) : (
                            <>توسط {item.actor_name || "سامانه"}</>
                          )}
                        </p>
                      </div>
                      <time className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatPersianDateTime(item.created_at)}
                      </time>
                    </div>

                    {(eventProgress !== null || item.note || files.length > 0) && (
                      <div className="mt-3 flex flex-wrap items-start gap-2">
                        {eventProgress !== null && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                            پیشرفت:{" "}
                            {normalizedProgress(eventProgress).toLocaleString("fa-IR")}٪
                          </span>
                        )}
                        {item.note ? (
                          <p className="min-w-0 flex-1 whitespace-pre-wrap rounded-xl bg-muted/40 px-3 py-2 text-xs leading-6 text-foreground/80">
                            {item.note}
                          </p>
                        ) : null}
                        {files.map((fileName, index) => (
                          <Button
                            key={`${item.id}-${fileName}-${index}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void downloadTimelineAttachment(item, index, fileName)
                            }
                            className="h-7 gap-1 rounded-full border-violet-100 bg-violet-50 px-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                          >
                            <Paperclip size={12} />
                            <span className="max-w-40 truncate">{fileName}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {referrals.length > 0 && (
        <section className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5">
          <h4 className="mb-3 text-sm font-bold text-foreground">سوابق ارجاع</h4>
          <div className="space-y-2">
            {referrals.map((referral) => {
              const files = attachmentNames(referral);
              return (
                <div
                  key={referral.id}
                  className="rounded-xl border border-sky-100 bg-card px-3 py-2 text-xs text-sky-900"
                >
                  <div>
                    از {referral.from_user_name} ← به {referral.to_user_name}
                  </div>
                  {referral.note ? (
                    <div className="mt-1 whitespace-pre-wrap text-sky-700">
                      {referral.note}
                    </div>
                  ) : null}
                  {files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {files.map((fileName, index) => (
                        <Button
                          key={`${referral.id}-${fileName}-${index}`}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void download(
                              `${base}/referrals/${referral.id}/attachment?index=${index}`,
                              fileName,
                            )
                          }
                          className="h-7 gap-1 rounded-lg text-[11px] text-sky-800"
                        >
                          <Paperclip size={11} />
                          <span className="max-w-36 truncate">{fileName}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-sky-600">
                    {formatPersianDateTime(referral.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {progressRows.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h4 className="mb-3 text-sm font-bold text-foreground">پیشرفت گیرندگان</h4>
          <ul className="space-y-2">
            {progressRows.map((row) => (
              <li
                key={row.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs"
              >
                <span className="font-semibold text-foreground">
                  {row.display_name || row.username}
                </span>
                <span className="text-muted-foreground">
                  {normalizedProgress(row.progress_percent).toLocaleString("fa-IR")}٪
                  {row.updated_at
                    ? ` · ${formatPersianDateTime(row.updated_at)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ccRecipients.length > 0 && (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
          <h4 className="mb-3 text-sm font-bold text-foreground">رونوشت</h4>
          <ul className="space-y-1.5 text-xs text-violet-900">
            {ccRecipients.map((row) => (
              <li key={`${row.user_id}-${row.created_at}`}>
                {row.display_name || row.username}
                {row.mentioned_by_name
                  ? ` · توسط ${row.mentioned_by_name}`
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
